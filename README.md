# StockAdvisor — Smart Money Swing Screener

A Next.js application for **swing trading** and **portfolio management** across the **US** (NYSE/NASDAQ) and **Indonesian** (IDX) stock markets. It combines a "smart money-first" accumulation screener with comprehensive fundamental analysis, position sizing, and portfolio tracking — all powered by Yahoo Finance data.

---

## Core Philosophy: Smart Money First

The application's screener implements a **two-gate architecture**:

```
OHLCV Data → Accumulation Gate → Technical Gate → Final Score
             (Smart Money)       (TA Scoring)
```

1. **Gate 1 — Accumulation Proxy:** Uses 5 volume-based signals to detect institutional footprint. Stocks that don't show accumulation are rejected immediately — saving compute and filtering noise.
2. **Gate 2 — Technical Scoring:** Only accumulating stocks proceed to full TA evaluation (trend, momentum, volume, structure) for a final 0–100 score.

This ensures every screener result has institutional buying conviction behind it.

### Accumulation Signals (Gate 1)

| Signal | Method | Bullish When |
|--------|--------|--------------|
| A/D Line Trend | Accumulation/Distribution line slope (5-period) | Trending up |
| Chaikin Money Flow | CMF (20-period) | CMF > 0 |
| Volume Profile | Up-day vs down-day volume ratio (20-day) | Up-volume > down-volume |
| OBV Divergence | On-Balance Volume vs price trend | OBV rising, price flat/falling |
| Block Buying | High-volume up-days detection | Large institutional footprint present |

Composite score: 0–100. A stock must score ≥ threshold (preset-dependent, typically 40–60) to pass Gate 1.

### Technical Scoring (Gate 2)

| Category | Max Points | Key Indicators |
|----------|------------|----------------|
| Trend | 30 | EMA 20/50/200 alignment, Supertrend |
| Volume | 30 | Volume ratio, OBV trend, MFI |
| Momentum | 25 | RSI, Stochastic, CCI |
| Structure | 15 | ATR%, Bollinger %B, 52W high distance, Pivot S1 proximity |

Stocks must score ≥ 60/100 to pass (40 for Oversold preset).

### Screener Presets

| Preset | Gate 1 Threshold | Gate 2 Requirements |
|--------|-----------------|---------------------|
| **DEFAULT** | ≥ 40 | TA ≥ 60 |
| **BREAKOUT** | ≥ 60 | TA ≥ 60 + Volume ≥ 2× + ADX > 25 + BB%B > 0.8 |
| **OVERSOLD** | ≥ 40 | TA ≥ 40 + RSI 30–55 + near Pivot S1 |
| **SMART_MONEY** | ≥ 80 | TA ≥ 60 + MACD increasing |
| **VOLUME_CLIMAX** | ≥ 60 | TA ≥ 60 + Volume ≥ 3× + above EMA50 + RSI < 70 |
| **SHORT_SQUEEZE** | ≥ 60 | TA ≥ 60 + Volume ≥ 2.5× + above EMA20 + Stoch recovery |

---

## Features

### 🔍 Swing Screener
- **Smart Money-first pipeline** — Accumulation gate filters out noise before TA scoring
- **6 presets** — Default, Breakout, Oversold, Smart Money, Volume Climax, Short Squeeze
- **Dual market** — US (S&P 100, Tech 30) and IDX (LQ45, KOMPAS100, All ~960 stocks)
- **Paginated results** — Server-side chunking with in-memory cache

### 📊 Comprehensive Analysis
- **Company profile** with officer info, sector, and description
- **Financial statements** — 4 years of income statement, balance sheet, cash flow
- **Valuation metrics** — P/E, P/B, P/S, PEG, EV/EBITDA with good/fair/expensive badges
- **Profitability & growth charts** — Revenue, margins, CAGR visualization
- **Peer comparison** — Auto-detects sector peers for side-by-side analysis
- **Red flags detection** — 9 automated financial health checks (D/E spike, negative FCF, declining margins, etc.)
- **Dividend analysis** — Yield, payout ratio, sustainability assessment

### 📈 Portfolio & Watchlist
- **Real-time watchlist** — Track open positions with live P&L (USD and IDR)
- **Automated action signals** — STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL based on TA score + stop-loss/take-profit triggers
- **Position close** with exit reason tracking (stop-loss, take-profit, manual)
- **Portfolio dashboard** — Dual-currency P&L charts, win rate, best/worst performers
- **Daily snapshots** — Automatic portfolio value tracking over time
- **Closed positions history** — Full trade journal with plan adherence tracking

### 🧮 Position Calculator
- **Risk-based sizing** — Calculate position size from capital, risk %, and stop-loss distance
- **IDX lot system** — Automatic 100-share lot rounding for Indonesian stocks
- **Fee estimation** — Configurable per-share fees and buffer percentage

### ⚙️ Settings & Data
- **Analysis mode toggle** — Switch between Swing Trading and Analysis modes
- **JSON backup/restore** — Export and import all portfolio, watchlist, and preference data
- **API status monitor** — Real-time Yahoo Finance connectivity indicator

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                      # Home — stock search + feature cards
│   ├── analysis/                     # Comprehensive analysis page
│   ├── calculator/                   # Position size calculator
│   ├── portfolio/                    # P&L dashboard
│   ├── screener/                     # Swing screener page
│   ├── settings/                     # Preferences + data management
│   ├── stock/[symbol]/               # Stock detail (dynamic route)
│   ├── test/                         # API test dashboard
│   ├── watchlist/                    # Watchlist management
│   └── api/
│       ├── analysis/route.ts         # Comprehensive analysis endpoint
│       ├── screener/route.ts         # Swing screener endpoint
│       ├── stock/route.ts            # Quote + search endpoint
│       ├── stock/detail/route.ts     # Quote + screener + profile
│       ├── watchlist/route.ts        # Batch watchlist update
│       ├── status/route.ts           # API health check
│       └── test/route.ts             # Integration test suite
├── components/
│   ├── analysis/                     # 9 analysis sub-components
│   │   ├── CompanyOverview.tsx
│   │   ├── ValuationMetrics.tsx
│   │   ├── ProfitabilityCharts.tsx
│   │   ├── GrowthCharts.tsx
│   │   ├── FinancialHealth.tsx
│   │   ├── CashFlowAnalysis.tsx
│   │   ├── DividendAnalysis.tsx
│   │   ├── PeerComparison.tsx
│   │   └── RedFlagsPanel.tsx
│   ├── StockScreener.tsx             # Screener UI
│   ├── WatchlistTable.tsx            # Watchlist table
│   ├── PortfolioDashboard.tsx        # Portfolio charts + stats
│   ├── LotCalculator.tsx             # Position calculator
│   ├── StockSearch.tsx               # Universal stock search
│   ├── Navbar.tsx                    # Navigation bar
│   └── APIStatus.tsx                 # Provider status badge
├── lib/
│   ├── yahooFinance2.ts              # Yahoo Finance unified data service
│   ├── stockData.ts                  # Stock quotes + historical data
│   ├── swingScreener.ts              # Smart money-first screener pipeline
│   ├── accumulationProxy.ts          # 5-signal accumulation detection
│   ├── technicalIndicators.ts        # Full TA calculation (20+ indicators)
│   ├── indicators.ts                 # Legacy indicator helpers
│   ├── redFlags.ts                   # Financial red flag detection
│   ├── lotCalculator.ts              # Position sizing engine
│   ├── constants.ts                  # Shared constants (sector maps, stock lists)
│   ├── universes.ts                  # Stock universe definitions (SP100, LQ45, etc.)
│   ├── cache.ts                      # In-memory cache with TTL
│   ├── portfolioStore.ts             # Zustand store — snapshots, closed positions
│   ├── watchlistStore.ts             # Zustand store — watchlist items
│   ├── userPreferencesStore.ts       # Zustand store — analysis mode
│   ├── dataManagement.ts             # Backup export/import
│   └── sectorUtils.ts               # Sector classification helpers
└── types/
    ├── index.ts                      # Core types (StockQuote, WatchlistItem, etc.)
    ├── analysis.ts                   # Analysis types (ComprehensiveAnalysis, RedFlag)
    └── screener.ts                   # Screener types (FundamentalData, FilterMeta)
```

### Data Flow

```
Yahoo Finance API (v8 Chart + yahoo-finance2 library)
          │
          ├─→ stockData.ts ──→ Quotes + Historical Data
          │
          ├─→ yahooFinance2.ts ──→ Fundamentals, Analysis, Search, Peers
          │
          └─→ swingScreener.ts
                  │
                  ├─→ accumulationProxy.ts (Gate 1: Smart Money)
                  │
                  └─→ technicalIndicators.ts (Gate 2: TA Scoring)
```

### State Management

All client-side state uses [Zustand](https://zustand-demo.pmnd.rs/) with `persist` middleware (localStorage):

| Store | Key | Data |
|-------|-----|------|
| `watchlistStore` | `stock-watchlist` | Open positions with buy price, quantity, targets |
| `portfolioStore` | `stock-portfolio` | Daily snapshots, closed positions, P&L history |
| `userPreferencesStore` | `user-preferences` | Analysis mode toggle |

Schema versioning is implemented with migration functions for forward compatibility.

---

## Stock Universes

### US Market
| Universe | Count | Description |
|----------|-------|-------------|
| **S&P 100** | 102 | Top 100 US blue-chip stocks |
| **Tech 30** | 30 | Technology sector leaders |

### Indonesian Market (IDX)
| Universe | Count | Description |
|----------|-------|-------------|
| **LQ45** | 45 | Most liquid IDX stocks |
| **KOMPAS100** | 100 | Top 100 by market cap + liquidity |
| **ALL** | ~960 | Full IDX universe |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript 5.8 |
| Styling | Tailwind CSS 3.4 |
| State | Zustand 4.5 (with persist) |
| Charts | Recharts 2.10 |
| Icons | Lucide React |
| Data | [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) + Yahoo v8 Chart API |
| TA Library | [technicalindicators](https://github.com/nickchuasl/technicalindicators) |
| Testing | Vitest + Testing Library |
| Deployment | Vercel (serverless, 30–60s function timeouts) |
| Analytics | Vercel Analytics |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Production build
npm run build
```

### Environment Variables

Create a `.env.local` file:

```env
# Provider configuration (both default to "yahoo")
US_STOCK_PROVIDER=yahoo
IDX_STOCK_PROVIDER=yahoo

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

No API keys are required — the app uses the free Yahoo Finance API.

---

## API Routes

| Route | Method | Description | Timeout |
|-------|--------|-------------|---------|
| `/api/analysis` | GET | Full company analysis + red flags + peers | 60s |
| `/api/screener` | GET | Paginated swing screener | 30s |
| `/api/stock` | GET | Stock quote or search | — |
| `/api/stock/detail` | GET | Quote + screener + company profile | — |
| `/api/watchlist` | POST | Batch update watchlist prices + signals | 30s |
| `/api/status` | GET | Yahoo Finance connectivity check | — |
| `/api/test` | GET/POST | Integration test suite | 30s |

All routes validate inputs (market, symbol format, pagination bounds).

---

## License

Private — Pacmann internal project.
