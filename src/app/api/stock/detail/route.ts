import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { getStockQuote } from '@/lib/stockData';
import YahooFinance from 'yahoo-finance2';
import { Market } from '@/types';

const yf = new YahooFinance();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const market = (searchParams.get('market') || 'US') as Market;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const querySymbol = market === 'ID' && !symbol.endsWith('.JK') ? `${symbol}.JK` : symbol;

  try {
    const [screener, quote, profileSummary] = await Promise.allSettled([
      runScreenerForSymbol(symbol, market, 'DEFAULT'),
      getStockQuote(symbol, market),
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
