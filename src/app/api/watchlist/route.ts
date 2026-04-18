import { NextRequest, NextResponse } from 'next/server';
import { getStockQuote, getHistoricalData } from '@/lib/stockData';
import { calculateIndicators } from '@/lib/indicators';
import { getWatchAction } from '@/lib/recommendations';
import { Market, Signal } from '@/types';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    const updates = await Promise.allSettled(
      items.map(async (item: { symbol: string; market: Market; buyPrice: number; id: string }) => {
        try {
          const [quote, historicalData] = await Promise.all([
            getStockQuote(item.symbol, item.market),
            getHistoricalData(item.symbol, item.market, 6),
          ]);

          const indicators =
            historicalData.length >= 50 ? calculateIndicators(historicalData) : null;

          const currentPrice = quote.price;
          const pnl = currentPrice - item.buyPrice;
          const pnlPercent = (pnl / item.buyPrice) * 100;

          let action: { action: Signal; reason: string } = { action: 'HOLD', reason: 'Insufficient data for analysis.' };
          if (indicators) {
            action = getWatchAction(item.buyPrice, currentPrice, indicators);
          }

          return {
            id: item.id,
            currentPrice,
            pnl: pnl * (item.market === 'ID' ? 100 : 1),
            pnlPercent,
            action: action.action,
            actionReason: action.reason,
            lastUpdated: new Date().toISOString(),
          };
        } catch (err: any) {
          console.error(`Watchlist update failed for ${item.symbol}:`, err.message);
          return {
            id: item.id,
            currentPrice: item.buyPrice,
            pnl: 0,
            pnlPercent: 0,
            action: 'HOLD' as const,
            actionReason: `Unable to fetch data: ${err.message}`,
            lastUpdated: new Date().toISOString(),
          };
        }
      })
    );

    const results = updates
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ updates: results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update watchlist' },
      { status: 500 }
    );
  }
}