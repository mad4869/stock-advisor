import { ComprehensiveAnalysis, RedFlag } from '@/types/analysis';

/**
 * Scans a comprehensive analysis for financial red flags.
 * Returns an array of warnings/dangers sorted by severity.
 */
export function detectRedFlags(analysis: ComprehensiveAnalysis): RedFlag[] {
  const flags: RedFlag[] = [];
  const { financials, balanceSheets, cashFlows, fundamentals, dividend } = analysis;

  // Sort chronologically (oldest → newest) — should already be sorted
  const sortedFinancials = [...financials].sort((a, b) => a.year.localeCompare(b.year));
  const sortedCashFlows = [...cashFlows].sort((a, b) => a.year.localeCompare(b.year));
  const sortedBalanceSheets = [...balanceSheets].sort((a, b) => a.year.localeCompare(b.year));

  // 1. Revenue growing but FCF declining
  if (sortedFinancials.length >= 2 && sortedCashFlows.length >= 2) {
    const latestRev = sortedFinancials[sortedFinancials.length - 1]?.totalRevenue;
    const prevRev = sortedFinancials[sortedFinancials.length - 2]?.totalRevenue;
    const latestFCF = sortedCashFlows[sortedCashFlows.length - 1]?.freeCashFlow;
    const prevFCF = sortedCashFlows[sortedCashFlows.length - 2]?.freeCashFlow;

    if (latestRev != null && prevRev != null && latestFCF != null && prevFCF != null) {
      if (latestRev > prevRev && latestFCF < prevFCF) {
        flags.push({
          id: 'revenue-up-fcf-down',
          title: 'Revenue Growing but FCF Declining',
          message: 'Revenue increased year-over-year but free cash flow declined — may indicate deteriorating cash conversion or rising capex.',
          severity: 'warning',
          metric: 'FCF vs Revenue',
          currentValue: `Rev ${fmtLargeNum(latestRev)}, FCF ${fmtLargeNum(latestFCF)}`,
          threshold: 'FCF should grow with revenue',
        });
      }
    }
  }

  // 2. D/E ratio spiked >50% YoY
  if (sortedBalanceSheets.length >= 2) {
    const latestDE = sortedBalanceSheets[sortedBalanceSheets.length - 1]?.debtToEquity;
    const prevDE = sortedBalanceSheets[sortedBalanceSheets.length - 2]?.debtToEquity;

    if (latestDE != null && prevDE != null && prevDE > 0) {
      const deChange = ((latestDE - prevDE) / prevDE) * 100;
      if (deChange > 50) {
        flags.push({
          id: 'de-spike',
          title: 'Debt-to-Equity Ratio Spiked',
          message: `D/E ratio increased by ${deChange.toFixed(0)}% year-over-year, indicating a significant increase in leverage.`,
          severity: 'danger',
          metric: 'Debt/Equity',
          currentValue: `${latestDE.toFixed(2)}x (was ${prevDE.toFixed(2)}x)`,
          threshold: '<50% YoY increase',
        });
      }
    }
  }

  // 3. Negative Free Cash Flow
  if (sortedCashFlows.length > 0) {
    const latestFCF = sortedCashFlows[sortedCashFlows.length - 1]?.freeCashFlow;
    if (latestFCF != null && latestFCF < 0) {
      flags.push({
        id: 'negative-fcf',
        title: 'Negative Free Cash Flow',
        message: 'The company is burning cash — free cash flow is negative in the latest period.',
        severity: 'danger',
        metric: 'Free Cash Flow',
        currentValue: fmtLargeNum(latestFCF),
        threshold: '> 0',
      });
    }
  }

  // 4. Unsustainable Dividend (Payout Ratio > 90%)
  if (dividend.payoutRatio != null && dividend.payoutRatio > 90) {
    flags.push({
      id: 'high-payout',
      title: 'Unsustainable Dividend Payout',
      message: `Payout ratio of ${dividend.payoutRatio.toFixed(0)}% means the company is paying out almost all earnings as dividends, leaving little room for reinvestment or safety margin.`,
      severity: 'warning',
      metric: 'Payout Ratio',
      currentValue: `${dividend.payoutRatio.toFixed(0)}%`,
      threshold: '< 90%',
    });
  }

  // 5. Declining Gross Margin (3+ consecutive years)
  if (sortedFinancials.length >= 3) {
    const margins = sortedFinancials.map((f) => f.grossMargin).filter((m) => m != null) as number[];
    if (margins.length >= 3) {
      let consecutiveDeclines = 0;
      for (let i = 1; i < margins.length; i++) {
        if (margins[i] < margins[i - 1]) consecutiveDeclines++;
        else consecutiveDeclines = 0;
      }
      if (consecutiveDeclines >= 2) { // 3+ data points = 2+ consecutive declines
        flags.push({
          id: 'declining-gross-margin',
          title: 'Declining Gross Margin',
          message: `Gross margin has declined for ${consecutiveDeclines + 1} consecutive years, suggesting pricing pressure or rising costs.`,
          severity: 'warning',
          metric: 'Gross Margin',
          currentValue: `${margins[margins.length - 1].toFixed(1)}%`,
          threshold: 'Stable or growing',
        });
      }
    }
  }

  // 6. Declining ROE (3+ consecutive years)
  if (sortedFinancials.length >= 3) {
    // Compute ROE from financials + balance sheets
    const roeValues: number[] = [];
    for (let i = 0; i < sortedFinancials.length; i++) {
      const ni = sortedFinancials[i]?.netIncome;
      const eq = sortedBalanceSheets[i]?.totalEquity;
      if (ni != null && eq != null && eq > 0) {
        roeValues.push((ni / eq) * 100);
      }
    }
    if (roeValues.length >= 3) {
      let consecutiveDeclines = 0;
      for (let i = 1; i < roeValues.length; i++) {
        if (roeValues[i] < roeValues[i - 1]) consecutiveDeclines++;
        else consecutiveDeclines = 0;
      }
      if (consecutiveDeclines >= 2) {
        flags.push({
          id: 'declining-roe',
          title: 'Declining Return on Equity',
          message: `ROE has declined for ${consecutiveDeclines + 1} consecutive years, indicating weakening profitability relative to equity.`,
          severity: 'warning',
          metric: 'ROE',
          currentValue: `${roeValues[roeValues.length - 1].toFixed(1)}%`,
          threshold: 'Stable or growing',
        });
      }
    }
  }

  // 7. Liquidity Risk (Current Ratio < 1.0)
  if (fundamentals.currentRatio != null && fundamentals.currentRatio < 1.0) {
    flags.push({
      id: 'low-current-ratio',
      title: 'Liquidity Risk',
      message: `Current ratio of ${fundamentals.currentRatio.toFixed(2)}x means current liabilities exceed current assets — the company may struggle to meet short-term obligations.`,
      severity: 'danger',
      metric: 'Current Ratio',
      currentValue: `${fundamentals.currentRatio.toFixed(2)}x`,
      threshold: '> 1.0x',
    });
  }

  // 8. Low Interest Coverage (< 2x)
  if (analysis.interestCoverage != null && analysis.interestCoverage < 2) {
    flags.push({
      id: 'low-interest-coverage',
      title: 'Low Interest Coverage',
      message: `Interest coverage of ${analysis.interestCoverage.toFixed(1)}x means the company barely earns enough to cover its interest payments.`,
      severity: 'danger',
      metric: 'Interest Coverage',
      currentValue: `${analysis.interestCoverage.toFixed(1)}x`,
      threshold: '> 2.0x',
    });
  }

  // 9. Goodwill > 50% of Total Assets
  if (sortedBalanceSheets.length > 0) {
    const latest = sortedBalanceSheets[sortedBalanceSheets.length - 1];
    if (latest.goodwill != null && latest.totalAssets != null && latest.totalAssets > 0) {
      const goodwillRatio = (latest.goodwill / latest.totalAssets) * 100;
      if (goodwillRatio > 50) {
        flags.push({
          id: 'high-goodwill',
          title: 'High Goodwill Risk',
          message: `Goodwill represents ${goodwillRatio.toFixed(0)}% of total assets — a large writedown could significantly impact the balance sheet.`,
          severity: 'warning',
          metric: 'Goodwill/Assets',
          currentValue: `${goodwillRatio.toFixed(0)}%`,
          threshold: '< 50%',
        });
      }
    }
  }

  // Sort: dangers first, then warnings
  flags.sort((a, b) => {
    if (a.severity === 'danger' && b.severity === 'warning') return -1;
    if (a.severity === 'warning' && b.severity === 'danger') return 1;
    return 0;
  });

  return flags;
}

function fmtLargeNum(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}
