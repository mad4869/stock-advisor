import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol, Preset, ScreenerResult } from '@/lib/swingScreener';
import { US_UNIVERSES, ID_UNIVERSES } from '@/lib/universes';
import { screenerResultCache, CACHE_TTL } from '@/lib/cache';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const market = (searchParams.get('market') as Market) || 'US';
  const universeKey = searchParams.get('universe') || (market === 'US' ? 'SP100' : 'LQ45');
  const preset = (searchParams.get('preset') as Preset) || 'DEFAULT';

  // Validate universe
  let symbols: string[] = [];
  if (market === 'US') {
    symbols = US_UNIVERSES[universeKey as keyof typeof US_UNIVERSES] || US_UNIVERSES.SP100;
  } else {
    // If 'ALL' is passed, it's too large for a single serverless invocation without timing out.
    // We will cap it to Kompas100 + LQ45 combined or just fallback to Kompas100.
    if (universeKey === 'ALL') {
      symbols = Array.from(new Set([...ID_UNIVERSES.LQ45, ...ID_UNIVERSES.KOMPAS100]));
    } else {
      symbols = ID_UNIVERSES[universeKey as keyof typeof ID_UNIVERSES] || ID_UNIVERSES.LQ45;
    }
  }

  // For local execution, we allow the full universe to process.
  // Note: Scanning 900 stocks takes ~3 minutes due to Yahoo Finance rate limiting.

  const cacheKey = `screener:${market}:${universeKey}:${preset}`;
  const cached = screenerResultCache.get<{ results: ScreenerResult[], timestamp: number }>(cacheKey);
  
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    const allResults: ScreenerResult[] = [];

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(sym => runScreenerForSymbol(sym, market, preset));
      const batchResults = await Promise.allSettled(promises);

      for (const res of batchResults) {
        if (res.status === 'fulfilled') {
          allResults.push(res.value);
        } else {
          console.error('Screener batch error:', res.reason);
        }
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Filter to only passing stocks, sort by TA score descending
    const passingStocks = allResults
      .filter(r => r.isPass && !r.error)
      .sort((a, b) => b.taScore - a.taScore);

    const responseData = {
      results: passingStocks,
      timestamp: Date.now()
    };

    screenerResultCache.set(cacheKey, responseData, CACHE_TTL.SCREENER_RESULT);

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Screener API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
