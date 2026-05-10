const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance();

async function test() {
  const chartRes = await yf.chart('AAPL', { period1: '2023-01-01', period2: '2023-01-10', interval: '1d' });
  console.log('chartRes keys:', Object.keys(chartRes));
  console.log('chartRes.quotes length:', chartRes.quotes?.length);
  if(chartRes.quotes) console.log('chartRes.quotes[0]:', chartRes.quotes[0]);
}
test();
