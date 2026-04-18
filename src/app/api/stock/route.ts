import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote, searchStocks } from '@/lib/stockData';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const market = (searchParams.get('market') || 'US') as Market;
  const query = searchParams.get('query');

  try {
    if (query) {
      const results = await searchStocks(query, market);
      return NextResponse.json({ results });
    }

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const quote = await getStockQuote(symbol, market);
    return NextResponse.json({ quote });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}