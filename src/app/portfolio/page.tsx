import PortfolioDashboard from '@/components/PortfolioDashboard';

export default function PortfolioPage() {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Portfolio Dashboard</h1>
                <p className="text-sm text-gray-400">
                    Track your total portfolio performance, P&L history over time, and closed
                    positions. Data is saved locally in your browser.
                </p>
            </div>

            <PortfolioDashboard />

            {/* How It Works */}
            <div className="mt-8 card">
                <h2 className="text-lg font-bold text-white mb-4">📊 How P&L Tracking Works</h2>

                <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                    <div>
                        <h3 className="font-bold text-white mb-1">Daily Snapshots</h3>
                        <p>
                            Every time you visit this page or refresh your watchlist, we save a daily
                            snapshot of your portfolio&apos;s total value. This builds up a history that
                            shows how your portfolio has performed over days, weeks, and months.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-white mb-1">Unrealized vs Realized P&L</h3>
                        <p>
                            <strong className="text-white">Unrealized P&L</strong> is the profit/loss on
                            stocks you still hold — it changes daily.{' '}
                            <strong className="text-white">Realized P&L</strong> is locked in when you sell
                            — use the &quot;Close Position&quot; feature in your watchlist to record a sale.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold text-white mb-1">Data Storage</h3>
                        <p>
                            All data is stored in your browser&apos;s localStorage. It persists across
                            sessions but is tied to this device/browser. Up to 365 days of snapshots are
                            kept automatically. No account or database needed.
                        </p>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <h3 className="font-bold text-blue-400 mb-1">💡 Tip: Visit Daily</h3>
                        <p className="text-blue-200/80">
                            For the best P&L history chart, visit the app at least once per trading day.
                            Each visit records a snapshot. The more snapshots, the more detailed your
                            performance chart becomes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}