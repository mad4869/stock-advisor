# Stock Advisor — FCDS-T Value Investing Engine

A Next.js application for systematic value investing analysis on the **Indonesian Stock Exchange (IDX)**, implementing the FCDS-T multi-bagger screening methodology.

---

## FCDS-T Methodology

This application implements the **FCDS-T** value investing framework for identifying multibagger stock candidates.

```
F — Fundamental (Quality)    Max 5 pts
C — Cheap (Valuation)        Max 4 pts
D — Debt (Health)            Max 3 pts
S — Story (Moat)             Max 3 pts
T — Timing (Action)          Informational — triggers BUY ZONE / ACCUMULATE / WAIT
                             ─────────────────────────────────────────────────────
Total                        0 – 15 pts
```

### What is FCDS-T?

| Dimension | Focus | Key Metrics |
|-----------|-------|-------------|
| **F** — Fundamental | Business quality | Revenue growth ≥15%, ROE ≥15%, Net profit margin ≥10%, Gross margin ≥20% |
| **C** — Cheap | Valuation | PER ≤15, PBV ≤2, PEG ≤1, EV/EBITDA ≤10 |
| **D** — Debt | Financial health | DER ≤1, Current ratio ≥1.5, Interest coverage ≥3; or NPL ≤3%, CAR ≥12% for banks |
| **S** — Story | Competitive moat | Megatrend exposure, Moat/brand, Near-term catalyst |
| **T** — Timing | Entry action | Price > MA20, RSI 40-60, Volume spike, Margin of Safety ≥30% |

### Scoring System

| Grade | Score | Interpretation |
|-------|-------|----------------|
| **A+** | 13 – 15 | Strong multibagger candidate |
| **B**  | 10 – 12 | Solid investment |
| **C**  | 7 – 9  | Marginal — needs review |
| **D**  | < 7    | Skip |
| **Incomplete** | — | Banking D-score or Story checklist not yet filled |

Scores are computed in real-time. A stock with a **Pending** Story score shows its provisional grade (e.g. `B (Pending Story)`).

---

## Features

### 🎯 Analysis Workflow
- **Sequential Stepper** (F → C → D → S → T) — Guided mode for focused, step-by-step analysis
- **Flat View** — Power-user alternative showing all FCDS-T dimensions simultaneously
- **Banking Sector Awareness** — Automatic detection; replaces general D-score with NPL/CAR inputs

### 📊 Screener
- Run broad universe scans against the FCDS-T engine
- FCDS-T Analysis Filters: filter by Min Score, Grade, or hide Incomplete analyses

### ⚙️ Configurable Thresholds
- All FCDS-T thresholds are configurable via **Settings → FCDS-T Threshold Configuration**
- Supports per-dimension collapsible sections (Fundamental / Valuation / Debt General / Debt Banking)
- Changes propagate instantly — all scores recompute automatically
- Reset to Defaults restores Benjamin Graham / Peter Lynch baseline values

### 📓 Investment Thesis Journal
- **Record Buy Transaction** — mandatory thesis summary (≥20 chars), auto-captures FCDS-T score snapshot at entry
- **Close Position** — mandatory lesson-learned (≥20 chars), thesis accuracy radio, computes **score differential** (entry snapshot vs current score)
- Retrospective analysis for improving investment discipline

### 📈 Volume Accumulation Proxy *(Timing Enhancement)*
- 5th supplementary signal in the Timing section
- Heuristic: `volumeRatio ≥ 2×` AND `closingPosition ≥ 0.67` (upper third of day's range)
- Confidence levels: `high` (vol ≥ 3× + close ≥ 80%), `medium` (meets threshold), `low`
- **Informational only** — does NOT change the 4-signal Timing action badge

### 💾 Data Management
- JSON backup export / import (portfolio, watchlist, analyses, journals)
- Zustand persist with schema versioning and migration support

---

## Architecture

```
src/
├── app/
│   ├── settings/         # Settings page (Thresholds + Preferences + Data Mgmt)
│   └── ...               # Next.js pages (analysis, screener, portfolio, etc.)
├── components/
│   └── fcdst/
│       ├── FCDSTStepper.tsx      # Guided stepper (F→C→D→S→T)
│       ├── FCDSTFlatView.tsx     # Advanced flat view
│       ├── FCDSTScoreCard.tsx    # Score summary card
│       ├── TimingSignals.tsx     # T-score signals + Volume Accumulation Proxy
│       ├── StoryChecklist.tsx    # S-score checklist with justification
│       ├── BankingMetricsForm.tsx
│       ├── RecordBuyForm.tsx     # Buy journal with FCDS-T snapshot
│       └── RecordSellForm.tsx    # Sell journal with score diff
├── hooks/
│   └── useFCDSTAnalysis.ts       # Core hook wiring engine + stores
├── lib/
│   ├── fcdstEngine.ts            # Pure scoring functions (calculateFCDSTScore, calculateTScore, calculateVolumeAccumulation)
│   ├── fcdstThresholdsStore.ts   # Persisted Zustand store for configurable thresholds
│   ├── bankingMetricsStore.ts    # NPL/CAR per-symbol storage
│   ├── storyAnalysisStore.ts     # S-score checklist persistence
│   └── portfolioStore.ts         # Portfolio + watchlist with FCDS-T schema
└── types/
    └── fcdst.ts                  # FCDSTScore, FCDSTThresholds, TechnicalData, VolumeAccumulationSignal
```

---

## Configuration

### Threshold Defaults

| Field | Default | Rationale |
|-------|---------|-----------|
| Revenue Growth Min | 15% | Peter Lynch growth threshold |
| Net Income Growth Min | 15% | Earnings quality |
| ROE Min | 15% | Benjamin Graham quality floor |
| Net Profit Margin Min | 10% | Profitability |
| Gross Profit Margin Min | 20% | Business model strength |
| PER Max | 15 | Graham conservative valuation |
| PBV Max | 2 | Asset protection |
| PEG Max | 1 | Growth-adjusted value |
| EV/EBITDA Max | 10 | Enterprise value |
| DER Max | 1 | Debt safety (general) |
| Current Ratio Min | 1.5 | Liquidity |
| Interest Coverage Min | 3× | Debt service capacity |
| NPL Max | 3% | Banking asset quality |
| CAR Min | 12% | Basel III capital requirement |

Thresholds are customizable via **Settings → FCDS-T Threshold Configuration** and persisted in `localStorage`.

---

## Getting Started

```bash
npm install
npm run dev        # Development server at http://localhost:3000
npm test           # Run all tests (vitest)
npm run build      # Production build
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and add your API keys:

```
YAHOO_FINANCE_PROXY_URL=...
```

---

## Testing

```bash
npm test
```

107 tests across 18 test files covering:
- FCDS-T engine pure functions (threshold boundary values, banking sector logic)
- Store persistence and resets (`fcdstThresholdsStore`, `bankingMetricsStore`, `userPreferencesStore`)
- Hook integration (score recomputation on threshold change, store reactivity)
- Settings form UI (validation, save, reset flows)
- Component rendering (FCDSTStepper, FCDSTScoreCard, TimingSignals, StoryChecklist, RecordBuyForm, RecordSellForm)
- Data management (backup/import)
- Schema migrations (v1 → v2 for portfolio and watchlist stores)
- Volume Accumulation Proxy (edge cases: `high==low`, missing data, zero avg volume)

---

## Sprint History

| Sprint | Commits | Scope |
|--------|---------|-------|
| 1 | 1-2 | FCDS-T type definitions, scoring engine, sector utils |
| 2 | 3-5 | FCDSTStepper, FCDSTScoreCard, FCDSTFlatView, TimingSignals |
| 3 | 6-8 | StoryChecklist, BankingMetricsForm, RecordBuy/SellForms, screener integration |
| 4 | 9-11 | Configurable thresholds, Volume Accumulation Proxy, README & docs |

---

## License

Private — Pacmann internal project.
