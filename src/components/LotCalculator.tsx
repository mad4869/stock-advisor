'use client';

import { useState } from 'react';
import { Market, LotCalculation } from '@/types';
import { Calculator, Info, Package, DollarSign, PieChart } from 'lucide-react';
import MarketToggle from './MarketToggle';
import StockSearch from './StockSearch';
import { calculateLots } from '@/lib/lotCalculator';

export default function LotCalculator() {
  const [market, setMarket] = useState<Market>('US');
  const [symbol, setSymbol] = useState('');
  const [fund, setFund] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [strictRiskBasedOnly, setStrictRiskBasedOnly] = useState(false);
  const [bufferPercent, setBufferPercent] = useState('0');
  const [feePerShare, setFeePerShare] = useState('');
  const [result, setResult] = useState<LotCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCalculate = async () => {
    const initialFund = parseFloat(fund);
    const risk = parseFloat(riskPercent);
    const manualEntry = entryPrice ? parseFloat(entryPrice) : NaN;
    const stop = stopLoss ? parseFloat(stopLoss) : NaN;
    const buffer = bufferPercent ? parseFloat(bufferPercent) : 0;
    const fee = feePerShare ? parseFloat(feePerShare) : 0;

    if (!symbol || !fund || !Number.isFinite(initialFund) || initialFund <= 0) {
      setError('Please enter a valid stock symbol and fund amount.');
      return;
    }

    if (!Number.isFinite(risk) || risk <= 0 || risk > 100) {
      setError('Please enter a valid risk % (e.g., 1 for 1%).');
      return;
    }

    if (!Number.isFinite(buffer) || buffer < 0 || buffer > 100) {
      setError('Please enter a valid buffer % (0–100).');
      return;
    }

    if (feePerShare && (!Number.isFinite(fee) || fee < 0)) {
      setError('Please enter a valid fee/slippage per share (>= 0).');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/stock?symbol=${symbol}&market=${market}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const quotePrice = data.quote.price;
      const usedEntryPrice =
        Number.isFinite(manualEntry) && manualEntry > 0 ? manualEntry : quotePrice;

      if (stopLoss && (!Number.isFinite(stop) || stop <= 0)) {
        throw new Error('Please enter a valid stop-loss price.');
      }

      if (Number.isFinite(stop) && stop >= usedEntryPrice) {
        throw new Error('Stop-loss must be below entry price (for long positions).');
      }

      const calc = calculateLots(
        symbol.toUpperCase(),
        market,
        usedEntryPrice,
        initialFund,
        risk,
        Number.isFinite(stop) ? stop : null,
        {
          strictRiskBasedOnly,
          bufferPercent: buffer,
          feePerShare: Number.isFinite(fee) && fee > 0 ? fee : 0,
        }
      );
      setResult(calc);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate.');
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = market === 'ID' ? 'Rp' : '$';
  const locale = market === 'ID' ? 'id-ID' : 'en-US';

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Position Size Calculator</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Market</label>
            <MarketToggle market={market} onChange={setMarket} />
          </div>

          <div>
            <label className="label">Stock Symbol</label>
            <StockSearch
              market={market}
              onSelect={(s) => setSymbol(s)}
              placeholder={market === 'ID' ? 'e.g., BBCA, TLKM' : 'e.g., AAPL, MSFT'}
            />
          </div>

          <div>
            <label className="label">
              Initial Fund ({currencySymbol})
            </label>
            <input
              type="number"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              placeholder={market === 'ID' ? 'e.g., 10000000' : 'e.g., 10000'}
              className="input-field"
              min="0"
            />
            {market === 'ID' && fund && parseFloat(fund) > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                = Rp{parseFloat(fund).toLocaleString('id-ID')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Risk per trade (%)</label>
              <input
                type="number"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                placeholder="e.g., 1"
                className="input-field"
                min="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">Max loss if stop hits (e.g., 1% of capital).</p>
            </div>

            <div>
              <label className="label">
                Stop-loss price ({currencySymbol}) <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={market === 'ID' ? 'e.g., 4800' : 'e.g., 180'}
                className="input-field"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">If filled, recommendation becomes risk-based.</p>
            </div>
          </div>

          <div className="bg-dark-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <input
                id="strictRiskBasedOnly"
                type="checkbox"
                checked={strictRiskBasedOnly}
                onChange={(e) => setStrictRiskBasedOnly(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="strictRiskBasedOnly" className="text-sm font-bold text-white">
                  Strict risk-based only
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  If ON, the calculator will only give a recommendation when a valid stop-loss is provided.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Buffer (%)</label>
              <input
                type="number"
                value={bufferPercent}
                onChange={(e) => setBufferPercent(e.target.value)}
                placeholder="e.g., 0.5"
                className="input-field"
                min="0"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Adds a safety margin to stop distance (slippage/fees).
              </p>
            </div>
            <div>
              <label className="label">
                Fee/Slippage per share ({currencySymbol}) <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="number"
                value={feePerShare}
                onChange={(e) => setFeePerShare(e.target.value)}
                placeholder={market === 'ID' ? 'e.g., 5' : 'e.g., 0.02'}
                className="input-field"
                min="0"
                step={market === 'ID' ? '1' : '0.01'}
              />
              <p className="text-xs text-gray-500 mt-1">
                Absolute buffer per share (in addition to Buffer %).
              </p>
            </div>
          </div>

          <div>
            <label className="label">
              Entry price ({currencySymbol}) <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="Defaults to current price"
              className="input-field"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">Use this if your planned entry differs from the current quote.</p>
          </div>

          <button
            onClick={handleCalculate}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                Calculate Position Size
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">
              {result.symbol} — Position Sizing
            </h3>
            <span className="text-xs bg-dark-600 text-gray-400 px-2 py-1 rounded-full">
              {result.market === 'ID' ? '🇮🇩 IDX' : '🇺🇸 US'}
            </span>
          </div>

          {/* Price */}
          <div className="bg-dark-800 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-400 mb-1">Entry Price Used</p>
            <p className="text-2xl font-bold text-white">
              {currencySymbol}
              {result.price.toLocaleString(locale, {
                minimumFractionDigits: market === 'ID' ? 0 : 2,
              })}
            </p>
            {market === 'ID' && (
              <p className="text-xs text-gray-500 mt-1">
                1 lot = 100 shares = {currencySymbol}
                {(result.price * 100).toLocaleString(locale)}
              </p>
            )}
            {result.stopLossPrice && (
              <p className="text-xs text-gray-500 mt-1">
                Stop-loss: {currencySymbol}
                {result.stopLossPrice.toLocaleString(locale, {
                  minimumFractionDigits: market === 'ID' ? 0 : 2,
                })}
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-gray-500">Max {market === 'ID' ? 'Lots' : 'Shares'}</p>
              </div>
              <p className="text-xl font-bold text-white">
                {result.totalLots.toLocaleString(locale)}
              </p>
              {market === 'ID' && (
                <p className="text-xs text-gray-500">
                  = {result.totalShares.toLocaleString(locale)} shares
                </p>
              )}
            </div>

            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" />
                <p className="text-xs text-gray-500">Total Cost</p>
              </div>
              <p className="text-xl font-bold text-white">
                {currencySymbol}
                {result.totalCost.toLocaleString(locale, {
                  minimumFractionDigits: market === 'ID' ? 0 : 2,
                })}
              </p>
            </div>

            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-gray-500">Portfolio %</p>
              </div>
              <p className="text-xl font-bold text-white">
                {result.positionPercent.toFixed(1)}%
              </p>
            </div>

            <div className="bg-dark-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
              <p className="text-xl font-bold text-white">
                {currencySymbol}
                {result.remainingFund.toLocaleString(locale, {
                  minimumFractionDigits: market === 'ID' ? 0 : 2,
                })}
              </p>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-bold text-blue-400">
                Recommended: {result.recommendedLots}{' '}
                {market === 'ID' ? 'lot(s)' : 'share(s)'}
              </h4>
            </div>
            <p className="text-sm text-blue-200/80 leading-relaxed">
              {result.recommendedReason}
            </p>
            {result.stopLossPrice && result.maxLossAtStop != null && (
              <p className="text-xs text-blue-200/70 mt-3">
                Max loss at stop: {currencySymbol}
                {result.maxLossAtStop.toLocaleString(locale, {
                  minimumFractionDigits: market === 'ID' ? 0 : 2,
                  maximumFractionDigits: market === 'ID' ? 0 : 2,
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}