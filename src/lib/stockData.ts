import { StockQuote, HistoricalData, Market, PopularStock } from '@/types';
import { quoteCache, historyCache, searchCache, CACHE_TTL } from './cache';
import { yahooLimiter, twelveDataLimiter } from './rateLimiter';

// ============================================================
// PROVIDER CONFIG
// ============================================================

type Provider = 'yahoo' | 'twelvedata' | 'mock';

function getUSProvider(): Provider {
  return (process.env.US_STOCK_PROVIDER || 'yahoo') as Provider;
}

function getIDXProvider(): Provider {
  return (process.env.IDX_STOCK_PROVIDER || 'yahoo') as Provider;
}

function getProvider(market: Market): Provider {
  return market === 'ID' ? getIDXProvider() : getUSProvider();
}

// ============================================================
// PUBLIC API
// ============================================================

export async function getStockQuote(symbol: string, market: Market): Promise<StockQuote> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `quote:${clean}:${market}`;

  // Check cache first
  const cached = quoteCache.get<StockQuote>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] Quote: ${clean} (${market})`);
    return cached;
  }

  const provider = getProvider(market);
  let quote: StockQuote;

  try {
    switch (provider) {
      case 'yahoo':
        quote = await getYahooQuote(clean, market);
        break;
      case 'twelvedata':
        quote = await getTwelveDataQuote(clean, market);
        break;
      default:
        quote = await getMockQuote(clean, market);
    }
  } catch (error: any) {
    console.error(`[${provider}] Quote failed for ${clean}: ${error.message}`);

    // Fallback chain: yahoo → twelvedata → mock
    if (provider === 'yahoo') {
      try {
        console.log(`[Fallback] Trying twelvedata for ${clean}...`);
        quote = await getTwelveDataQuote(clean, market);
      } catch {
        console.log(`[Fallback] Using mock for ${clean}`);
        quote = await getMockQuote(clean, market);
      }
    } else if (provider === 'twelvedata') {
      try {
        console.log(`[Fallback] Trying yahoo for ${clean}...`);
        quote = await getYahooQuote(clean, market);
      } catch {
        console.log(`[Fallback] Using mock for ${clean}`);
        quote = await getMockQuote(clean, market);
      }
    } else {
      quote = await getMockQuote(clean, market);
    }
  }

  quoteCache.set(cacheKey, quote, CACHE_TTL.QUOTE);
  return quote;
}

export async function getHistoricalData(
  symbol: string,
  market: Market,
  months: number = 12
): Promise<HistoricalData[]> {
  const clean = cleanSymbol(symbol);
  const cacheKey = `history:${clean}:${market}:${months}`;

  const cached = historyCache.get<HistoricalData[]>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] History: ${clean} (${market}, ${months}mo)`);
    return cached;
  }

  const provider = getProvider(market);
  let data: HistoricalData[];

  try {
    switch (provider) {
      case 'yahoo':
        data = await getYahooHistorical(clean, market, months);
        break;
      case 'twelvedata':
        data = await getTwelveDataHistorical(clean, market, months);
        break;
      default:
        data = await getMockHistoricalData(clean, market, months);
    }
  } catch (error: any) {
    console.error(`[${provider}] Historical failed for ${clean}: ${error.message}`);

    // Fallback chain
    if (provider === 'yahoo') {
      try {
        data = await getTwelveDataHistorical(clean, market, months);
      } catch {
        data = await getMockHistoricalData(clean, market, months);
      }
    } else if (provider === 'twelvedata') {
      try {
        data = await getYahooHistorical(clean, market, months);
      } catch {
        data = await getMockHistoricalData(clean, market, months);
      }
    } else {
      data = await getMockHistoricalData(clean, market, months);
    }
  }

  historyCache.set(cacheKey, data, CACHE_TTL.HISTORICAL);
  return data;
}

export async function searchStocks(
  query: string,
  market?: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `search:${q}:${market || 'all'}`;
  const cached = searchCache.get<{ symbol: string; name: string; market: Market }[]>(cacheKey);
  if (cached) return cached;

  let results: { symbol: string; name: string; market: Market }[] = [];

  try {
    // Yahoo search works for ALL markets and is free
    results = await searchYahoo(q, market);
  } catch {
    // Fallback to local search
    results = searchLocal(q, market);
  }

  // If Yahoo returned nothing, supplement with local results
  if (results.length === 0) {
    results = searchLocal(q, market);
  }

  searchCache.set(cacheKey, results, CACHE_TTL.SEARCH);
  return results;
}

// ============================================================
// HELPERS
// ============================================================

function cleanSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace('.JK', '')
    .replace('.JKT', '')
    .replace(/\s+/g, '')
    .trim();
}

function yahooSymbol(symbol: string, market: Market): string {
  const clean = cleanSymbol(symbol);
  return market === 'ID' ? `${clean}.JK` : clean;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
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
// YAHOO FINANCE PROVIDER (Free, No API Key, Full Coverage)
//
// Uses the v8 chart API which:
// - Works server-side without authentication
// - Covers ALL US stocks (NYSE, NASDAQ, AMEX)
// - Covers ALL Indonesian stocks (.JK suffix)
// - No hard rate limit (but we self-throttle to be polite)
// - Returns both quotes and historical data
// ============================================================

const YAHOO_BASE = 'https://query1.finance.yahoo.com';

async function yahooFetch(url: string): Promise<any> {
  return yahooLimiter.execute(async () => {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json();
  });
}

async function getYahooQuote(symbol: string, market: Market): Promise<StockQuote> {
  const ySymbol = yahooSymbol(symbol, market);
  console.log(`[Yahoo] Quote: ${ySymbol}`);

  // Use chart API with range=1d for current quote
  const url = `${YAHOO_BASE}/v8/finance/chart/${ySymbol}?range=5d&interval=1d&includePrePost=false`;
  const data = await yahooFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo: No data for ${ySymbol}`);
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: cleanSymbol(symbol),
    name: meta.longName || meta.shortName || cleanSymbol(symbol),
    market,
    price: market === 'ID' ? Math.round(price) : Math.round(price * 100) / 100,
    currency: market === 'ID' ? 'IDR' : meta.currency || 'USD',
    change: market === 'ID' ? Math.round(change) : Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: meta.regularMarketVolume || 0,
    high52Week: meta.fiftyTwoWeekHigh,
    low52Week: meta.fiftyTwoWeekLow,
  };
}

async function getYahooHistorical(
  symbol: string,
  market: Market,
  months: number
): Promise<HistoricalData[]> {
  const ySymbol = yahooSymbol(symbol, market);
  const period1 = Math.floor(Date.now() / 1000 - months * 30.44 * 24 * 60 * 60);
  const period2 = Math.floor(Date.now() / 1000);

  console.log(`[Yahoo] Historical: ${ySymbol} (${months}mo)`);

  const url = `${YAHOO_BASE}/v8/finance/chart/${ySymbol}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`;
  const data = await yahooFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp) {
    throw new Error(`Yahoo: No historical data for ${ySymbol}`);
  }

  const timestamps: number[] = result.timestamp;
  const quotes = result.indicators?.quote?.[0];
  if (!quotes) {
    throw new Error(`Yahoo: No OHLCV data for ${ySymbol}`);
  }

  const historicalData: HistoricalData[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quotes.open?.[i];
    const high = quotes.high?.[i];
    const low = quotes.low?.[i];
    const close = quotes.close?.[i];
    const volume = quotes.volume?.[i];

    // Yahoo sometimes returns null for certain days
    if (open == null || high == null || low == null || close == null) continue;

    const roundFn = (v: number) =>
      market === 'ID' ? Math.round(v) : Math.round(v * 100) / 100;

    historicalData.push({
      date: new Date(timestamps[i] * 1000),
      open: roundFn(open),
      high: roundFn(high),
      low: roundFn(low),
      close: roundFn(close),
      volume: volume || 0,
    });
  }

  if (historicalData.length === 0) {
    throw new Error(`Yahoo: Empty historical data for ${ySymbol}`);
  }

  return historicalData;
}

async function searchYahoo(
  query: string,
  market?: Market
): Promise<{ symbol: string; name: string; market: Market }[]> {
  console.log(`[Yahoo] Search: "${query}" market=${market || 'all'}`);

  const url = `${YAHOO_BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0&listsCount=0`;
  const data = await yahooFetch(url);

  const quotes = data?.quotes;
  if (!quotes || !Array.isArray(quotes)) return [];

  return quotes
    .filter((q: any) => {
      // Only equities
      if (q.quoteType !== 'EQUITY') return false;

      if (!market) return true;

      if (market === 'ID') {
        return q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
      }

      // US: exclude foreign stocks
      return (
        !q.symbol?.includes('.') ||
        q.exchange === 'NYQ' ||
        q.exchange === 'NMS' ||
        q.exchange === 'NGM' ||
        q.exchange === 'NYSE' ||
        q.exchange === 'NASDAQ'
      );
    })
    .slice(0, 10)
    .map((q: any) => {
      const isIDX = q.symbol?.endsWith('.JK') || q.exchange === 'JKT';
      return {
        symbol: q.symbol?.replace('.JK', '') || q.symbol,
        name: q.longname || q.shortname || q.symbol,
        market: isIDX ? ('ID' as Market) : ('US' as Market),
      };
    });
}

// ============================================================
// TWELVE DATA PROVIDER (8 calls/min — rate limited)
// ============================================================

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

function getTwelveDataKey(): string {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error('TWELVE_DATA_API_KEY is not set');
  return key;
}

async function twelveDataFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  return twelveDataLimiter.execute(async () => {
    const apiKey = getTwelveDataKey();
    const searchParams = new URLSearchParams({ ...params, apikey: apiKey });
    const url = `${TWELVE_DATA_BASE}${endpoint}?${searchParams}`;

    console.log(
      `[TwelveData] ${endpoint} | symbol=${params.symbol} | queue=${twelveDataLimiter.pending}`
    );

    const res = await fetchWithTimeout(url);
    const data = await res.json();

    if (data.code && data.code !== 200) {
      throw new Error(data.message || `Twelve Data error: ${data.code}`);
    }
    if (data.status === 'error') {
      throw new Error(data.message || 'Twelve Data error');
    }

    return data;
  });
}

async function getTwelveDataQuote(symbol: string, market: Market): Promise<StockQuote> {
  const params: Record<string, string> = { symbol };
  if (market === 'ID') params.exchange = 'IDX';

  const data = await twelveDataFetch('/quote', params);

  const price = parseFloat(data.close) || 0;
  const prevClose = parseFloat(data.previous_close) || price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol: cleanSymbol(symbol),
    name: data.name || symbol,
    market,
    price: market === 'ID' ? Math.round(price) : Math.round(price * 100) / 100,
    currency: market === 'ID' ? 'IDR' : 'USD',
    change: market === 'ID' ? Math.round(change) : Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    volume: parseInt(data.volume) || 0,
    high52Week: data.fifty_two_week?.high ? parseFloat(data.fifty_two_week.high) : undefined,
    low52Week: data.fifty_two_week?.low ? parseFloat(data.fifty_two_week.low) : undefined,
  };
}

async function getTwelveDataHistorical(
  symbol: string,
  market: Market,
  months: number
): Promise<HistoricalData[]> {
  const params: Record<string, string> = {
    symbol,
    interval: '1day',
    outputsize: Math.min(months * 22, 500).toString(),
    order: 'ASC',
  };
  if (market === 'ID') params.exchange = 'IDX';

  const data = await twelveDataFetch('/time_series', params);

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

// ============================================================
// LOCAL SEARCH (for fallback when APIs fail)
// ============================================================

// ✅ FIXED — plain synchronous function, no Promise
function searchLocal(
  query: string,
  market?: Market
): { symbol: string; name: string; market: Market }[] {
  const q = query.toUpperCase();

  const allStocks = [
    ...IDX_FULL_LIST.map((s) => ({ ...s, market: 'ID' as Market })),
    ...POPULAR_STOCKS.map((s) => ({ symbol: s.symbol, name: s.name, market: s.market })),
  ];

  return allStocks
    .filter((s) => {
      const matchesQuery = s.symbol.includes(q) || s.name.toUpperCase().includes(q);
      const matchesMarket = !market || s.market === market;
      return matchesQuery && matchesMarket;
    })
    .slice(0, 10);
}

// ============================================================
// COMPREHENSIVE IDX STOCK LIST
// ============================================================

const IDX_FULL_LIST: { symbol: string; name: string }[] = [
  // ===== LQ45 / Blue Chips =====
  { symbol: 'BBCA', name: 'Bank Central Asia' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia' },
  { symbol: 'BMRI', name: 'Bank Mandiri' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia' },
  { symbol: 'TLKM', name: 'Telkom Indonesia' },
  { symbol: 'ASII', name: 'Astra International' },
  { symbol: 'UNVR', name: 'Unilever Indonesia' },
  { symbol: 'HMSP', name: 'HM Sampoerna' },
  { symbol: 'ICBP', name: 'Indofood CBP Sukses Makmur' },
  { symbol: 'INDF', name: 'Indofood Sukses Makmur' },
  { symbol: 'KLBF', name: 'Kalbe Farma' },
  { symbol: 'GGRM', name: 'Gudang Garam' },
  { symbol: 'SMGR', name: 'Semen Indonesia' },

  // ===== Mining & Energy =====
  { symbol: 'ADRO', name: 'Adaro Energy Indonesia' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah' },
  { symbol: 'PTBA', name: 'Bukit Asam' },
  { symbol: 'ANTM', name: 'Aneka Tambang' },
  { symbol: 'INCO', name: 'Vale Indonesia' },
  { symbol: 'MDKA', name: 'Merdeka Copper Gold' },
  { symbol: 'MEDC', name: 'Medco Energi Internasional' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara' },
  { symbol: 'ESSA', name: 'Surya Esa Perkasa' },
  { symbol: 'HRUM', name: 'Harum Energy' },
  { symbol: 'TINS', name: 'Timah' },
  { symbol: 'BSSR', name: 'Baramulti Suksessarana' },
  { symbol: 'DSSA', name: 'Dian Swastatika Sentosa' },
  { symbol: 'MBAP', name: 'Mitrabara Adiperdana' },
  { symbol: 'GEMS', name: 'Golden Energy Mines' },
  { symbol: 'UNTR', name: 'United Tractors' },
  { symbol: 'ADMR', name: 'Adaro Minerals Indonesia' },
  { symbol: 'PGEO', name: 'Pertamina Geothermal Energy' },

  // ===== Banking =====
  { symbol: 'BRIS', name: 'Bank Syariah Indonesia' },
  { symbol: 'BTPS', name: 'Bank BTPN Syariah' },
  { symbol: 'MEGA', name: 'Bank Mega' },
  { symbol: 'NISP', name: 'Bank OCBC NISP' },
  { symbol: 'BNGA', name: 'Bank CIMB Niaga' },
  { symbol: 'BDMN', name: 'Bank Danamon Indonesia' },
  { symbol: 'ARTO', name: 'Bank Jago' },
  { symbol: 'BBYB', name: 'Bank Neo Commerce' },
  { symbol: 'BNLI', name: 'Bank Permata' },
  { symbol: 'BTPN', name: 'Bank BTPN' },
  { symbol: 'BJTM', name: 'Bank Jatim' },
  { symbol: 'BJBR', name: 'Bank BJB' },

  // ===== Telco & Technology =====
  { symbol: 'EXCL', name: 'XL Axiata' },
  { symbol: 'ISAT', name: 'Indosat Ooredoo Hutchison' },
  { symbol: 'EMTK', name: 'Elang Mahkota Teknologi' },
  { symbol: 'TOWR', name: 'Sarana Menara Nusantara' },
  { symbol: 'TBIG', name: 'Tower Bersama Infrastructure' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia' },
  { symbol: 'BUKA', name: 'Bukalapak.com' },
  { symbol: 'DCII', name: 'DCI Indonesia' },
  { symbol: 'MTDL', name: 'Metrodata Electronics' },

  // ===== Consumer & Retail =====
  { symbol: 'MYOR', name: 'Mayora Indah' },
  { symbol: 'CPIN', name: 'Charoen Pokphand Indonesia' },
  { symbol: 'SIDO', name: 'Industri Jamu Sido Muncul' },
  { symbol: 'ACES', name: 'Ace Hardware Indonesia' },
  { symbol: 'AMRT', name: 'Sumber Alfaria Trijaya' },
  { symbol: 'MAPI', name: 'Mitra Adiperkasa' },
  { symbol: 'ERAA', name: 'Erajaya Swasembada' },
  { symbol: 'LPPF', name: 'Matahari Department Store' },
  { symbol: 'HERO', name: 'Hero Supermarket' },
  { symbol: 'RALS', name: 'Ramayana Lestari Sentosa' },
  { symbol: 'JPFA', name: 'Japfa Comfeed Indonesia' },
  { symbol: 'MAIN', name: 'Malindo Feedmill' },
  { symbol: 'CLEO', name: 'Sariguna Primatirta' },

  // ===== Property & Construction =====
  { symbol: 'BSDE', name: 'Bumi Serpong Damai' },
  { symbol: 'CTRA', name: 'Ciputra Development' },
  { symbol: 'SMRA', name: 'Summarecon Agung' },
  { symbol: 'PWON', name: 'Pakuwon Jati' },
  { symbol: 'WIKA', name: 'Wijaya Karya' },
  { symbol: 'PTPP', name: 'PP (Persero)' },
  { symbol: 'WSKT', name: 'Waskita Karya' },
  { symbol: 'JSMR', name: 'Jasa Marga' },
  { symbol: 'DILD', name: 'Intiland Development' },
  { symbol: 'LPKR', name: 'Lippo Karawaci' },
  { symbol: 'APLN', name: 'Agung Podomoro Land' },

  // ===== Industrial & Manufacturing =====
  { symbol: 'INKP', name: 'Indah Kiat Pulp & Paper' },
  { symbol: 'TKIM', name: 'Pabrik Kertas Tjiwi Kimia' },
  { symbol: 'BRPT', name: 'Barito Pacific' },
  { symbol: 'TPIA', name: 'Chandra Asri Petrochemical' },
  { symbol: 'IMPC', name: 'Impack Pratama Industri' },
  { symbol: 'SRIL', name: 'Sri Rejeki Isman' },
  { symbol: 'AUTO', name: 'Astra Otoparts' },

  // ===== Healthcare & Pharma =====
  { symbol: 'HEAL', name: 'Medikaloka Hermina' },
  { symbol: 'MIKA', name: 'Mitra Keluarga Karyasehat' },
  { symbol: 'SILO', name: 'Siloam International Hospitals' },
  { symbol: 'PRDA', name: 'Prodia Widyahusada' },
  { symbol: 'DVLA', name: 'Darya-Varia Laboratoria' },

  // ===== Plantation & Agriculture =====
  { symbol: 'AALI', name: 'Astra Agro Lestari' },
  { symbol: 'LSIP', name: 'PP London Sumatra Indonesia' },
  { symbol: 'DSNG', name: 'Dharma Satya Nusantara' },

  // ===== Media & Entertainment =====
  { symbol: 'SCMA', name: 'Surya Citra Media' },
  { symbol: 'MNCN', name: 'MNC Studios International' },

  // ===== Finance (Non-Bank) =====
  { symbol: 'ADMF', name: 'Adira Dinamika Multi Finance' },
  { symbol: 'BBLD', name: 'Buana Finance' },
  { symbol: 'PNLF', name: 'Panin Financial' },
  { symbol: 'LIFE', name: 'Asuransi Jiwa Sinarmas MSIG' },

  // ===== Others =====
  { symbol: 'AKRA', name: 'AKR Corporindo' },
  { symbol: 'BNBR', name: 'Bakrie & Brothers' },
  { symbol: 'BUMI', name: 'Bumi Resources' },
  { symbol: 'DEWA', name: 'Darma Henwa' },
  { symbol: 'ELSA', name: 'Elnusa' },
  { symbol: 'GIAA', name: 'Garuda Indonesia' },
  { symbol: 'SSIA', name: 'Surya Semesta Internusa' },
  { symbol: 'TMAS', name: 'Pelayaran Tempuran Emas' },
  { symbol: 'TAPG', name: 'Triputra Agro Persada' },
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
  AAPL: 185.5, MSFT: 415.2, GOOGL: 155.8, AMZN: 185.6, NVDA: 725.0,
  META: 505.75, TSLA: 238.45, JPM: 198.5, V: 280.3, JNJ: 158.2,
  BBCA: 9575, BBRI: 5725, BMRI: 6350, TLKM: 3850, ASII: 5225,
  UNVR: 2910, HMSP: 810, ICBP: 10400, KLBF: 1555, EMTK: 490,
  ITMG: 27350, ADRO: 2660, ANTM: 1545, INDF: 6475, GGRM: 24000,
  PGAS: 1500, MDKA: 2440, CPIN: 5050, EXCL: 2410, BRPT: 1045,
  BBNI: 5425, GOTO: 76, BUKA: 164, ARTO: 2650, TOWR: 1025,
  PTBA: 2980, UNTR: 26500, SMGR: 4020, MEDC: 1400, HRUM: 1605,
  INCO: 4250, MYOR: 2380, JPFA: 1445, AMRT: 2780, MAPI: 1625,
};

async function getMockQuote(symbol: string, market: Market): Promise<StockQuote> {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  const s = cleanSymbol(symbol);
  const basePrice = MOCK_PRICES[s] || (market === 'ID' ? 5000 : 150);
  const rand = seededRandom(s + new Date().toDateString());
  const changePercent = (rand() - 0.48) * 4;
  const change = basePrice * (changePercent / 100);
  const price = basePrice + change;

  const stockName =
    IDX_FULL_LIST.find((st) => st.symbol === s)?.name ||
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
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  const s = cleanSymbol(symbol);
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
    const roundFn = (v: number) =>
      market === 'ID' ? Math.round(v) : Math.round(v * 100) / 100;

    data.push({
      date,
      open: roundFn(open),
      high: roundFn(high),
      low: roundFn(Math.max(low, 1)),
      close: roundFn(currentPrice),
      volume: vol,
    });
  }

  return data;
}

// ============================================================
// POPULAR STOCKS
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