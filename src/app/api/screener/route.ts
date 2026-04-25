import { NextRequest, NextResponse } from 'next/server';
import { getStockFundamentals2 } from '@/lib/yahooFinance2';
import { SCREENER_UNIVERSE } from '@/lib/stockData';
import { Market } from '@/types';
import {
  ScreenerFilters,
  ScreenerResult,
  ScreenerFilterKey,
  FundamentalData,
} from '@/types/screener';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const market = (body.market || 'US') as Market;
    const filters: ScreenerFilters = body.filters || {};
    const additionalSymbols: string[] = body.additionalSymbols || [];

    // Build the stock universe
    const universe = market === 'ID'
      ? SCREENER_UNIVERSE.ID
      : SCREENER_UNIVERSE.US;

    // Add user-specified symbols (deduplicate)
    const existingSymbols = new Set(universe.map((s) => s.symbol.toUpperCase()));
    const extraSymbols = additionalSymbols
      .map((s) => s.toUpperCase().trim())
      .filter((s) => s && !existingSymbols.has(s));

    const allSymbols = [
      ...universe,
      ...extraSymbols.map((s) => ({ symbol: s, name: s })),
    ];

    console.log(`[Screener] Screening ${allSymbols.length} stocks in ${market} market`);

    // Get active filter keys
    const activeFilterKeys = Object.keys(filters) as ScreenerFilterKey[];
    const totalFilters = activeFilterKeys.length;

    if (totalFilters === 0) {
      return NextResponse.json(
        { error: 'At least one filter must be specified' },
        { status: 400 }
      );
    }

    // Fetch fundamentals for all stocks (with error handling per stock)
    const results: ScreenerResult[] = [];
    const errors: string[] = [];

    // Process in batches of 3 to stay within rate limits
    const batchSize = 3;
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      const batch = allSymbols.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (stock) => {
          try {
            const fundamentals = await getStockFundamentals2(stock.symbol, market);
            // Override name if we have a better one from our universe
            if (stock.name && stock.name !== stock.symbol) {
              fundamentals.name = stock.name;
            }
            return fundamentals;
          } catch (err: any) {
            throw new Error(`${stock.symbol}: ${err.message}`);
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const fundamentals = result.value;
          const { matchedCount, passed } = evaluateFilters(fundamentals, filters, activeFilterKeys);

          if (passed) {
            results.push({
              stock: fundamentals,
              matchedFilters: matchedCount,
              totalFilters,
              passRate: totalFilters > 0 ? (matchedCount / totalFilters) * 100 : 100,
            });
          }
        } else {
          errors.push(result.reason?.message || 'Unknown error');
          console.warn(`[Screener] ${result.reason?.message}`);
        }
      }
    }

    // Sort by pass rate descending, then by P/E ascending
    results.sort((a, b) => {
      if (b.passRate !== a.passRate) return b.passRate - a.passRate;
      const aPE = a.stock.peRatio ?? 999;
      const bPE = b.stock.peRatio ?? 999;
      return aPE - bPE;
    });

    console.log(`[Screener] Done: ${results.length}/${allSymbols.length} matched`);

    return NextResponse.json({
      results,
      totalScreened: allSymbols.length,
      totalMatched: results.length,
      errors: errors.slice(0, 10), // limit error list
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Screener failed' },
      { status: 500 }
    );
  }
}

function evaluateFilters(
  stock: FundamentalData,
  filters: ScreenerFilters,
  activeKeys: ScreenerFilterKey[]
): { matchedCount: number; passed: boolean } {
  let matchedCount = 0;

  for (const key of activeKeys) {
    const range = filters[key];
    if (!range) continue;

    const value = stock[key];

    // If the value is null/undefined, this filter cannot pass
    if (value == null) continue;

    const numValue = value as number;
    let passes = true;

    if (range.min !== undefined && numValue < range.min) passes = false;
    if (range.max !== undefined && numValue > range.max) passes = false;

    if (passes) matchedCount++;
  }

  // A stock passes if it matches ALL active filters
  return { matchedCount, passed: matchedCount === activeKeys.length };
}
