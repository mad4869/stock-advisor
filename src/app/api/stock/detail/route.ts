import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { getStockQuote } from '@/lib/stockData';
import { yf } from '@/lib/yahooFinance2';
import { Market } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const marketRaw = searchParams.get('market') || 'US';
  const market: Market = marketRaw === 'ID' ? 'ID' : 'US';

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const cleanSymbol = symbol.toUpperCase().trim();
  if (!cleanSymbol.match(/^[A-Z0-9.]{1,10}$/)) {
    return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
  }

  const querySymbol = market === 'ID' && !cleanSymbol.endsWith('.JK') ? `${cleanSymbol}.JK` : cleanSymbol;

  try {
    const [screener, quote, profileSummary] = await Promise.allSettled([
      runScreenerForSymbol(cleanSymbol, market, 'DEFAULT'),
      getStockQuote(cleanSymbol, market),
      yf.quoteSummary(querySymbol, { modules: ['assetProfile'] })
    ]);

    const result = {
      screener: screener.status === 'fulfilled' ? screener.value : null,
      quote: quote.status === 'fulfilled' ? quote.value : null,
      profile: profileSummary.status === 'fulfilled' ? profileSummary.value.assetProfile : null,
      errors: {
        screener: screener.status === 'rejected' ? screener.reason.message : null,
        quote: quote.status === 'rejected' ? quote.reason.message : null,
        profile: profileSummary.status === 'rejected' ? profileSummary.reason.message : null,
      }
    };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stock detail data' },
      { status: 500 }
    );
  }
}
