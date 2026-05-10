const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance();

async function test() {
  try {
    const q = await yf.quoteSummary('AAPL', { modules: ['institutionOwnership', 'insiderTransactions', 'majorHoldersBreakdown', 'defaultKeyStatistics'] });
    console.log("defaultKeyStatistics shortFloat:", q.defaultKeyStatistics?.shortPercentOfFloat);
    console.log("majorHolders:", Object.keys(q.majorHoldersBreakdown || {}));
    console.log("majorHolders values:", q.majorHoldersBreakdown);
    console.log("insiderTransactions[0]:", q.insiderTransactions?.transactions ? q.insiderTransactions.transactions[0] : (q.insiderTransactions ? q.insiderTransactions[0] : 'None'));
    console.log("institutionOwnership[0]:", q.institutionOwnership?.ownershipList ? q.institutionOwnership.ownershipList[0] : (q.institutionOwnership ? q.institutionOwnership[0] : 'None'));
    
    // Check options
    const opt = await yf.options('AAPL');
    const calls = opt.options[0]?.calls?.length || 0;
    const puts = opt.options[0]?.puts?.length || 0;
    console.log("Calls:", calls, "Puts:", puts);
  } catch(e) {
    console.error(e);
  }
}
test();
