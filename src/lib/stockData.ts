import { StockQuote, HistoricalData, Market, PopularStock } from '@/types';

// ============================================================
// DUAL-PROVIDER PATTERN
// Different provider for US vs Indonesian market
// ============================================================

type USProvider = 'twelvedata' | 'mock';
type IDXProvider = 'goapi' | 'idxscraper' | 'mock';

function getUSProvider(): USProvider {
  return (process.env.US_STOCK_PROVIDER || 'mock') as USProvider;
}

function getIDXProvider(): IDXProvider {
  return (process.env.IDX_STOCK_PROVIDER || 'mock') as IDXProvider;
}

// ============================================================
// PUBLIC API
// ============================================================

export async function getStockQuote(symbol: string, market: Market): Promise<StockQuote> {
  const cleanSymbol = cleanStockSymbol(symbol);

  if (market === 'US') {
    const provider = getUSProvider();
    switch (provider) {
      case 'twelvedata': return getTwelveDataQuote(cleanSymbol);
      default: return getMockQuote(cleanSymbol, market);
    }
  } else {
    const provider = getIDXProvider();
    switch (provider) {
      case 'goapi': return getGoAPIQuote(cleanSymbol);
      case 'idxscraper': return getIDXScraperQuote(cleanSymbol);
      default: return getMockQuote(cleanSymbol, market);
    }
  }
}

export async function getHistoricalData(
  symbol: string,
  market: Market,
  months: number = 12
): Promise<HistoricalData[]> {
  const cleanSymbol = cleanStockSymbol(symbol);

  if (market === 'US') {
    const provider = getUSProvider();
    switch (provider) {
      case 'twelvedata': return getTwelveDataHistorical(cleanSymbol, months);
      default: return getMockHistoricalData(cleanSymbol, market, months);
    }
  } else {
    const provider = getIDXProvider();
    switch (provider) {
      case 'goapi': return getGoAPIHistorical(cleanSymbol, months);
      case 'idxscraper': return getIDXScraperHistorical(cleanSymbol, months);
      default: return getMockHistoricalData(cleanSymbol, market, months);
    }
  }
}

export async function searchStocks(
  query: string,
  market?: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  const results: { symbol: string; name: string; market: Market }[] = [];

  if (!market || market === 'US') {
    const usProvider = getUSProvider();
    if (usProvider === 'twelvedata') {
      const usResults = await searchTwelveData(query);
      results.push(...usResults);
    } else {
      results.push(...(await searchMock(query, 'US')));
    }
  }

  if (!market || market === 'ID') {
    const idxProvider = getIDXProvider();
    if (idxProvider === 'goapi' || idxProvider === 'idxscraper') {
      const idxResults = await searchIDX(query);
      results.push(...idxResults);
    } else {
      results.push(...(await searchMock(query, 'ID')));
    }
  }

  return results.slice(0, 10);
}

// ============================================================
// HELPERS
// ============================================================

function cleanStockSymbol(symbol: string): string {
  return symbol.toUpperCase().replace('.JK', '').replace('.JKT', '').trim();
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// TWELVE DATA — US STOCKS ONLY
// ============================================================

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

function getTwelveDataKey(): string {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error('TWELVE_DATA_API_KEY is not set. Add it to .env.local');
  return key;
}

async function getTwelveDataQuote(symbol: string): Promise<StockQuote> {
  const apiKey = getTwelveDataKey();
  const url = `${TWELVE_DATA_BASE}/quote?symbol=${symbol}&apikey=${apiKey}`;

  console.log(`[TwelveData] Quote: ${symbol}`);

  const res = await fetchWithTimeout(url);
  const data = await res.json();

  if (data.code || data.status === 'error') {
    throw new Error(data.message || `Twelve Data error for ${symbol}`);
  }

  const price = parseFloat(data.close) || 0;
  const prevClose = parseFloat(data.previous_close) || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol,
    name: data.name || symbol,
    market: 'US',
    price: Math.round(price * 100) / 100,
    currency: 'USD',
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: parseInt(data.volume) || 0,
    high52Week: data.fifty_two_week?.high ? parseFloat(data.fifty_two_week.high) : undefined,
    low52Week: data.fifty_two_week?.low ? parseFloat(data.fifty_two_week.low) : undefined,
  };
}

async function getTwelveDataHistorical(symbol: string, months: number): Promise<HistoricalData[]> {
  const apiKey = getTwelveDataKey();
  const outputSize = Math.min(months * 22, 500);
  const url = `${TWELVE_DATA_BASE}/time_series?symbol=${symbol}&interval=1day&outputsize=${outputSize}&order=ASC&apikey=${apiKey}`;

  console.log(`[TwelveData] Historical: ${symbol} (${months}mo)`);

  const res = await fetchWithTimeout(url);
  const data = await res.json();

  if (data.code || data.status === 'error') {
    throw new Error(data.message || `Twelve Data historical error for ${symbol}`);
  }

  if (!data.values || !Array.isArray(data.values)) {
    throw new Error(`No historical data for ${symbol}`);
  }

  return data.values.map((item: any) => ({
    date: new Date(item.datetime),
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseInt(item.volume) || 0,
  }));
}

async function searchTwelveData(
  query: string
): Promise<{ symbol: string; name: string; market: Market }[]> {
  try {
    const apiKey = getTwelveDataKey();
    const url = `${TWELVE_DATA_BASE}/symbol_search?symbol=${query}&outputsize=10&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();

    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data
      .filter((item: any) =>
        item.instrument_type === 'Common Stock' &&
        (item.exchange === 'NYSE' || item.exchange === 'NASDAQ' || item.country === 'United States')
      )
      .slice(0, 10)
      .map((item: any) => ({
        symbol: item.symbol,
        name: item.instrument_name || item.symbol,
        market: 'US' as Market,
      }));
  } catch {
    return [];
  }
}

// ============================================================
// GoAPI.id — INDONESIAN STOCKS
// Docs: https://goapi.id/api/stock-api
// Free: 500 requests/month
// ============================================================

function getGoAPIKey(): string {
  const key = process.env.GOAPI_API_KEY;
  if (!key) throw new Error('GOAPI_API_KEY is not set. Get one free at https://goapi.id');
  return key;
}

async function getGoAPIQuote(symbol: string): Promise<StockQuote> {
  const apiKey = getGoAPIKey();
  const url = `https://api.goapi.id/v1/stock/idx/${symbol}/profile`;

  console.log(`[GoAPI] Quote: ${symbol}`);

  const res = await fetchWithTimeout(url, {
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });
  const data = await res.json();

  if (data.error || !data.data) {
    // Try price endpoint
    const priceUrl = `https://api.goapi.id/v1/stock/idx/${symbol}/price`;
    const priceRes = await fetchWithTimeout(priceUrl, {
      headers: { 'X-API-KEY': apiKey, 'Accept': 'application/json' },
    });
    const priceData = await priceRes.json();

    if (priceData.error || !priceData.data) {
      throw new Error(`GoAPI: Stock ${symbol} not found`);
    }

    const price = priceData.data.close || priceData.data.price || 0;
    const prevClose = priceData.data.previous_close || price;
    const change = price - prevClose;

    return {
      symbol,
      name: symbol,
      market: 'ID',
      price: Math.round(price),
      currency: 'IDR',
      change: Math.round(change),
      changePercent: prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0,
      volume: priceData.data.volume || 0,
    };
  }

  const profile = data.data;
  const price = profile.close || profile.last || profile.price || 0;
  const prevClose = profile.previous_close || profile.prev_close || price;
  const change = price - prevClose;

  return {
    symbol,
    name: profile.name || profile.company_name || symbol,
    market: 'ID',
    price: Math.round(price),
    currency: 'IDR',
    change: Math.round(change),
    changePercent: prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0,
    volume: profile.volume || 0,
    marketCap: profile.market_cap,
  };
}

async function getGoAPIHistorical(symbol: string, months: number): Promise<HistoricalData[]> {
  const apiKey = getGoAPIKey();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const from = startDate.toISOString().split('T')[0];
  const to = endDate.toISOString().split('T')[0];

  const url = `https://api.goapi.id/v1/stock/idx/${symbol}/historical?from=${from}&to=${to}`;

  console.log(`[GoAPI] Historical: ${symbol} (${from} to ${to})`);

  const res = await fetchWithTimeout(url, {
    headers: { 'X-API-KEY': apiKey, 'Accept': 'application/json' },
  });
  const data = await res.json();

  if (data.error || !data.data || !data.data.results) {
    throw new Error(`GoAPI: No historical data for ${symbol}`);
  }

  return data.data.results
    .map((item: any) => ({
      date: new Date(item.date),
      open: parseFloat(item.open) || 0,
      high: parseFloat(item.high) || 0,
      low: parseFloat(item.low) || 0,
      close: parseFloat(item.close) || 0,
      volume: parseInt(item.volume) || 0,
    }))
    .sort((a: HistoricalData, b: HistoricalData) => a.date.getTime() - b.date.getTime());
}

// ============================================================
// IDX SCRAPER — FREE, NO API KEY NEEDED
// Uses public endpoints from various free sources
// ============================================================

async function getIDXScraperQuote(symbol: string): Promise<StockQuote> {
  console.log(`[IDXScraper] Quote: ${symbol}`);

  // Strategy 1: Use a free proxy to Yahoo Finance for IDX
  try {
    const quote = await fetchYahooProxy(symbol);
    if (quote) return quote;
  } catch (e) {
    console.log(`[IDXScraper] Yahoo proxy failed: ${e}`);
  }

  // Strategy 2: Use stockbit public API
  try {
    const quote = await fetchStockbitPublic(symbol);
    if (quote) return quote;
  } catch (e) {
    console.log(`[IDXScraper] Stockbit failed: ${e}`);
  }

  // Strategy 3: Use Sectors Financial
  try {
    const quote = await fetchSectorsFinancial(symbol);
    if (quote) return quote;
  } catch (e) {
    console.log(`[IDXScraper] Sectors failed: ${e}`);
  }

  throw new Error(`Could not fetch quote for IDX:${symbol} from any source`);
}

async function fetchYahooProxy(symbol: string): Promise<StockQuote | null> {
  // Use a CORS-friendly Yahoo Finance proxy
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.JK?range=5d&interval=1d`;

  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const price = meta.regularMarketPrice || 0;
  const prevClose = meta.chartPreviousClose || meta.previousClose || price;
  const change = price - prevClose;

  return {
    symbol: symbol.toUpperCase(),
    name: meta.longName || meta.shortName || symbol,
    market: 'ID',
    price: Math.round(price),
    currency: 'IDR',
    change: Math.round(change),
    changePercent: prevClose > 0 ? Math.round((change / prevClose) * 10000) / 100 : 0,
    volume: meta.regularMarketVolume || 0,
    high52Week: meta.fiftyTwoWeekHigh,
    low52Week: meta.fiftyTwoWeekLow,
  };
}

async function fetchStockbitPublic(symbol: string): Promise<StockQuote | null> {
  // Stockbit has a public API for basic data
  const url = `https://exodus.stockbit.com/api/companies/detail/${symbol}`;

  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const company = data?.data?.company;
  if (!company) return null;

  const price = company.price || 0;
  const change = company.change || 0;
  const changePercent = company.percent || 0;

  return {
    symbol: symbol.toUpperCase(),
    name: company.name || symbol,
    market: 'ID',
    price: Math.round(price),
    currency: 'IDR',
    change: Math.round(change),
    changePercent: Math.round(changePercent * 100) / 100,
    volume: company.volume || 0,
    marketCap: company.market_cap,
  };
}

async function fetchSectorsFinancial(symbol: string): Promise<StockQuote | null> {
  const url = `https://api.sectors.app/v1/company/report/${symbol}/?sections=overview`;

  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data || data.error) return null;

  const overview = data.overview || data;
  const price = overview.last_close_price || overview.price || 0;

  return {
    symbol: symbol.toUpperCase(),
    name: overview.company_name || symbol,
    market: 'ID',
    price: Math.round(price),
    currency: 'IDR',
    change: 0,
    changePercent: 0,
    volume: overview.volume || 0,
    marketCap: overview.market_cap,
  };
}

async function getIDXScraperHistorical(
  symbol: string,
  months: number
): Promise<HistoricalData[]> {
  console.log(`[IDXScraper] Historical: ${symbol} (${months}mo)`);

  // Use Yahoo Finance chart API (works server-side)
  try {
    const period1 = Math.floor(Date.now() / 1000 - months * 30 * 24 * 60 * 60);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.JK?period1=${period1}&period2=${period2}&interval=1d`;

    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result || !result.timestamp) {
      throw new Error('No chart data');
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];

    if (!quotes) throw new Error('No quote data in chart');

    const historicalData: HistoricalData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const open = quotes.open?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const close = quotes.close?.[i];
      const volume = quotes.volume?.[i];

      // Skip null entries
      if (open == null || close == null) continue;

      historicalData.push({
        date: new Date(timestamps[i] * 1000),
        open: Math.round(open),
        high: Math.round(high || open),
        low: Math.round(low || open),
        close: Math.round(close),
        volume: volume || 0,
      });
    }

    if (historicalData.length === 0) {
      throw new Error('No valid historical entries');
    }

    return historicalData;
  } catch (e: any) {
    console.error(`[IDXScraper] Historical failed for ${symbol}: ${e.message}`);

    // Fallback to mock data so the app doesn't crash
    console.log(`[IDXScraper] Falling back to mock historical data for ${symbol}`);
    return getMockHistoricalData(symbol, 'ID', months);
  }
}

async function searchIDX(
  query: string
): Promise<{ symbol: string; name: string; market: Market }[]> {
  // Search through our known IDX stocks + try external search
  const q = query.toUpperCase();

  // First: search our local list
  const localResults = IDX_STOCK_LIST
    .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
    .slice(0, 10)
    .map((s) => ({ ...s, market: 'ID' as Market }));

  if (localResults.length > 0) return localResults;

  // If nothing found locally, try Yahoo search
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=10&newsCount=0`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.quotes || [])
      .filter((q: any) => q.symbol?.endsWith('.JK'))
      .slice(0, 10)
      .map((q: any) => ({
        symbol: q.symbol.replace('.JK', ''),
        name: q.longname || q.shortname || q.symbol,
        market: 'ID' as Market,
      }));
  } catch {
    return [];
  }
}

// ============================================================
// COMPREHENSIVE IDX STOCK LIST
// ============================================================

const IDX_STOCK_LIST: { symbol: string; name: string }[] = [
  // Banks
  { symbol: 'BBCA', name: 'Bank Central Asia' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia' },
  { symbol: 'BMRI', name: 'Bank Mandiri' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia' },
  { symbol: 'BRIS', name: 'Bank Syariah Indonesia' },
  { symbol: 'BTPS', name: 'Bank BTPN Syariah' },
  { symbol: 'MEGA', name: 'Bank Mega' },
  { symbol: 'NISP', name: 'Bank OCBC NISP' },
  { symbol: 'BNGA', name: 'Bank CIMB Niaga' },
  { symbol: 'BDMN', name: 'Bank Danamon' },
  // Telco & Tech
  { symbol: 'TLKM', name: 'Telkom Indonesia' },
  { symbol: 'EXCL', name: 'XL Axiata' },
  { symbol: 'ISAT', name: 'Indosat Ooredoo' },
  { symbol: 'EMTK', name: 'Elang Mahkota Teknologi' },
  { symbol: 'TOWR', name: 'Sarana Menara Nusantara' },
  { symbol: 'TBIG', name: 'Tower Bersama Infrastructure' },
  // Consumer
  { symbol: 'ASII', name: 'Astra International' },
  { symbol: 'UNVR', name: 'Unilever Indonesia' },
  { symbol: 'ICBP', name: 'Indofood CBP' },
  { symbol: 'INDF', name: 'Indofood Sukses Makmur' },
  { symbol: 'HMSP', name: 'HM Sampoerna' },
  { symbol: 'GGRM', name: 'Gudang Garam' },
  { symbol: 'KLBF', name: 'Kalbe Farma' },
  { symbol: 'MYOR', name: 'Mayora Indah' },
  { symbol: 'CPIN', name: 'Charoen Pokphand Indonesia' },
  { symbol: 'SIDO', name: 'Industri Jamu Sido Muncul' },
  { symbol: 'ACES', name: 'Ace Hardware Indonesia' },
  { symbol: 'AMRT', name: 'Sumber Alfaria Trijaya' },
  // Mining & Energy
  { symbol: 'ADRO', name: 'Adaro Energy' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah' },
  { symbol: 'PTBA', name: 'Bukit Asam' },
  { symbol: 'ANTM', name: 'Aneka Tambang' },
  { symbol: 'INCO', name: 'Vale Indonesia' },
  { symbol: 'MDKA', name: 'Merdeka Copper Gold' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara' },
  { symbol: 'MEDC', name: 'Medco Energi' },
  { symbol: 'ESSA', name: 'Surya Esa Perkasa' },
  // Property & Construction
  { symbol: 'BSDE', name: 'Bumi Serpong Damai' },
  { symbol: 'CTRA', name: 'Ciputra Development' },
  { symbol: 'SMRA', name: 'Summarecon Agung' },
  { symbol: 'PWON', name: 'Pakuwon Jati' },
  { symbol: 'WIKA', name: 'Wijaya Karya' },
  { symbol: 'PTPP', name: 'PP (Persero)' },
  { symbol: 'WSKT', name: 'Waskita Karya' },
  // Industrial
  { symbol: 'SMGR', name: 'Semen Indonesia' },
  { symbol: 'INKP', name: 'Indah Kiat Pulp & Paper' },
  { symbol: 'TKIM', name: 'Pabrik Kertas Tjiwi Kimia' },
  { symbol: 'BRPT', name: 'Barito Pacific' },
  { symbol: 'TPIA', name: 'Chandra Asri Petrochemical' },
  // Others
  { symbol: 'ERAA', name: 'Erajaya Swasembada' },
  { symbol: 'MAPI', name: 'Mitra Adiperkasa' },
  { symbol: 'ARTO', name: 'Bank Jago' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia' },
  { symbol: 'BUKA', name: 'Bukalapak' },
  { symbol: 'PGEO', name: 'Pertamina Geothermal Energy' },
];

// ============================================================
// MOCK PROVIDER
// ============================================================

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash & 2147483647) / 2147483647;
  };
}

const MOCK_PRICES: Record<string, number> = {
  // US
  AAPL: 185.50, MSFT: 415.20, GOOGL: 155.80, AMZN: 185.60, NVDA: 725.00,
  META: 505.75, TSLA: 238.45, JPM: 198.50, V: 280.30, JNJ: 158.20,
  // IDX (IDR)
  BBCA: 9575, BBRI: 5725, BMRI: 6350, TLKM: 3850, ASII: 5225,
  UNVR: 2910, HMSP: 810, ICBP: 10400, KLBF: 1555, EMTK: 490,
  ITMG: 27350, ADRO: 2660, ANTM: 1545, INDF: 6475, GGRM: 24000,
  PGAS: 1500, MDKA: 2440, CPIN: 5050, EXCL: 2410, BRPT: 1045,
  BBNI: 5425, GOTO: 76, BUKA: 164, ARTO: 2650, TOWR: 1025,
};

async function getMockQuote(symbol: string, market: Market): Promise<StockQuote> {
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  const s = symbol.toUpperCase();
  const basePrice = MOCK_PRICES[s] || (market === 'ID' ? 5000 : 150);

  const rand = seededRandom(s + new Date().toDateString());
  const changePercent = (rand() - 0.48) * 4;
  const change = basePrice * (changePercent / 100);
  const price = basePrice + change;

  const stockName =
    IDX_STOCK_LIST.find((st) => st.symbol === s)?.name ||
    POPULAR_STOCKS.find((st) => st.symbol === s)?.name ||
    `${s} Corp.`;

  return {
    symbol: s,
    name: stockName,
    market,
    price: market === 'ID' ? Math.round(price) : Math.round(price * 100) / 100,
    currency: market === 'ID' ? 'IDR' : 'USD',
    change: market === 'ID' ? Math.round(change) : Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: Math.round(rand() * 50000000 + 1000000),
    marketCap: Math.round(basePrice * 1000000 * (rand() * 1000 + 100)),
    high52Week: Math.round(basePrice * 1.35),
    low52Week: Math.round(basePrice * 0.65),
  };
}

async function getMockHistoricalData(
  symbol: string,
  market: Market,
  months: number
): Promise<HistoricalData[]> {
  await new Promise((r) => setTimeout(r, 150));

  const s = symbol.toUpperCase();
  const basePrice = MOCK_PRICES[s] || (market === 'ID' ? 5000 : 150);
  const data: HistoricalData[] = [];
  const tradingDays = months * 21;
  const rand = seededRandom(s + 'hist');

  let currentPrice = basePrice * (0.8 + rand() * 0.4);

  for (let i = tradingDays; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - Math.round(i * 1.4));
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = (rand() - 0.48) * 0.03;
    currentPrice *= 1 + dailyReturn;
    currentPrice = Math.max(currentPrice, basePrice * 0.3);

    const dayRange = currentPrice * (0.005 + rand() * 0.025);
    const open = currentPrice + (rand() - 0.5) * dayRange;
    const high = Math.max(open, currentPrice) + rand() * dayRange;
    const low = Math.min(open, currentPrice) - rand() * dayRange;
    const vol = Math.round((500000 + rand() * 30000000) * (market === 'ID' ? 10 : 1));

    const round = (v: number) =>
      market === 'ID' ? Math.round(v) : Math.round(v * 100) / 100;

    data.push({
      date,
      open: round(open),
      high: round(high),
      low: round(Math.max(low, 1)),
      close: round(currentPrice),
      volume: vol,
    });
  }

  return data;
}

async function searchMock(
  query: string,
  market: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  await new Promise((r) => setTimeout(r, 100));

  const q = query.toUpperCase();

  if (market === 'ID') {
    return IDX_STOCK_LIST
      .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
      .slice(0, 10)
      .map((s) => ({ ...s, market: 'ID' as Market }));
  }

  return POPULAR_STOCKS
    .filter((s) => s.market === 'US')
    .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
    .slice(0, 10)
    .map((s) => ({ symbol: s.symbol, name: s.name, market: 'US' as Market }));
}

// ============================================================
// POPULAR STOCKS LIST
// ============================================================

export const POPULAR_STOCKS: PopularStock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', market: 'US', sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'US', sector: 'Healthcare' },
  { symbol: 'BBCA', name: 'Bank Central Asia', market: 'ID', sector: 'Financial' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', market: 'ID', sector: 'Financial' },
  { symbol: 'BMRI', name: 'Bank Mandiri', market: 'ID', sector: 'Financial' },
  { symbol: 'TLKM', name: 'Telkom Indonesia', market: 'ID', sector: 'Telecom' },
  { symbol: 'ASII', name: 'Astra International', market: 'ID', sector: 'Consumer Cyclical' },
  { symbol: 'UNVR', name: 'Unilever Indonesia', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'HMSP', name: 'HM Sampoerna', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'ICBP', name: 'Indofood CBP', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'KLBF', name: 'Kalbe Farma', market: 'ID', sector: 'Healthcare' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah', market: 'ID', sector: 'Energy' },
];