import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol, Preset } from '@/lib/swingScreener';
import { SwingScreenerResult } from '@/types';
import { US_UNIVERSES, ID_UNIVERSES } from '@/lib/universes';
import { screenerResultCache, CACHE_TTL } from '@/lib/cache';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VALID_PRESETS: Preset[] = ['DEFAULT', 'BREAKOUT', 'EARLY_BREAKOUT', 'OVERSOLD', 'SMART_MONEY', 'VOLUME_CLIMAX', 'SHORT_SQUEEZE', 'MA_TREND', 'TA_ONLY', 'STEALTH_ACCUM', 'BULL_DIV', 'VOL_SPIKE', 'DEFENSIVE', 'HIGH_YIELD_DIVIDEND'];
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Input validation
  const marketRaw = searchParams.get('market') || 'US';
  const market: Market = marketRaw === 'ID' ? 'ID' : 'US';

  const universeKey = searchParams.get('universe') || (market === 'US' ? 'SP100' : 'LQ45');

  const presetRaw = searchParams.get('preset') || 'DEFAULT';
  const preset: Preset = VALID_PRESETS.includes(presetRaw as Preset)
    ? (presetRaw as Preset)
    : 'DEFAULT';

  if (market === 'ID' && preset === 'SHORT_SQUEEZE') {
    return NextResponse.json(
      { error: 'SHORT_SQUEEZE preset is not supported for IDX market' },
      { status: 400 }
    );
  }

  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');

  const page = Math.max(1, pageParam ? parseInt(pageParam, 10) || 1 : 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitParam ? parseInt(limitParam, 10) || 15 : 15));

  // Validate universe
  let symbols: string[] = [];
  if (market === 'US') {
    symbols = US_UNIVERSES[universeKey as keyof typeof US_UNIVERSES] || US_UNIVERSES.SP100;
  } else {
    symbols = ID_UNIVERSES[universeKey as keyof typeof ID_UNIVERSES] || ID_UNIVERSES.LQ45;
  }

  const total = symbols.length;
  const totalPages = Math.ceil(total / limit);

  // If page exceeds total pages, return empty
  if (page > totalPages && total > 0) {
    return NextResponse.json({
      results: [],
      pagination: { page, limit, total, totalPages }
    });
  }

  // Get chunk
  const chunkSymbols = symbols.slice((page - 1) * limit, page * limit);
  const cacheKey = `screener:${market}:${universeKey}:${preset}:p${page}:l${limit}`;
  
  const cached = screenerResultCache.get<{ results: SwingScreenerResult[], pagination: any, timestamp: number }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const promises = chunkSymbols.map(sym => runScreenerForSymbol(sym, market, preset));
    const batchResults = await Promise.allSettled(promises);

    const allResults: SwingScreenerResult[] = [];
    for (const res of batchResults) {
      if (res.status === 'fulfilled') {
        allResults.push(res.value);
      } else {
        console.error('Screener chunk error:', res.reason);
      }
    }

    // Filter to only passing stocks, sort by Smart Money, then TA, then Fundamental
    const passingStocks = allResults
      .filter(r => r.isPass && !r.error)
      .sort((a, b) => {
        if (preset === 'HIGH_YIELD_DIVIDEND') {
          // 1. Sort by Dividend Yield
          const aYield = a.dividendYield || 0;
          const bYield = b.dividendYield || 0;
          if (bYield !== aYield) return bYield - aYield;

          // 2. Sort by Fundamental Score
          const aFund = a.fundamentalScore?.total || 0;
          const bFund = b.fundamentalScore?.total || 0;
          if (bFund !== aFund) return bFund - aFund;
          
          // 3. Sort by Discount from Peak
          const aDisc = a.priceDiscountFromPeak || 0;
          const bDisc = b.priceDiscountFromPeak || 0;
          return bDisc - aDisc;
        } else {
          // 1. Sort by Smart Money (Accumulation Score)
          const aSmart = a.smartMoney?.accumulationScore || 0;
          const bSmart = b.smartMoney?.accumulationScore || 0;
          if (bSmart !== aSmart) return bSmart - aSmart;
  
          // 2. Sort by TA Score
          if (b.taScore !== a.taScore) return b.taScore - a.taScore;
  
          // 3. Sort by Fundamental Score
          const aFund = a.fundamentalScore?.total || 0;
          const bFund = b.fundamentalScore?.total || 0;
          return bFund - aFund;
        }
      });

    const responseData = {
      results: passingStocks,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      timestamp: Date.now()
    };

    screenerResultCache.set(cacheKey, responseData, CACHE_TTL.SCREENER_RESULT);

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Screener API Error:', error);
    return NextResponse.json({ error: 'Failed to run stock screener' }, { status: 500 });
  }
}
