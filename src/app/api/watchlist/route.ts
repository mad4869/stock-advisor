import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { getStockQuote } from '@/lib/stockData';
import { Signal } from '@/types';

export const dynamic = 'force-dynamic';

function determineAction(taScore: number, currentPrice: number, stopLoss: number | null, takeProfit: number | null): { action: Signal; reason: string } {
  if (stopLoss && currentPrice <= stopLoss) {
    return { action: 'STRONG_SELL', reason: `Stop-loss hit at ${currentPrice}. Protect your capital.` };
  }
  if (takeProfit && currentPrice >= takeProfit) {
    return { action: 'SELL', reason: `Take-profit target reached at ${currentPrice}. Consider locking in gains.` };
  }
  
  if (taScore >= 80) return { action: 'STRONG_BUY', reason: 'Exceptional technical setup with multiple bullish confirmations.' };
  if (taScore >= 60) return { action: 'BUY', reason: 'Solid bullish momentum and trend alignment.' };
  if (taScore >= 40) return { action: 'HOLD', reason: 'Neutral signals. Trend is consolidating or indicators are mixed.' };
  if (taScore >= 20) return { action: 'SELL', reason: 'Bearish momentum increasing. Trend weakening.' };
  return { action: 'STRONG_SELL', reason: 'Strong bearish breakdown. Multiple indicators showing weakness.' };
}

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    const promises = items.map(async (item: any) => {
      try {
        const [quote, screener] = await Promise.all([
          getStockQuote(item.symbol, item.market),
          runScreenerForSymbol(item.symbol, item.market, 'DEFAULT')
        ]);

        const currentPrice = quote.price;
        const currentScore = screener.taScore;
        const signals = screener.signals || [];
        const { action, reason } = determineAction(currentScore, currentPrice, item.stopLossPrice, item.takeProfitPrice);

        // Calculate PnL
        const multiplier = item.market === 'ID' ? 100 : 1;
        const pnl = (currentPrice - item.buyPrice) * item.quantity * multiplier;
        const pnlPercent = ((currentPrice - item.buyPrice) / item.buyPrice) * 100;

        return {
          id: item.id,
          currentPrice,
          pnl,
          pnlPercent,
          action,
          actionReason: reason,
          lastUpdated: new Date().toISOString()
        };
      } catch (err) {
        console.error(`Error updating watchlist item ${item.symbol}:`, err);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const updates = results.filter(Boolean);

    return NextResponse.json({ updates });

  } catch (error: any) {
    console.error('Watchlist API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
