import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote } from '@/lib/stockData';
import { searchStocks2 } from '@/lib/yahooFinance2';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const marketRaw = searchParams.get('market') || 'US';
  const market: Market = marketRaw === 'ID' ? 'ID' : 'US';
  const query = searchParams.get('query');

  try {
    if (query) {
      const results = await searchStocks2(query, market);
      return NextResponse.json({ results });
    }

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Validate symbol format
    const cleanSymbol = symbol.toUpperCase().trim();
    if (!cleanSymbol.match(/^[A-Z0-9.]{1,10}$/)) {
      return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    }

    const quote = await getStockQuote(cleanSymbol, market);
    return NextResponse.json({ quote });
  } catch (error: any) {
    console.error('Stock API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}