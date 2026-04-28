import { NextRequest, NextResponse } from 'next/server';
import { POPULAR_STOCKS } from '@/lib/stockData';
import { computeCompositeScore } from '@/lib/scoreService';
import { Market } from '@/types';

// Increase Vercel serverless function timeout
export const maxDuration = 30; // seconds (default is 10)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const market = (searchParams.get('market') || 'US') as Market;
  const limit = Math.max(1, Math.min(20, parseInt(searchParams.get('limit') || '10')));

  try {
    const stocks = POPULAR_STOCKS.filter((s) => s.market === market);
    const scored: { symbol: string; score: number; payload: any }[] = [];

    // Process in smaller batches to avoid timeout
    const batchSize = 2;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (stock) => {
          try {
            const { score } = await computeCompositeScore(stock.symbol, market);
            return score;
          } catch (err) {
            console.error(`Failed to analyze ${stock.symbol}:`, err);
            return null;
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          scored.push({
            symbol: result.value.symbol,
            score: result.value.totalScore,
            payload: result.value,
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      recommendations: scored.slice(0, limit).map((s) => s.payload),
      meta: {
        market,
        universeSize: stocks.length,
        returned: Math.min(limit, scored.length),
        sort: 'totalScore_desc',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}