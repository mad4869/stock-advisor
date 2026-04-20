import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================
// Shared Yahoo fetch helper (server-side — no CORS issues)
// ============================================================

async function fetchYahoo(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// POST: Test a single stock (called from the manual test UI)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, market } = body;

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const clean = symbol.toUpperCase().replace('.JK', '').replace('.JKT', '').trim();
    const suffix = market === 'ID' ? '.JK' : '';
    const yahooSymbol = `${clean}${suffix}`;
    const startTime = Date.now();

    // 1. Test Quote
    let quoteResult: any = null;
    let quoteError: string | null = null;

    try {
      const res = await fetchYahoo(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=5d&interval=1d`
      );

      if (!res.ok) {
        quoteError = `HTTP ${res.status}: ${res.statusText}`;
      } else {
        const data = await res.json();
        const result = data?.chart?.result?.[0];

        if (!result) {
          quoteError = `No data returned for ${yahooSymbol}. The symbol may not exist.`;
        } else {
          const meta = result.meta;
          const price = meta?.regularMarketPrice;

          if (!price) {
            quoteError = 'Response received but no price data found.';
          } else {
            quoteResult = {
              symbol: yahooSymbol,
              name: meta.longName || meta.shortName || clean,
              price,
              previousClose: meta.chartPreviousClose || meta.previousClose,
              change: price - (meta.chartPreviousClose || meta.previousClose || price),
              currency: meta.currency,
              exchange: meta.exchangeName,
              marketState: meta.marketState,
              fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
              fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
              volume: meta.regularMarketVolume,
            };
          }
        }
      }
    } catch (e: any) {
      quoteError = `Quote fetch error: ${e.message}`;
    }

    // 2. Test Historical Data
    let histResult: any = null;
    let histError: string | null = null;

    try {
      const period1 = Math.floor(Date.now() / 1000 - 6 * 30 * 24 * 60 * 60);
      const period2 = Math.floor(Date.now() / 1000);
      const res = await fetchYahoo(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d`
      );

      if (!res.ok) {
        histError = `HTTP ${res.status}: ${res.statusText}`;
      } else {
        const data = await res.json();
        const result = data?.chart?.result?.[0];

        if (!result?.timestamp) {
          histError = 'No historical timestamp data returned.';
        } else {
          const timestamps = result.timestamp;
          const quotes = result.indicators?.quote?.[0];

          let validDays = 0;
          if (quotes) {
            for (let i = 0; i < timestamps.length; i++) {
              if (quotes.close?.[i] != null) validDays++;
            }
          }

          histResult = {
            totalDataPoints: timestamps.length,
            validDataPoints: validDays,
            firstDate: new Date(timestamps[0] * 1000).toLocaleDateString(),
            lastDate: new Date(timestamps[timestamps.length - 1] * 1000).toLocaleDateString(),
            samplePrices: quotes
              ? {
                  firstClose: quotes.close?.[0],
                  lastClose: quotes.close?.[quotes.close.length - 1],
                  firstVolume: quotes.volume?.[0],
                }
              : null,
            sufficient: validDays >= 50,
          };
        }
      }
    } catch (e: any) {
      histError = `Historical fetch error: ${e.message}`;
    }

    const duration = Date.now() - startTime;
    const success = quoteResult !== null && !quoteError;

    return NextResponse.json({
      success,
      duration,
      symbol: clean,
      market: market || 'US',
      yahooSymbol,
      quote: quoteResult,
      quoteError,
      historical: histResult,
      histError,
      note: success
        ? 'This stock works with the Yahoo provider. You can use it in the app.'
        : 'This stock had issues. Check the errors below.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================
// GET: Automated test suite (unchanged from before)
// ============================================================

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  data?: any;
  error?: string;
}

async function runTest(name: string, fn: () => Promise<any>): Promise<TestResult> {
  const start = Date.now();
  try {
    const data = await fn();
    return { name, status: 'pass', duration: Date.now() - start, data };
  } catch (error: any) {
    return { name, status: 'fail', duration: Date.now() - start, error: error.message || String(error) };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const testType = searchParams.get('type') || 'all';

  const results: TestResult[] = [];

  // TEST 1: Basic connectivity
  if (testType === 'all' || testType === 'connectivity') {
    results.push(
      await runTest('Yahoo Finance: Basic Connectivity', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d'
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (!price) throw new Error('No price in response');
        return { message: 'Yahoo Finance is reachable', statusCode: res.status };
      })
    );
  }

  // TEST 2: US Stock Quote (AAPL)
  if (testType === 'all' || testType === 'us-quote') {
    results.push(
      await runTest('US Stock Quote: AAPL', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d'
        );
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) throw new Error('No price data');
        return {
          symbol: 'AAPL',
          name: meta.longName || meta.shortName,
          price: meta.regularMarketPrice,
          currency: meta.currency,
          exchange: meta.exchangeName,
        };
      })
    );
  }

  // TEST 3: US Stock Quote (MSFT)
  if (testType === 'all' || testType === 'us-quote-2') {
    results.push(
      await runTest('US Stock Quote: MSFT', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v8/finance/chart/MSFT?range=5d&interval=1d'
        );
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) throw new Error('No price data');
        return {
          symbol: 'MSFT',
          name: meta.longName || meta.shortName,
          price: meta.regularMarketPrice,
          currency: meta.currency,
        };
      })
    );
  }

  // TEST 4: IDX Stock Quote (BBCA.JK)
  if (testType === 'all' || testType === 'idx-quote') {
    results.push(
      await runTest('IDX Stock Quote: BBCA', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?range=5d&interval=1d'
        );
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) throw new Error('No price data for BBCA.JK');
        return {
          symbol: 'BBCA.JK',
          name: meta.longName || meta.shortName,
          price: meta.regularMarketPrice,
          currency: meta.currency,
          exchange: meta.exchangeName,
        };
      })
    );
  }

  // TEST 5: IDX ITMG
  if (testType === 'all' || testType === 'idx-itmg') {
    results.push(
      await runTest('IDX Stock Quote: ITMG (previously failed)', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v8/finance/chart/ITMG.JK?range=5d&interval=1d'
        );
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) throw new Error('No price data for ITMG.JK');
        return {
          symbol: 'ITMG.JK',
          name: meta.longName || meta.shortName,
          price: meta.regularMarketPrice,
          currency: meta.currency,
        };
      })
    );
  }

  // TEST 6: IDX ADRO
  if (testType === 'all' || testType === 'idx-adro') {
    results.push(
      await runTest('IDX Stock Quote: ADRO', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v8/finance/chart/ADRO.JK?range=5d&interval=1d'
        );
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) throw new Error('No price data');
        return {
          symbol: 'ADRO.JK',
          name: meta.longName || meta.shortName,
          price: meta.regularMarketPrice,
          currency: meta.currency,
        };
      })
    );
  }

  // TEST 7: US Historical
  if (testType === 'all' || testType === 'us-history') {
    results.push(
      await runTest('US Historical Data: AAPL (6 months)', async () => {
        const period1 = Math.floor(Date.now() / 1000 - 6 * 30 * 24 * 60 * 60);
        const period2 = Math.floor(Date.now() / 1000);
        const res = await fetchYahoo(
          `https://query1.finance.yahoo.com/v8/finance/chart/AAPL?period1=${period1}&period2=${period2}&interval=1d`
        );
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result?.timestamp) throw new Error('No timestamp data');
        const quotes = result.indicators?.quote?.[0];
        let validCount = 0;
        for (let i = 0; i < result.timestamp.length; i++) {
          if (quotes?.close?.[i] != null) validCount++;
        }
        return {
          totalDataPoints: result.timestamp.length,
          validDataPoints: validCount,
          firstDate: new Date(result.timestamp[0] * 1000).toISOString().split('T')[0],
          lastDate: new Date(result.timestamp[result.timestamp.length - 1] * 1000).toISOString().split('T')[0],
        };
      })
    );
  }

  // TEST 8: IDX Historical
  if (testType === 'all' || testType === 'idx-history') {
    results.push(
      await runTest('IDX Historical Data: BBCA (6 months)', async () => {
        const period1 = Math.floor(Date.now() / 1000 - 6 * 30 * 24 * 60 * 60);
        const period2 = Math.floor(Date.now() / 1000);
        const res = await fetchYahoo(
          `https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?period1=${period1}&period2=${period2}&interval=1d`
        );
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result?.timestamp) throw new Error('No timestamp data');
        const quotes = result.indicators?.quote?.[0];
        let validCount = 0;
        for (let i = 0; i < result.timestamp.length; i++) {
          if (quotes?.close?.[i] != null) validCount++;
        }
        return {
          totalDataPoints: result.timestamp.length,
          validDataPoints: validCount,
          firstDate: new Date(result.timestamp[0] * 1000).toISOString().split('T')[0],
          lastDate: new Date(result.timestamp[result.timestamp.length - 1] * 1000).toISOString().split('T')[0],
        };
      })
    );
  }

  // TEST 9: Yahoo Search (US)
  if (testType === 'all' || testType === 'search-us') {
    results.push(
      await runTest('Yahoo Search: "Apple" (US)', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v1/finance/search?q=Apple&quotesCount=5&newsCount=0'
        );
        const data = await res.json();
        const quotes = data?.quotes;
        if (!quotes || quotes.length === 0) throw new Error('No search results');
        return {
          totalResults: quotes.length,
          results: quotes.slice(0, 3).map((q: any) => ({
            symbol: q.symbol,
            name: q.longname || q.shortname,
            type: q.quoteType,
            exchange: q.exchange,
          })),
        };
      })
    );
  }

  // TEST 10: Yahoo Search (IDX)
  if (testType === 'all' || testType === 'search-idx') {
    results.push(
      await runTest('Yahoo Search: "Bank" (IDX)', async () => {
        const res = await fetchYahoo(
          'https://query1.finance.yahoo.com/v1/finance/search?q=Bank%20Indonesia&quotesCount=10&newsCount=0'
        );
        const data = await res.json();
        const quotes = data?.quotes?.filter((q: any) => q.symbol?.endsWith('.JK'));
        if (!quotes || quotes.length === 0) throw new Error('No IDX results found');
        return {
          totalIDXResults: quotes.length,
          results: quotes.slice(0, 5).map((q: any) => ({
            symbol: q.symbol,
            name: q.longname || q.shortname,
            exchange: q.exchange,
          })),
        };
      })
    );
  }

  // TEST 11: Batch IDX
  if (testType === 'all' || testType === 'idx-batch') {
    const idxSymbols = ['BBRI', 'BMRI', 'TLKM', 'ASII', 'UNVR', 'ITMG', 'ADRO', 'ANTM', 'GOTO', 'BUKA'];
    results.push(
      await runTest(`IDX Batch Test: ${idxSymbols.length} stocks`, async () => {
        const testResults: { symbol: string; status: string; price?: number }[] = [];
        for (const sym of idxSymbols) {
          try {
            const res = await fetchYahoo(
              `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.JK?range=1d&interval=1d`
            );
            const data = await res.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            testResults.push({
              symbol: sym,
              status: price ? 'OK' : 'NO_PRICE',
              price: price ? Math.round(price) : undefined,
            });
          } catch (e: any) {
            testResults.push({ symbol: sym, status: `FAIL: ${e.message}` });
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        const passed = testResults.filter((r) => r.status === 'OK').length;
        return { tested: idxSymbols.length, passed, failed: idxSymbols.length - passed, details: testResults };
      })
    );
  }

  // TEST: Rate limit
  if (testType === 'rate-limit') {
    results.push(
      await runTest('Rate Limit Test: 5 rapid requests', async () => {
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
        const startTime = Date.now();
        const testResults: { symbol: string; status: string; time: number }[] = [];
        for (const sym of symbols) {
          const reqStart = Date.now();
          try {
            const res = await fetchYahoo(
              `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`
            );
            const data = await res.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            testResults.push({
              symbol: sym,
              status: price ? `OK ($${price})` : 'NO_DATA',
              time: Date.now() - reqStart,
            });
          } catch (e: any) {
            testResults.push({ symbol: sym, status: `FAIL: ${e.message}`, time: Date.now() - reqStart });
          }
        }
        return {
          totalTime: Date.now() - startTime,
          avgTime: Math.round((Date.now() - startTime) / symbols.length),
          results: testResults,
        };
      })
    );
  }

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.status === 'pass').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  return NextResponse.json({
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      totalDuration: `${totalDuration}ms`,
      allPassed: passedTests === totalTests,
    },
    results,
    timestamp: new Date().toISOString(),
    environment: {
      usProvider: process.env.US_STOCK_PROVIDER || 'not set',
      idxProvider: process.env.IDX_STOCK_PROVIDER || 'not set',
      hasTwelveDataKey: !!process.env.TWELVE_DATA_API_KEY,
      runtime: process.env.VERCEL ? 'vercel' : 'local',
    },
  });
}