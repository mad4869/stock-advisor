import { NextResponse } from 'next/server';
import { yf } from '@/lib/yahooFinance2';
import { macroCache, CACHE_TTL } from '@/lib/cache';

export type MacroCategory = 'indices' | 'sentiment' | 'commodities' | 'rates' | 'crypto';

export interface MacroIndicator {
  symbol: string;
  name: string;
  category: MacroCategory;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
  label: string;
  labelColor: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray';
  description: string;
}

interface SymbolConfig {
  symbol: string;
  name: string;
  category: MacroCategory;
  unit: string;
  description: string;
  getLabel: (price: number, changePercent: number) => { label: string; color: MacroIndicator['labelColor'] };
}

const MACRO_SYMBOLS: SymbolConfig[] = [
  // ── INDICES ──
  {
    symbol: '^JKSE',
    name: 'IHSG (Indonesia Composite)',
    category: 'indices',
    unit: 'points',
    description: 'Main benchmark index for the Indonesian stock exchange (IDX).',
    getLabel: (_, chg) => {
      if (chg >= 1.0) return { label: 'Strong Bullish Day', color: 'green' };
      if (chg >= 0.2) return { label: 'Mild Bullish Bias', color: 'green' };
      if (chg > -0.2) return { label: 'Consolidating / Neutral', color: 'blue' };
      if (chg > -1.0) return { label: 'Bearish Pressure', color: 'yellow' };
      return { label: 'Heavy Selling / Pullback', color: 'red' };
    },
  },
  {
    symbol: '^GSPC',
    name: 'S&P 500 (US Benchmark)',
    category: 'indices',
    unit: 'points',
    description: 'Tracks 500 leading US large-cap equities; main gauge of global equity sentiment.',
    getLabel: (_, chg) => {
      if (chg >= 1.0) return { label: 'Risk-On Rally', color: 'green' };
      if (chg >= 0.2) return { label: 'Positive Momentum', color: 'green' };
      if (chg > -0.2) return { label: 'Flat / Mixed Session', color: 'blue' };
      if (chg > -1.0) return { label: 'Mild Risk-Off', color: 'yellow' };
      return { label: 'Sharp Market Drop', color: 'red' };
    },
  },
  {
    symbol: '^IXIC',
    name: 'NASDAQ Composite',
    category: 'indices',
    unit: 'points',
    description: 'Tech-heavy US equity index; primary barometer for growth stocks and risk appetite.',
    getLabel: (_, chg) => {
      if (chg >= 1.2) return { label: 'Tech Surge', color: 'green' };
      if (chg >= 0.3) return { label: 'Tech Bullish', color: 'green' };
      if (chg > -0.3) return { label: 'Tech Consolidating', color: 'blue' };
      if (chg > -1.2) return { label: 'Tech Weakness', color: 'yellow' };
      return { label: 'Tech Sell-Off', color: 'red' };
    },
  },
  {
    symbol: '^DJI',
    name: 'Dow Jones Industrials',
    category: 'indices',
    unit: 'points',
    description: '30 prominent US blue-chip industrial & financial corporations.',
    getLabel: (_, chg) => {
      if (chg >= 0.8) return { label: 'Blue-Chip Strength', color: 'green' };
      if (chg >= 0.2) return { label: 'Steady Advance', color: 'green' };
      if (chg > -0.2) return { label: 'Neutral Rotation', color: 'blue' };
      return { label: 'Cyclical Pullback', color: 'yellow' };
    },
  },
  {
    symbol: '^RUT',
    name: 'Russell 2000 (Small Caps)',
    category: 'indices',
    unit: 'points',
    description: 'US small-cap equity index; indicates domestic economic confidence and speculative appetite.',
    getLabel: (_, chg) => {
      if (chg >= 1.5) return { label: 'High Speculative Risk-On', color: 'purple' };
      if (chg >= 0.3) return { label: 'Small Cap Strength', color: 'green' };
      if (chg > -0.3) return { label: 'Rangebound', color: 'blue' };
      return { label: 'Small Cap Underperformance', color: 'yellow' };
    },
  },
  {
    symbol: '^N225',
    name: 'Nikkei 225 (Japan)',
    category: 'indices',
    unit: 'points',
    description: 'Japan benchmark equity index; key indicator for Asian trading session sentiment.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'Asia Sentiment Positive', color: 'green' } : { label: 'Asia Sentiment Soft', color: 'yellow' },
  },
  {
    symbol: '^HSI',
    name: 'Hang Seng (Hong Kong/China)',
    category: 'indices',
    unit: 'points',
    description: 'Major index tracking Chinese tech, financials, and real estate giants.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'China Tech Strength', color: 'green' } : { label: 'China Growth Drag', color: 'yellow' },
  },

  // ── SENTIMENT & VOLATILITY (FEAR / GREED) ──
  {
    symbol: '^VIX',
    name: 'CBOE VIX (Market Fear Gauge)',
    category: 'sentiment',
    unit: 'index',
    description: 'Primary measure of 30-day expected market volatility (S&P 500 options). Serves as the ultimate Fear & Greed proxy.',
    getLabel: (price) => {
      if (price < 14) return { label: 'Complacency / Extreme Greed (< 14)', color: 'blue' };
      if (price <= 18) return { label: 'Neutral / Normal Bull Market (14–18)', color: 'green' };
      if (price <= 24) return { label: 'Elevated Caution / Hedging (18–24)', color: 'yellow' };
      if (price <= 32) return { label: 'High Fear / Correction Zone (24–32)', color: 'red' };
      return { label: 'Extreme Fear / Capitulation (> 32 - Buy Zone)', color: 'purple' };
    },
  },
  {
    symbol: '^VIX3M',
    name: '3-Month VIX (Term Structure)',
    category: 'sentiment',
    unit: 'index',
    description: '3-month expected volatility. When VIX < VIX3M (normal contango), markets are calm. When VIX > VIX3M (inversion), immediate market stress exists.',
    getLabel: (price) => price > 22 ? { label: 'Medium-Term Stress', color: 'yellow' } : { label: 'Stable Term Structure', color: 'green' },
  },

  // ── COMMODITIES (ENERGY, METALS, SOFTS) ──
  {
    symbol: 'CL=F',
    name: 'Crude Oil (WTI)',
    category: 'commodities',
    unit: 'USD/bbl',
    description: 'US benchmark crude oil futures. Critical input cost for transportation & inflation barometer.',
    getLabel: (price, chg) => {
      if (price > 85) return { label: 'High Energy Cost Pressure (> $85)', color: 'red' };
      if (price < 65) return { label: 'Suppressed Inflation Risk (< $65)', color: 'blue' };
      return chg >= 0 ? { label: 'Oil Firming Up', color: 'green' } : { label: 'Oil Softening', color: 'blue' };
    },
  },
  {
    symbol: 'BZ=F',
    name: 'Brent Crude Oil',
    category: 'commodities',
    unit: 'USD/bbl',
    description: 'Global oil benchmark. Directly affects Indonesian fuel subsidies, inflation, and energy stock profitability.',
    getLabel: (price) => price > 88 ? { label: 'Global Energy Headwind', color: 'yellow' } : { label: 'Manageable Fuel Costs', color: 'green' },
  },
  {
    symbol: 'NG=F',
    name: 'Natural Gas',
    category: 'commodities',
    unit: 'USD/MMBtu',
    description: 'Major industrial fuel & electricity generation input cost globally.',
    getLabel: (_, chg) => chg >= 2 ? { label: 'Gas Spike', color: 'yellow' } : { label: 'Stable Gas Pricing', color: 'blue' },
  },
  {
    symbol: 'GC=F',
    name: 'Gold Futures',
    category: 'commodities',
    unit: 'USD/oz',
    description: 'Ultimate safe-haven asset, central bank reserve metal, and hedge against currency debasement.',
    getLabel: (_, chg) => {
      if (chg >= 1.0) return { label: 'Strong Safe-Haven Inflow', color: 'purple' };
      if (chg >= 0.2) return { label: 'Gold Accumulation', color: 'green' };
      return { label: 'Risk-On Rotation / Stable', color: 'blue' };
    },
  },
  {
    symbol: 'SI=F',
    name: 'Silver Futures',
    category: 'commodities',
    unit: 'USD/oz',
    description: 'High-beta monetary metal + critical industrial conductor for solar panels & electronics.',
    getLabel: (_, chg) => chg >= 1.5 ? { label: 'Industrial & Bullion Surge', color: 'green' } : { label: 'Rangebound', color: 'blue' },
  },
  {
    symbol: 'HG=F',
    name: 'Copper ("Dr. Copper")',
    category: 'commodities',
    unit: 'USD/lb',
    description: 'Leading indicator of global industrial production and construction demand. When copper rises, global growth is expanding.',
    getLabel: (_, chg) => {
      if (chg >= 1.0) return { label: 'Global Industrial Expansion', color: 'green' };
      if (chg > -0.5) return { label: 'Steady Demand', color: 'blue' };
      return { label: 'Industrial Growth Slowdown', color: 'yellow' };
    },
  },
  {
    symbol: 'PL=F',
    name: 'Platinum Futures',
    category: 'commodities',
    unit: 'USD/oz',
    description: 'Used in catalytic converters and industrial processes.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'Industrial Metal Firm', color: 'green' } : { label: 'Soft Industrial Demand', color: 'blue' },
  },
  {
    symbol: 'PA=F',
    name: 'Palladium Futures',
    category: 'commodities',
    unit: 'USD/oz',
    description: 'Critical automotive emissions control catalyst metal.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'Auto Demand Support', color: 'green' } : { label: 'Auto Demand Weak', color: 'blue' },
  },
  {
    symbol: 'ZC=F',
    name: 'Corn Futures',
    category: 'commodities',
    unit: 'USD/bu',
    description: 'Global staple grain and biofuel input.',
    getLabel: (_, chg) => chg > 1.5 ? { label: 'Agri-Inflation Pressure', color: 'yellow' } : { label: 'Grain Prices Stable', color: 'blue' },
  },
  {
    symbol: 'ZS=F',
    name: 'Soybean Futures',
    category: 'commodities',
    unit: 'USD/bu',
    description: 'Global oilseed and animal feed benchmark.',
    getLabel: (_, chg) => chg > 1.5 ? { label: 'Feed & Food Inflation', color: 'yellow' } : { label: 'Oilseed Stable', color: 'blue' },
  },
  {
    symbol: 'ZW=F',
    name: 'Wheat Futures',
    category: 'commodities',
    unit: 'USD/bu',
    description: 'Global food security benchmark. Sharp rises indicate agricultural supply shocks.',
    getLabel: (_, chg) => chg > 2.0 ? { label: 'Food Supply Warning', color: 'red' } : { label: 'Staple Grain Normal', color: 'green' },
  },
  {
    symbol: 'KC=F',
    name: 'Coffee (Arabica)',
    category: 'commodities',
    unit: 'USD/lb',
    description: 'Soft commodity futures tracking global consumer beverage demand.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'Firm Beverage Demand', color: 'green' } : { label: 'Pullback in Softs', color: 'blue' },
  },
  {
    symbol: 'SB=F',
    name: 'Sugar #11 Futures',
    category: 'commodities',
    unit: 'USD/lb',
    description: 'Global raw sugar benchmark; key indicator for food processing costs.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'Sugar Prices Steady', color: 'blue' } : { label: 'Lower Food Costs', color: 'green' },
  },
  {
    symbol: 'CC=F',
    name: 'Cocoa Futures',
    category: 'commodities',
    unit: 'USD/ton',
    description: 'Confectionery raw material. Highly sensitive to West African weather disruptions.',
    getLabel: (_, chg) => chg > 3.0 ? { label: 'Extreme Supply Shortage', color: 'red' } : { label: 'Cocoa Trading Normal', color: 'blue' },
  },

  // ── RATES, CURRENCIES & CRYPTO ──
  {
    symbol: '^TNX',
    name: 'US 10-Yr Treasury Yield',
    category: 'rates',
    unit: '%',
    description: 'The global risk-free rate benchmark. High yields pressure stock valuations (especially tech & dividend stocks).',
    getLabel: (price) => {
      if (price >= 4.5) return { label: 'High Valuation Headwind (≥ 4.5%)', color: 'red' };
      if (price >= 4.0) return { label: 'Elevated Yield Pressure (4.0–4.5%)', color: 'yellow' };
      return { label: 'Accommodative Yields (< 4.0% - Equity Tailwind)', color: 'green' };
    },
  },
  {
    symbol: 'IDR=X',
    name: 'USD / IDR Exchange Rate',
    category: 'rates',
    unit: 'IDR',
    description: 'Rupiah value vs USD. A weaker Rupiah (> Rp 16,000) causes foreign fund outflows from IDX and import inflation.',
    getLabel: (price) => {
      if (price >= 16300) return { label: 'Rupiah Under Severe Pressure (> 16,300)', color: 'red' };
      if (price >= 16000) return { label: 'Rupiah Weakness (> 16,000)', color: 'yellow' };
      if (price <= 15600) return { label: 'Rupiah Strong / Inflow Supportive', color: 'green' };
      return { label: 'Rupiah Stable (15,600–16,000)', color: 'blue' };
    },
  },
  {
    symbol: 'DX-Y.NYB',
    name: 'US Dollar Index (DXY)',
    category: 'rates',
    unit: 'index',
    description: 'Measures USD strength against a basket of world currencies. Strong dollar creates headwinds for emerging markets like Indonesia.',
    getLabel: (price) => price > 104 ? { label: 'Strong Dollar (EM Headwind)', color: 'yellow' } : { label: 'Dollar Modest / Neutral', color: 'green' },
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin (Crypto Benchmark)',
    category: 'crypto',
    unit: 'USD',
    description: 'Leading global risk-on liquidity barometer. Rising Bitcoin signals strong speculative retail and institutional liquidity.',
    getLabel: (_, chg) => {
      if (chg >= 3.0) return { label: 'Strong Risk-On Liquidity Surge', color: 'purple' };
      if (chg >= 0.5) return { label: 'Positive Risk Appetite', color: 'green' };
      if (chg > -1.0) return { label: 'Consolidating Liquidity', color: 'blue' };
      return { label: 'Risk-Off Crypto Pullback', color: 'yellow' };
    },
  },
  {
    symbol: 'ETH-USD',
    name: 'Ethereum',
    category: 'crypto',
    unit: 'USD',
    description: 'Second largest cryptocurrency; proxy for decentralized finance and high-beta risk sentiment.',
    getLabel: (_, chg) => chg >= 0 ? { label: 'DeFi & Tech Appetite Firm', color: 'green' } : { label: 'Soft Speculative Appetite', color: 'yellow' },
  },
];

export async function GET() {
  const cacheKey = 'macro:global:v1';
  const cached = macroCache.get<MacroIndicator[]>(cacheKey);
  if (cached && cached.length > 0) {
    return NextResponse.json({ indicators: cached, cached: true });
  }

  const indicators: MacroIndicator[] = [];
  const symbolsToFetch = MACRO_SYMBOLS.map((s) => s.symbol);

  try {
    // Fetch quotes in parallel safely
    const quotes = await yf.quote(symbolsToFetch);
    const quoteMap = new Map<string, any>();
    if (Array.isArray(quotes)) {
      quotes.forEach((q) => {
        if (q?.symbol) quoteMap.set(q.symbol, q);
      });
    }

    for (const config of MACRO_SYMBOLS) {
      const q = quoteMap.get(config.symbol);
      let price = 0;
      let prevClose = 0;
      let change = 0;
      let changePercent = 0;

      if (q) {
        price = q.regularMarketPrice ?? q.postMarketPrice ?? q.previousClose ?? 0;
        prevClose = q.regularMarketPreviousClose ?? q.previousClose ?? price;
        change = price - prevClose;
        changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      }

      // If quote is missing or 0 (e.g., market holiday or unsupported symbol), skip or provide default
      if (price === 0 && prevClose === 0) {
        continue;
      }

      const { label, color } = config.getLabel(price, changePercent);

      indicators.push({
        symbol: config.symbol,
        name: config.name,
        category: config.category,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        unit: config.unit,
        label,
        labelColor: color,
        description: config.description,
      });
    }

    if (indicators.length > 0) {
      macroCache.set(cacheKey, indicators, CACHE_TTL.MACRO);
    }

    return NextResponse.json({ indicators, cached: false });
  } catch (error: any) {
    console.error(`[API/Macro] Failed to fetch macro indicators:`, error.message);
    return NextResponse.json(
      { error: 'Failed to fetch global macro data', details: error.message },
      { status: 500 }
    );
  }
}
