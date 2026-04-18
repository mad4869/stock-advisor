import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote, getHistoricalData, POPULAR_STOCKS } from '@/lib/stockData';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeStock } from '@/lib/recommendations';
import { Market, StockRecommendation } from '@/types';

// Increase Vercel serverless function timeout
export const maxDuration = 30; // seconds (default is 10)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const market = (searchParams.get('market') || 'US') as Market;

  try {
    const stocks = POPULAR_STOCKS.filter((s) => s.market === market);
    const recommendations: StockRecommendation[] = [];

    // Process in smaller batches to avoid timeout
    const batchSize = 2;
    for (let i = 0; i < stocks.length; i += batchSize) {
      const batch = stocks.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (stock) => {
          try {
            const [quote, historicalData] = await Promise.all([
              getStockQuote(stock.symbol, market),
              getHistoricalData(stock.symbol, market, 12),
            ]);
            if (historicalData.length >= 50) {
              const indicators = calculateIndicators(historicalData);
              return analyzeStock(quote, indicators);
            }
            return null;
          } catch (err) {
            console.error(`Failed to analyze ${stock.symbol}:`, err);
            return null;
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          recommendations.push(result.value);
        }
      }
    }

    const signalOrder = { STRONG_BUY: 0, BUY: 1, HOLD: 2, SELL: 3, STRONG_SELL: 4 };
    recommendations.sort((a, b) => {
      const orderDiff = signalOrder[a.overallSignal] - signalOrder[b.overallSignal];
      if (orderDiff !== 0) return orderDiff;
      return b.confidence - a.confidence;
    });

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}