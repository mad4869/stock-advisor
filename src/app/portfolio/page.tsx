import PortfolioDashboard from '@/components/PortfolioDashboard';

export default function PortfolioPage() {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Portfolio Dashboard</h1>
                <p className="text-sm text-gray-400">
                    Track your portfolio performance across both US (USD) and Indonesian (IDR) markets
                    with separate P&L tracking for each currency.
                </p>
            </div>

            <PortfolioDashboard />

            {/* Info */}
            <div className="mt-8 card">
                <h2 className="text-lg font-bold text-white mb-4">📊 How It Works</h2>

                <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                    <div>
                        <h3 className="font-bold text-white mb-1">Dual-Currency Tracking</h3>
                        <p>
                            US and Indonesian positions are tracked <strong className="text-white">separately</strong>.
                            P&L for US stocks is shown in <strong className="text-blue-400">USD ($)</strong>,
                            and IDX stocks in <strong className="text-blue-400">IDR (Rp)</strong>.
                            This prevents misleading totals from mixing currencies.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-white mb-1">Daily Snapshots</h3>
                        <p>
                            Each time you visit and your watchlist refreshes, we save a daily snapshot
                            per market. The chart lets you toggle between US and IDX to see each
                            portfolio&apos;s history independently.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-white mb-1">Unrealized vs Realized P&L</h3>
                        <p>
                            <strong className="text-white">Unrealized P&L</strong> = profit/loss on stocks you
                            still hold.{' '}
                            <strong className="text-white">Realized P&L</strong> = locked in when you sell via
                            the &quot;Close Position&quot; button in your watchlist. Both are tracked per market.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                            <h4 className="font-bold text-white mb-2">🇺🇸 US Market</h4>
                            <ul className="text-xs text-gray-400 space-y-1">
                                <li>• Currency: <span className="text-white">USD ($)</span></li>
                                <li>• Unit: <span className="text-white">Per share</span></li>
                                <li>• P&L calculated in dollars</li>
                            </ul>
                        </div>
                        <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
                            <h4 className="font-bold text-white mb-2">🇮🇩 Indonesian Market</h4>
                            <ul className="text-xs text-gray-400 space-y-1">
                                <li>• Currency: <span className="text-white">IDR (Rp)</span></li>
                                <li>• Unit: <span className="text-white">Per lot (100 shares)</span></li>
                                <li>• P&L calculated in rupiah</li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <h3 className="font-bold text-blue-400 mb-1">💡 Tip</h3>
                        <p className="text-blue-200/80">
                            Visit the app at least once per trading day to build your P&L history.
                            The chart becomes more useful as more daily snapshots are recorded.
                            Up to 365 days of history are stored in your browser.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}