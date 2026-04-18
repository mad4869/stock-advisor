import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const usProvider = process.env.US_STOCK_PROVIDER || 'mock';
  const idxProvider = process.env.IDX_STOCK_PROVIDER || 'mock';

  const status: any = {
    us: { provider: usProvider, status: 'unknown' },
    idx: { provider: idxProvider, status: 'unknown' },
  };

  // Test US provider
  if (usProvider === 'mock') {
    status.us = { provider: 'mock', status: 'mock', message: 'Mock data' };
  } else if (usProvider === 'twelvedata') {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      status.us = { provider: 'twelvedata', status: 'error', message: 'API key missing' };
    } else {
      try {
        const res = await fetch(
          `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${apiKey}`
        );
        const data = await res.json();
        status.us = data.close
          ? { provider: 'twelvedata', status: 'connected', message: 'OK' }
          : { provider: 'twelvedata', status: 'error', message: data.message };
      } catch (e: any) {
        status.us = { provider: 'twelvedata', status: 'error', message: e.message };
      }
    }
  }

  // Test IDX provider
  if (idxProvider === 'mock') {
    status.idx = { provider: 'mock', status: 'mock', message: 'Mock data' };
  } else if (idxProvider === 'idxscraper') {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK?range=1d&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const data = await res.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      status.idx = price
        ? { provider: 'idxscraper', status: 'connected', message: `OK (BBCA: Rp${Math.round(price)})` }
        : { provider: 'idxscraper', status: 'error', message: 'No data returned' };
    } catch (e: any) {
      status.idx = { provider: 'idxscraper', status: 'error', message: e.message };
    }
  } else if (idxProvider === 'goapi') {
    const apiKey = process.env.GOAPI_API_KEY;
    if (!apiKey) {
      status.idx = { provider: 'goapi', status: 'error', message: 'API key missing' };
    } else {
      status.idx = { provider: 'goapi', status: 'connected', message: 'Key configured' };
    }
  }

  // Combined status
  const overallProvider = `US: ${status.us.provider} | IDX: ${status.idx.provider}`;
  const overallStatus =
    status.us.status === 'error' || status.idx.status === 'error'
      ? 'error'
      : status.us.status === 'mock' && status.idx.status === 'mock'
        ? 'mock'
        : 'connected';

  return NextResponse.json({
    provider: overallProvider,
    status: overallStatus,
    message: `US: ${status.us.message} | IDX: ${status.idx.message}`,
    details: status,
  });
}