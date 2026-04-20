import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function testYahoo(symbol: string, suffix: string = ''): Promise<{ ok: boolean; price?: number; error?: string }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?range=1d&interval=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price ? { ok: true, price } : { ok: false, error: 'No price data' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function GET() {
  const usProvider = process.env.US_STOCK_PROVIDER || 'yahoo';
  const idxProvider = process.env.IDX_STOCK_PROVIDER || 'yahoo';

  const status: any = {
    us: { provider: usProvider, status: 'unknown', message: '' },
    idx: { provider: idxProvider, status: 'unknown', message: '' },
  };

  // Test US
  if (usProvider === 'mock') {
    status.us = { provider: 'mock', status: 'mock', message: 'Mock data' };
  } else if (usProvider === 'yahoo') {
    const result = await testYahoo('AAPL');
    status.us = result.ok
      ? { provider: 'yahoo', status: 'connected', message: `OK (AAPL: $${result.price})` }
      : { provider: 'yahoo', status: 'error', message: result.error };
  } else if (usProvider === 'twelvedata') {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      status.us = { provider: 'twelvedata', status: 'error', message: 'No API key' };
    } else {
      try {
        const res = await fetch(`https://api.twelvedata.com/quote?symbol=AAPL&apikey=${apiKey}`);
        const data = await res.json();
        status.us = data.close
          ? { provider: 'twelvedata', status: 'connected', message: `OK (8 req/min limit)` }
          : { provider: 'twelvedata', status: 'error', message: data.message };
      } catch (e: any) {
        status.us = { provider: 'twelvedata', status: 'error', message: e.message };
      }
    }
  }

  // Test IDX
  if (idxProvider === 'mock') {
    status.idx = { provider: 'mock', status: 'mock', message: 'Mock data' };
  } else if (idxProvider === 'yahoo') {
    const result = await testYahoo('BBCA', '.JK');
    status.idx = result.ok
      ? { provider: 'yahoo', status: 'connected', message: `OK (BBCA: Rp${Math.round(result.price!)})` }
      : { provider: 'yahoo', status: 'error', message: result.error };
  } else if (idxProvider === 'twelvedata') {
    status.idx = { provider: 'twelvedata', status: 'connected', message: '(limited IDX coverage)' };
  }

  const overallStatus =
    status.us.status === 'error' || status.idx.status === 'error'
      ? 'error'
      : status.us.status === 'mock' && status.idx.status === 'mock'
        ? 'mock'
        : 'connected';

  return NextResponse.json({
    provider: `US: ${status.us.provider} | IDX: ${status.idx.provider}`,
    status: overallStatus,
    message: `US: ${status.us.message} | IDX: ${status.idx.message}`,
    details: status,
  });
}