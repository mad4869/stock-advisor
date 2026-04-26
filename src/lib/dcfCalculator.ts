import { DCFAssumptions, DCFResult, FCFProjection } from '@/types/dcf';

/**
 * Calculates the WACC.
 * @param inputs WACC assumptions (percentages as numbers, e.g., 5.5 for 5.5%)
 * @returns WACC as a decimal (e.g., 0.08 for 8%)
 */
export function calculateWACC(inputs: DCFAssumptions): number {
  const {
    riskFreeRate,
    beta,
    equityRiskPremium,
    costOfDebt,
    taxRate,
    equityWeight = 1, // Default 100% equity if not provided
    debtWeight = 0,
  } = inputs;

  const ke = (riskFreeRate + beta * equityRiskPremium) / 100;
  const kd = (costOfDebt / 100) * (1 - taxRate / 100);

  const wacc = equityWeight * ke + debtWeight * kd;
  return wacc;
}

export interface DCFInputs {
  currentFCF: number;
  totalDebt: number;
  cashAndEquivalents: number;
  sharesOutstanding: number;
  currentPrice: number;
}

/**
 * Runs the full DCF calculation.
 */
export function calculateDCF(
  assumptions: DCFAssumptions,
  inputs: DCFInputs
): DCFResult {
  const wacc = calculateWACC(assumptions);
  const { currentFCF, totalDebt, cashAndEquivalents, sharesOutstanding, currentPrice } = inputs;

  const projections: FCFProjection[] = [];
  let pvOfProjections = 0;
  let lastFCF = currentFCF;

  // 10-Year Projection
  for (let year = 1; year <= 10; year++) {
    // Determine growth rate (Years 1-5 use Phase 1, Years 6-10 use Phase 2)
    const growthRate = year <= 5 ? assumptions.phase1Growth : assumptions.phase2Growth;
    
    const projectedFCF = lastFCF * (1 + growthRate / 100);
    const discountFactor = Math.pow(1 + wacc, year);
    const presentValue = projectedFCF / discountFactor;

    projections.push({
      year,
      label: `Year ${year}`,
      fcf: projectedFCF,
      discountFactor,
      presentValue,
    });

    pvOfProjections += presentValue;
    lastFCF = projectedFCF;
  }

  // Terminal Value using Gordon Growth Model
  const terminalGrowthDec = assumptions.terminalGrowth / 100;
  const fcfYear10 = projections[9].fcf;
  
  let terminalValue = 0;
  let pvOfTerminalValue = 0;
  
  if (wacc > terminalGrowthDec) {
    terminalValue = (fcfYear10 * (1 + terminalGrowthDec)) / (wacc - terminalGrowthDec);
    pvOfTerminalValue = terminalValue / Math.pow(1 + wacc, 10);
  }

  const enterpriseValue = pvOfProjections + pvOfTerminalValue;
  const equityValue = enterpriseValue - totalDebt + cashAndEquivalents;
  
  const intrinsicValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;
  const marginOfSafety = intrinsicValuePerShare > 0 
    ? ((intrinsicValuePerShare - currentPrice) / intrinsicValuePerShare) * 100 
    : 0;

  // Verdict logic
  let verdict: DCFResult['verdict'] = 'FAIR';
  if (marginOfSafety > 25) verdict = 'STRONG BUY';
  else if (marginOfSafety > 10) verdict = 'UNDERVALUED';
  else if (marginOfSafety >= -10) verdict = 'FAIR';
  else verdict = 'OVERVALUED';

  const terminalValuePercentOfEV = enterpriseValue > 0 
    ? (pvOfTerminalValue / enterpriseValue) * 100 
    : 0;

  return {
    wacc: wacc * 100, // Return as percentage for display
    projections,
    pvOfProjections,
    terminalValue,
    pvOfTerminalValue,
    terminalValuePercentOfEV,
    enterpriseValue,
    totalDebt,
    cashAndEquivalents,
    equityValue,
    sharesOutstanding,
    intrinsicValuePerShare,
    currentPrice,
    marginOfSafety,
    verdict,
  };
}

export interface SensitivityCell {
  wacc: number;
  terminalGrowth: number;
  intrinsicValue: number;
}

/**
 * Generates a 5x5 matrix for Sensitivity Analysis.
 */
export function generateSensitivityMatrix(
  baseAssumptions: DCFAssumptions,
  inputs: DCFInputs,
  waccSteps: number[], // e.g. [-1, -0.5, 0, 0.5, 1] percentages
  tgSteps: number[]    // e.g. [-0.5, -0.25, 0, 0.25, 0.5] percentages
): SensitivityCell[][] {
  const matrix: SensitivityCell[][] = [];
  
  const baseWacc = calculateWACC(baseAssumptions) * 100;

  for (const wStep of waccSteps) {
    const row: SensitivityCell[] = [];
    for (const tgStep of tgSteps) {
      // Create temporary assumptions specifically forcing the WACC calculation
      // To simulate tweaking WACC directly, we adjust the Risk Free Rate so the final WACC hits the target.
      // Alternatively, we can just hack the WACC inside calculateDCF, but since calculateDCF 
      // depends on the inputs, it's easier to adjust `riskFreeRate` to achieve the `targetWacc`.
      
      const targetWacc = baseWacc + wStep;
      const currentWacc = calculateWACC(baseAssumptions) * 100;
      const waccDiff = targetWacc - currentWacc;
      
      const testAssumptions: DCFAssumptions = {
        ...baseAssumptions,
        terminalGrowth: baseAssumptions.terminalGrowth + tgStep,
        // Hack: offset the riskFreeRate by the WACC difference divided by equity weight 
        // to forcefully achieve the desired WACC.
        riskFreeRate: baseAssumptions.riskFreeRate + (waccDiff / (baseAssumptions.equityWeight || 1)),
      };

      const result = calculateDCF(testAssumptions, inputs);
      row.push({
        wacc: targetWacc,
        terminalGrowth: testAssumptions.terminalGrowth,
        intrinsicValue: result.intrinsicValuePerShare,
      });
    }
    matrix.push(row);
  }

  return matrix;
}
