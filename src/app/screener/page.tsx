import StockScreener from '@/components/StockScreener';

export default function ScreenerPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Stock Screener
        </h1>
        <p className="text-sm text-gray-400">
          Filter stocks by fundamental metrics to find undervalued opportunities.
          Choose a preset strategy or customize filters to match your investment criteria.
        </p>
      </div>

      <StockScreener />

      {/* How It Works */}
      <div className="mt-8 card">
        <h2 className="text-lg font-bold text-white mb-4">🔍 How the Screener Works</h2>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          <div>
            <h3 className="font-bold text-white mb-1">Data Source</h3>
            <p>
              Fundamental data is fetched in real-time from Yahoo Finance. Data is cached
              for 30 minutes to improve speed on repeat scans. Coverage is best for
              large-cap stocks; smaller stocks may have incomplete data.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white mb-1">Preset Strategies</h3>
            <p>
              Three built-in presets based on classic investment strategies:
              <strong className="text-white"> Conservative Value</strong> (Graham style),
              <strong className="text-white"> GARP</strong> (Growth at Reasonable Price), and
              <strong className="text-white"> Deep Value</strong> (contrarian bargain hunting).
              Each pre-fills the filters — you can customize any preset by editing the values.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white mb-1">Custom Symbols</h3>
            <p>
              The default US universe is small (~10 stocks). Add more tickers in the
              &quot;Additional Symbols&quot; field to screen them. For Indonesian stocks,
              the full IDX list (~130 stocks) is included by default.
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <h3 className="font-bold text-blue-400 mb-1">💡 Tip</h3>
            <p className="text-blue-200/80">
              A stock must pass <strong>all</strong> active filters to appear in results.
              Start with fewer filters and add more to narrow down. Click column headers
              to sort the results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
