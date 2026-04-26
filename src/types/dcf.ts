export interface DCFAssumptions {
  // WACC Inputs
  riskFreeRate: number; // e.g., 4.3 for 4.3%
  beta: number;
  equityRiskPremium: number;
  costOfDebt: number;
  taxRate: number;
  
  // Weights (derived or overridden)
  equityWeight?: number;
  debtWeight?: number;

  // Growth Inputs
  phase1Growth: number; // Years 1-5
  phase2Growth: number; // Years 6-10
  terminalGrowth: number; // Terminal
}

export interface FCFProjection {
  year: number;
  label: string; // e.g., "Year 1", "Year 2"
  fcf: number;
  discountFactor: number;
  presentValue: number;
}

export interface DCFResult {
  wacc: number;
  
  // Projections
  projections: FCFProjection[];
  pvOfProjections: number;
  
  // Terminal Value
  terminalValue: number;
  pvOfTerminalValue: number;
  terminalValuePercentOfEV: number;
  
  // Enterprise & Equity Value
  enterpriseValue: number;
  totalDebt: number;
  cashAndEquivalents: number;
  equityValue: number;
  
  // Per Share Output
  sharesOutstanding: number;
  intrinsicValuePerShare: number;
  currentPrice: number;
  marginOfSafety: number; // % (Intrinsic - Price) / Intrinsic
  
  // Verdict
  verdict: 'STRONG BUY' | 'UNDERVALUED' | 'FAIR' | 'OVERVALUED';
}

export type ScenarioType = 'conservative' | 'base' | 'optimistic';

export interface DCFScenario {
  type: ScenarioType;
  label: string;
  assumptions: DCFAssumptions;
  result?: DCFResult;
}
