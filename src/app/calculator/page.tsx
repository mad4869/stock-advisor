import LotCalculator from '@/components/LotCalculator';

export default function CalculatorPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Position Size Calculator</h1>
        <p className="text-sm text-gray-400">
          Calculate how many lots (IDX) or shares (US) you can buy based on your capital, and get
          a risk-managed position size recommendation.
        </p>
      </div>

      <LotCalculator />

      {/* Educational Section */}
      <div className="mt-8 card">
        <h2 className="text-lg font-bold text-white mb-4">📚 Position Sizing 101</h2>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
          <div>
            <h3 className="font-bold text-white mb-1">Why Position Sizing Matters</h3>
            <p>
              Position sizing determines how much money you allocate to a single trade. Proper
              position sizing is one of the most important aspects of risk management — it protects
              your portfolio from catastrophic losses.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white mb-1">The 15% Rule</h3>
            <p>
              A common guideline is to never invest more than 10-20% of your total capital in a
              single stock. We use 15% as a balanced default. This ensures you can hold 6-7
              different stocks for diversification.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white mb-1">
              🇮🇩 Indonesian Market: Lot System
            </h3>
            <p>
              In Indonesia (IDX/BEI), stocks are traded in lots. <strong>1 lot = 100 shares</strong>
              . So if a stock costs Rp5,000 per share, buying 1 lot costs Rp500,000. You can only
              buy in whole lots (no fractional shares).
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white mb-1">🇺🇸 US Market: Per-Share</h3>
            <p>
              In the US market, you buy individual shares. Many brokers now support fractional
              shares, but this calculator uses whole shares for simplicity.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-white mb-1">Risk Per Trade</h3>
            <p>
              Professional traders typically risk 1-2% of their total capital per trade. This means
              if your stop-loss gets hit, you only lose 1-2% of your portfolio. Combined with proper
              position sizing, this keeps you in the game long-term.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
