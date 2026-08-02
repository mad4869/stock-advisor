import { ComprehensiveAnalysis } from '@/types/analysis';
import { Market } from '@/types';

export interface MethodValuation {
  name: string;
  fairPrice: number | null;
  targetMultiple: number;
  metricValue: number | null; // EPS or BVPS
  metricName: string;
  description: string;
  isAvailable: boolean;
}

export interface FairValueResult {
  currentPrice: number | null;
  blendedFairPrice: number | null;
  marginOfSafety: number | null; // percentage e.g. +15.5% (undervalued) or -10% (overvalued)
  status: 'undervalued' | 'fair' | 'overvalued' | 'unknown';
  methods: {
    per: MethodValuation;
    pbv: MethodValuation;
    graham: MethodValuation;
  };
}

// Sector-specific benchmark multiples
const SECTOR_BENCHMARKS: Record<string, { ID: { pe: number; pb: number }; US: { pe: number; pb: number } }> = {
  Financials: { ID: { pe: 12, pb: 1.8 }, US: { pe: 14, pb: 1.6 } },
  'Financial Services': { ID: { pe: 12, pb: 1.8 }, US: { pe: 15, pb: 1.8 } },
  'Consumer Staples': { ID: { pe: 18, pb: 2.2 }, US: { pe: 20, pb: 3.0 } },
  'Consumer Discretionary': { ID: { pe: 16, pb: 2.0 }, US: { pe: 22, pb: 3.5 } },
  Energy: { ID: { pe: 8, pb: 1.1 }, US: { pe: 12, pb: 1.5 } },
  'Basic Materials': { ID: { pe: 10, pb: 1.2 }, US: { pe: 15, pb: 1.8 } },
  Technology: { ID: { pe: 22, pb: 3.5 }, US: { pe: 28, pb: 5.0 } },
  Healthcare: { ID: { pe: 18, pb: 2.5 }, US: { pe: 24, pb: 3.8 } },
  Utilities: { ID: { pe: 12, pb: 1.2 }, US: { pe: 16, pb: 1.5 } },
  Industrials: { ID: { pe: 14, pb: 1.5 }, US: { pe: 18, pb: 2.2 } },
  'Real Estate': { ID: { pe: 12, pb: 1.0 }, US: { pe: 14, pb: 1.2 } },
  Communication: { ID: { pe: 14, pb: 1.6 }, US: { pe: 18, pb: 2.2 } },
};

// Fallback market defaults
const MARKET_DEFAULTS = {
  ID: { pe: 15.0, pb: 1.5 },
  US: { pe: 18.0, pb: 2.5 },
};

/**
 * Calculates fair value estimates using PER, PBV, and Graham Number methodologies.
 */
export function calculateFairValue(
  analysis: ComprehensiveAnalysis,
  market: Market
): FairValueResult {
  const price = analysis.fundamentals.price ?? null;
  const peRatio = analysis.fundamentals.peRatio ?? null;
  const pbRatio = analysis.fundamentals.pbRatio ?? null;
  const sector = analysis.fundamentals.sector ?? '';

  // Get benchmark multiples for sector / market
  const sectorBench = SECTOR_BENCHMARKS[sector]?.[market];
  const targetPE = sectorBench?.pe ?? MARKET_DEFAULTS[market].pe;
  const targetPB = sectorBench?.pb ?? MARKET_DEFAULTS[market].pb;

  // Derive EPS and BVPS
  let eps: number | null = null;
  if (price != null && peRatio != null && peRatio > 0) {
    eps = price / peRatio;
  } else if (analysis.financials && analysis.financials.length > 0) {
    const latestFin = analysis.financials[analysis.financials.length - 1];
    if (latestFin.eps != null && latestFin.eps > 0) {
      eps = latestFin.eps;
    }
  }

  let bvps: number | null = null;
  if (price != null && pbRatio != null && pbRatio > 0) {
    bvps = price / pbRatio;
  } else if (analysis.balanceSheets && analysis.balanceSheets.length > 0) {
    const latestBs = analysis.balanceSheets[analysis.balanceSheets.length - 1];
    const shares = analysis.fundamentals.sharesOutstanding;
    if (latestBs.totalEquity != null && shares && shares > 0) {
      bvps = latestBs.totalEquity / shares;
    }
  }

  // 1. PER Valuation: Fair Price = EPS * Target PE
  let perFairPrice: number | null = null;
  if (eps != null && eps > 0) {
    perFairPrice = eps * targetPE;
  }

  // 2. PBV Valuation: Fair Price = BVPS * Target PB
  let pbvFairPrice: number | null = null;
  if (bvps != null && bvps > 0) {
    pbvFairPrice = bvps * targetPB;
  }

  // 3. Graham Number: sqrt(22.5 * EPS * BVPS)
  let grahamFairPrice: number | null = null;
  if (eps != null && eps > 0 && bvps != null && bvps > 0) {
    grahamFairPrice = Math.sqrt(22.5 * eps * bvps);
  }

  // Collect valid fair prices for blended average
  const validPrices: number[] = [];
  if (perFairPrice != null && perFairPrice > 0) validPrices.push(perFairPrice);
  if (pbvFairPrice != null && pbvFairPrice > 0) validPrices.push(pbvFairPrice);
  if (grahamFairPrice != null && grahamFairPrice > 0) validPrices.push(grahamFairPrice);

  let blendedFairPrice: number | null = null;
  let marginOfSafety: number | null = null;
  let status: FairValueResult['status'] = 'unknown';

  if (validPrices.length > 0) {
    blendedFairPrice = validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length;
    if (price != null && price > 0 && blendedFairPrice > 0) {
      marginOfSafety = ((blendedFairPrice - price) / blendedFairPrice) * 100;

      if (marginOfSafety >= 15) {
        status = 'undervalued';
      } else if (marginOfSafety <= -15) {
        status = 'overvalued';
      } else {
        status = 'fair';
      }
    }
  }

  return {
    currentPrice: price,
    blendedFairPrice,
    marginOfSafety,
    status,
    methods: {
      per: {
        name: 'PER Valuation',
        fairPrice: perFairPrice,
        targetMultiple: targetPE,
        metricValue: eps,
        metricName: 'EPS',
        description: `Fair Price = EPS × ${targetPE.toFixed(1)}x Target P/E`,
        isAvailable: perFairPrice != null && perFairPrice > 0,
      },
      pbv: {
        name: 'PBV Valuation',
        fairPrice: pbvFairPrice,
        targetMultiple: targetPB,
        metricValue: bvps,
        metricName: 'BVPS',
        description: `Fair Price = BVPS × ${targetPB.toFixed(1)}x Target P/B`,
        isAvailable: pbvFairPrice != null && pbvFairPrice > 0,
      },
      graham: {
        name: 'Graham Number',
        fairPrice: grahamFairPrice,
        targetMultiple: 22.5,
        metricValue: null,
        metricName: 'EPS & BVPS',
        description: `Fair Price = √(22.5 × EPS × BVPS)`,
        isAvailable: grahamFairPrice != null && grahamFairPrice > 0,
      },
    },
  };
}
