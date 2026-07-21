import { getComprehensiveAnalysis2 } from './src/lib/yahooFinance2.js';

async function checkStock(symbol) {
  try {
    const analysis = await getComprehensiveAnalysis2(symbol);
    const f = analysis.fundamentals;
    console.log(`\n--- ${symbol} ---`);
    console.log(`Revenue Growth YoY:`, f.revenueGrowth);
    console.log(`Rev CAGR (3Y):`, analysis.cagr.revenue3Y);
    console.log(`EPS CAGR (3Y):`, analysis.cagr.eps3Y);
    console.log(`FCF:`, f.freeCashFlow);
    console.log(`ROE:`, f.roe);
    console.log(`PEG Ratio:`, f.pegRatio);
    console.log(`Forward PE:`, f.forwardPE);
    console.log(`Debt/Equity:`, f.debtToEquity);
    console.log(`Interest Cov:`, analysis.interestCoverage);
  } catch(e) {
    console.error(e);
  }
}

async function main() {
  await checkStock('BBCA.JK');
  await checkStock('AMMN.JK');
  await checkStock('BMRI.JK');
  await checkStock('BRPT.JK');
  await checkStock('ASII.JK');
}
main();
