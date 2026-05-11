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
  const status: any = {
    us: { provider: 'yahoo', status: 'unknown', message: '' },
    idx: { provider: 'yahoo', status: 'unknown', message: '' },
  };

  // Test US
  const usResult = await testYahoo('AAPL');
  status.us = usResult.ok
    ? { provider: 'yahoo', status: 'connected', message: `OK (AAPL: $${usResult.price})` }
    : { provider: 'yahoo', status: 'error', message: usResult.error };

  // Test IDX
  const idxResult = await testYahoo('BBCA', '.JK');
  status.idx = idxResult.ok
    ? { provider: 'yahoo', status: 'connected', message: `OK (BBCA: Rp${Math.round(idxResult.price!)})` }
    : { provider: 'yahoo', status: 'error', message: idxResult.error };

  const overallStatus =
    status.us.status === 'error' || status.idx.status === 'error'
      ? 'error'
      : 'connected';

  return NextResponse.json({
    provider: 'Yahoo Finance',
    status: overallStatus,
    message: `US: ${status.us.message} | IDX: ${status.idx.message}`,
    details: status,
  });
}