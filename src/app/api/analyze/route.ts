import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote, getHistoricalData } from '@/lib/stockData';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeStock } from '@/lib/recommendations';
import { Market } from '@/types';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const market = (searchParams.get('market') || 'US') as Market;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    const [quote, historicalData] = await Promise.all([
      getStockQuote(symbol, market),
      getHistoricalData(symbol, market, 12),
    ]);

    if (historicalData.length < 50) {
      return NextResponse.json(
        { error: `Insufficient historical data for ${symbol} (got ${historicalData.length} days, need 50+)` },
        { status: 400 }
      );
    }

    const indicators = calculateIndicators(historicalData);
    const recommendation = analyzeStock(quote, indicators);

    return NextResponse.json({
      recommendation,
      rawIndicators: indicators,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to analyze stock' },
      { status: 500 }
    );
  }
}