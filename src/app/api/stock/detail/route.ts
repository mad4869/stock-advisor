import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { getStockQuote } from '@/lib/stockData';
import { yf } from '@/lib/yahooFinance2';
import { calculateTA } from '@/lib/technicalIndicators';
import { calculatePriceRecommendation } from '@/lib/priceRecommendation';
import { Market } from '@/types';
import { historyCache, CACHE_TTL } from '@/lib/cache';

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
      runScreenerForSymbol(cleanSymbol, market, 'DETAIL'),
      getStockQuote(cleanSymbol, market),
      yf.quoteSummary(querySymbol, { modules: ['assetProfile'] })
    ]);

    // Compute price recommendation from historical data + TA
    let priceRecommendation = null;
    try {
      const historyCacheKey = `history:${cleanSymbol}:${market}:12`;
      let history = historyCache.get<any[]>(historyCacheKey);

      if (!history) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 365);

        const chartData = await yf.chart(querySymbol, {
          period1: startDate.toISOString().split('T')[0],
          period2: endDate.toISOString().split('T')[0],
          interval: '1d'
        });
        history = chartData.quotes;
        if (history && history.length > 0 && chartData?.meta?.regularMarketPrice > 0) {
          const livePrice = chartData.meta.regularMarketPrice;
          const lastQuote = history[history.length - 1];
          if (lastQuote && lastQuote.close !== livePrice) {
            const lastDate = new Date(lastQuote.date);
            const today = new Date();
            if (lastDate.toDateString() === today.toDateString()) {
              lastQuote.close = livePrice;
              if (livePrice > lastQuote.high) lastQuote.high = livePrice;
              if (livePrice < lastQuote.low) lastQuote.low = livePrice;
              if (chartData.meta.regularMarketVolume) lastQuote.volume = chartData.meta.regularMarketVolume;
            } else if (today.getTime() - lastDate.getTime() > 0) {
              history.push({
                date: today.toISOString(),
                open: chartData.meta.regularMarketOpen ?? livePrice,
                high: chartData.meta.regularMarketDayHigh ?? Math.max(lastQuote.close, livePrice),
                low: chartData.meta.regularMarketDayLow ?? Math.min(lastQuote.close, livePrice),
                close: livePrice,
                volume: chartData.meta.regularMarketVolume ?? 0,
              });
            }
          }
        }
        if (history && history.length > 0) {
          historyCache.set(historyCacheKey, history, CACHE_TTL.HISTORICAL);
        }
      }

      if (history && history.length >= 50) {
        const ta = calculateTA(history, market);
        if (ta) {
          if (quote.status === 'fulfilled' && quote.value?.price > 0) {
            ta.close = quote.value.price;
          }
          priceRecommendation = calculatePriceRecommendation(ta, history, market);
        }
      }
    } catch (err: any) {
      console.warn(`[Detail API] Failed to compute price recommendation for ${cleanSymbol}: ${err.message}`);
    }

    const screenerVal = screener.status === 'fulfilled' ? screener.value : null;
    const quoteVal = quote.status === 'fulfilled' ? quote.value : null;

    if (screenerVal && screenerVal.taData && quoteVal && quoteVal.price > 0) {
      screenerVal.taData.close = quoteVal.price;
    }

    const result = {
      screener: screenerVal,
      quote: quoteVal,
      profile: profileSummary.status === 'fulfilled' ? profileSummary.value.assetProfile : null,
      priceRecommendation,
      errors: {
        screener: screener.status === 'rejected' ? screener.reason.message : null,
        quote: quote.status === 'rejected' ? quote.reason.message : null,
        profile: profileSummary.status === 'rejected' ? profileSummary.reason.message : null,
      }
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Stock Detail API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock detail data' },
      { status: 500 }
    );
  }
}
