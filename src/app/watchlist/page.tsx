import WatchlistTable from '@/components/WatchlistTable';

export default function WatchlistPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Portfolio Watchlist</h1>
        <p className="text-sm text-gray-400">
          Track your purchased stocks, monitor P&L in real time, and get action recommendations
          based on technical analysis. Supports both US and Indonesian stocks.
        </p>
      </div>

      <WatchlistTable />

      {/* Guide Section */}
      <div className="mt-8 card">
        <h2 className="text-lg font-bold text-white mb-4">📖 Action Signals Guide</h2>

        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-dark-800 rounded-xl p-4">
            <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-emerald-400 text-sm">Strong Buy</h3>
              <p className="text-sm text-gray-400">
                Multiple indicators are showing strongly bullish signals. If you don&apos;t own this
                stock, consider buying. If you do, consider adding to your position.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-dark-800 rounded-xl p-4">
            <div className="w-3 h-3 rounded-full bg-green-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-green-400 text-sm">Buy</h3>
              <p className="text-sm text-gray-400">
                Several indicators suggest upward momentum. Consider this as a potential entry point,
                but verify with your own analysis.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-dark-800 rounded-xl p-4">
            <div className="w-3 h-3 rounded-full bg-yellow-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-yellow-400 text-sm">Hold</h3>
              <p className="text-sm text-gray-400">
                Signals are mixed or neutral. If you own the stock, continue holding. No strong
                reason to buy or sell at this time. Keep monitoring.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-dark-800 rounded-xl p-4">
            <div className="w-3 h-3 rounded-full bg-orange-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-orange-400 text-sm">Sell</h3>
              <p className="text-sm text-gray-400">
                Bearish signals are emerging. Consider taking partial or full profits if you&apos;re
                in a profitable position. Set tighter stop-losses.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-dark-800 rounded-xl p-4">
            <div className="w-3 h-3 rounded-full bg-red-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-400 text-sm">Strong Sell</h3>
              <p className="text-sm text-gray-400">
                Multiple indicators show strongly bearish signals or your stop-loss has been
                triggered. Strongly consider exiting the position to protect your capital.
              </p>
            </div>
          </div>
        </div>

        {/* Stop Loss / Take Profit Explanation */}
        <div className="mt-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <h3 className="font-bold text-red-400 text-sm mb-2">⚠️ About Stop-Loss &amp; Take-Profit</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            This watchlist is <strong className="text-gray-300">plan-based</strong>: if you record a
            stop-loss (SL) and/or take-profit (TP) price when adding a position, the app uses those
            exact levels in its action signals (e.g. “SL hit” / “TP hit”). If you record both, it can
            also infer your <strong className="text-gray-300">risk-reward factor</strong> (how many
            “R” you target relative to the distance from entry to SL).
            <br />
            <br />
            If SL/TP is missing, the app will still show indicator-based guidance, but it won&apos;t
            assume a fixed stop-loss % for you. For risk-based decisions, always define your SL/TP
            prices.
          </p>
        </div>

        {/* Trailing Stop */}
        <div className="mt-4 bg-green-500/5 border border-green-500/20 rounded-xl p-4">
          <h3 className="font-bold text-green-400 text-sm mb-2">📈 About Trailing Stops</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            When you&apos;re in profit (especially 15%+), we recommend using a{' '}
            <strong className="text-green-300">trailing stop</strong>. This means instead of selling
            at a fixed target, you set your stop-loss to trail behind the highest price. For example,
            if you set a 5% trailing stop and the stock hits +20%, your stop would be at +15%. This
            way, you protect most of your gains while still allowing for further upside.
          </p>
        </div>
      </div>
    </div>
  );
}