import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();

export interface SmartMoneyMetrics {
  institutionsNetIncrease: boolean | null;
  insiderNetBuy: boolean | null;
  shortFloatLow: boolean | null;
  callPutRatioBullish: boolean | null;
  
  availableMetrics: number;
  passingMetrics: number;
  isPass: boolean; // meets "pass all available" or "2 out of 3" etc
  logs: string[];
}

export async function fetchSmartMoney(symbol: string, market: 'US' | 'ID'): Promise<SmartMoneyMetrics> {
  const isUS = market === 'US';
  const logs: string[] = [];
  
  let instNetIncrease: boolean | null = null;
  let insiderNetBuy: boolean | null = null;
  let shortFloatLow: boolean | null = null;
  let cpBullish: boolean | null = null;

  try {
    const summary = await yf.quoteSummary(symbol, {
      modules: ['institutionOwnership', 'insiderTransactions', 'defaultKeyStatistics']
    });

    // 1. Institutional Ownership
    if (summary.institutionOwnership && Array.isArray(summary.institutionOwnership.ownershipList)) {
      const topHolders = summary.institutionOwnership.ownershipList;
      if (topHolders.length > 0) {
        let totalPctChange = 0;
        let validPctChanges = 0;

        for (const holder of topHolders) {
          if (typeof holder.pctChange === 'number') {
            totalPctChange += holder.pctChange;
            validPctChanges++;
          }
        }

        if (validPctChanges > 0) {
          instNetIncrease = totalPctChange > 0;
          logs.push(`Inst Ownership: ${instNetIncrease ? 'Passed' : 'Failed'} (Net change: ${(totalPctChange * 100).toFixed(2)}%)`);
        } else {
          // Fallback for IDX or if pctChange is entirely missing
          // Compare positions if multiple quarters exist (rare in this module), or skip
          logs.push('Inst Ownership: Skipped (pctChange data unavailable)');
        }
      } else {
         logs.push('Inst Ownership: Skipped (No top holders listed)');
      }
    } else {
       logs.push('Inst Ownership: Skipped (Module empty)');
    }

    // 2. Insider Transactions
    if (summary.insiderTransactions && Array.isArray(summary.insiderTransactions.transactions)) {
      const transactions = summary.insiderTransactions.transactions;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      let netShares = 0;
      let validTxs = 0;

      for (const tx of transactions) {
        if (tx.startDate && new Date(tx.startDate) >= ninetyDaysAgo) {
          const txt = (tx.transactionText || '').toLowerCase();
          const shares = tx.shares || 0;
          
          if (txt.includes('buy') || txt.includes('purchase')) {
            netShares += shares;
            validTxs++;
          } else if (txt.includes('sell') || txt.includes('sale')) {
            netShares -= shares;
            validTxs++;
          }
        }
      }

      if (validTxs > 0) {
        insiderNetBuy = netShares > 0;
        logs.push(`Insider Tx: ${insiderNetBuy ? 'Passed' : 'Failed'} (Net shares 90d: ${netShares})`);
      } else {
        logs.push('Insider Tx: Skipped (No activity last 90 days)');
      }
    } else {
      logs.push('Insider Tx: Skipped (Module empty)');
    }

    // 3. Short Interest
    const stats = summary.defaultKeyStatistics;
    if (stats && typeof stats.shortPercentOfFloat === 'number') {
      const shortFloat = stats.shortPercentOfFloat;
      shortFloatLow = shortFloat < 0.15;
      logs.push(`Short Float: ${shortFloatLow ? 'Passed' : 'Failed'} (${(shortFloat * 100).toFixed(2)}% vs <15%)`);
    } else {
      logs.push('Short Float: Skipped (Data unavailable)');
    }

  } catch (err: any) {
    logs.push(`QuoteSummary Fetch Error: ${err.message}`);
  }

  // 4. Options Data (US Only)
  if (isUS) {
    try {
      const opt = await yf.options(symbol);
      if (opt.options && opt.options.length > 0) {
        const nearestExpiry = opt.options[0];
        let callOI = 0;
        let putOI = 0;

        (nearestExpiry.calls || []).forEach(c => callOI += (c.openInterest || 0));
        (nearestExpiry.puts || []).forEach(p => putOI += (p.openInterest || 0));

        if (callOI > 0 || putOI > 0) {
          const cpRatio = putOI === 0 ? 999 : callOI / putOI;
          cpBullish = cpRatio > 1.2;
          logs.push(`Options C/P: ${cpBullish ? 'Passed' : 'Failed'} (Ratio: ${cpRatio.toFixed(2)})`);
        } else {
          logs.push('Options C/P: Skipped (No Open Interest)');
        }
      } else {
        logs.push('Options C/P: Skipped (No options chain found)');
      }
    } catch (err: any) {
       logs.push(`Options Fetch Error: ${err.message}`);
    }
  }

  // Evaluate final pass/fail
  const results = [instNetIncrease, insiderNetBuy, shortFloatLow];
  if (isUS) results.push(cpBullish);

  const available = results.filter(r => r !== null).length;
  const passed = results.filter(r => r === true).length;
  
  // Rule: Pass all available metrics. If none available, technically 0/0 passes. We should require at least 1 valid metric to call it a "Pass", but the user said "If only 1 valid metric exists and it passes, count it. Lower the bar."
  // Wait, the user said "pass all available metrics rather than a fixed count". 
  // If available == 0, we can say it passed by default to not penalize.
  const isPass = available > 0 ? (passed === available) : true;

  if (available === 0) {
    logs.push('Smart Money: Auto-passed (0 metrics available)');
  }

  return {
    institutionsNetIncrease: instNetIncrease,
    insiderNetBuy,
    shortFloatLow,
    callPutRatioBullish: cpBullish,
    availableMetrics: available,
    passingMetrics: passed,
    isPass,
    logs
  };
}
