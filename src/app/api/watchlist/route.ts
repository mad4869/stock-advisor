import { NextRequest, NextResponse } from 'next/server';
import { runScreenerForSymbol } from '@/lib/swingScreener';
import { getStockQuote } from '@/lib/stockData';
import { Signal, Market } from '@/types';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 50;
const CONCURRENCY_LIMIT = 5;

function determineAction(
  taScore: number,
  taComputed: boolean,
  currentPrice: number,
  buyPrice: number,
  stopLoss: number | null,
  takeProfit: number | null
): { action: Signal; reason: string } {
  // Priority 1: Stop-loss / Take-profit triggers (always apply)
  if (stopLoss && currentPrice <= stopLoss) {
    return { action: 'STRONG_SELL', reason: `Stop-loss hit at ${currentPrice}. Protect your capital.` };
  }
  if (takeProfit && currentPrice >= takeProfit) {
    return { action: 'SELL', reason: `Take-profit target reached at ${currentPrice}. Consider locking in gains.` };
  }
  
  // Priority 2: If TA was never computed (accumulation gate early-exit),
  // use position-aware fallback instead of false bearish signal.
  if (!taComputed) {
    const pnlPct = ((currentPrice - buyPrice) / buyPrice) * 100;
    if (pnlPct >= 15) {
      return { action: 'HOLD', reason: 'No active accumulation detected, but position is well in profit. Consider setting a trailing stop to protect gains.' };
    }
    if (pnlPct >= 0) {
      return { action: 'HOLD', reason: 'No active accumulation detected. Position is in profit. Monitor for trend changes.' };
    }
    if (pnlPct >= -5) {
      return { action: 'HOLD', reason: 'No active accumulation detected. Small unrealized loss — monitor closely and review your stop-loss plan.' };
    }
    return { action: 'SELL', reason: 'No active accumulation and position is in notable loss. Review your thesis and stop-loss levels.' };
  }

  // Priority 3: TA was computed — use the score
  if (taScore >= 80) return { action: 'STRONG_BUY', reason: 'Exceptional technical setup with multiple bullish confirmations.' };
  if (taScore >= 60) return { action: 'BUY', reason: 'Solid bullish momentum and trend alignment.' };
  if (taScore >= 40) return { action: 'HOLD', reason: 'Neutral signals. Trend is consolidating or indicators are mixed.' };
  if (taScore >= 20) return { action: 'SELL', reason: 'Bearish momentum increasing. Trend weakening.' };
  return { action: 'STRONG_SELL', reason: 'Strong bearish breakdown. Multiple indicators showing weakness.' };
}

/** Process items in batches with concurrency limit */
async function processBatched<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const res of batchResults) {
      if (res.status === 'fulfilled') {
        results.push(res.value);
      }
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json();
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Clamp to max items
    const safeItems = items.slice(0, MAX_ITEMS);

    // Validate each item has required fields
    const validItems = safeItems.filter((item: any) =>
      item?.symbol &&
      typeof item.symbol === 'string' &&
      typeof item.buyPrice === 'number' &&
      typeof item.quantity === 'number' &&
      ['US', 'ID'].includes(item.market)
    );

    const updates = await processBatched(validItems, CONCURRENCY_LIMIT, async (item: any) => {
      try {
        const [quote, screener] = await Promise.all([
          getStockQuote(item.symbol, item.market as Market),
          runScreenerForSymbol(item.symbol, item.market as Market, 'DEFAULT')
        ]);

        const currentPrice = quote.price;
        const taComputed = screener.taData !== null;
        const currentScore = screener.taScore;
        const { action, reason } = determineAction(currentScore, taComputed, currentPrice, item.buyPrice, item.stopLossPrice, item.takeProfitPrice);

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

    return NextResponse.json({ updates: updates.filter(Boolean) });

  } catch (error: any) {
    console.error('Watchlist API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
