'use client';

import { useState } from 'react';
import { Market, LotCalculation } from '@/types';
import { Calculator, Info, Package, DollarSign, PieChart } from 'lucide-react';
import MarketToggle from './MarketToggle';
import StockSearch from './StockSearch';

export default function LotCalculator() {
  const [market, setMarket] = useState<Market>('US');
  const [symbol, setSymbol] = useState('');
  const [fund, setFund] = useState('');
  const [result, setResult] = useState<LotCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCalculate = async () => {
    if (!symbol || !fund || parseFloat(fund) <= 0) {
      setError('Please enter a valid stock symbol and fund amount.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/stock?symbol=${symbol}&market=${market}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const price = data.quote.price;
      const initialFund = parseFloat(fund);
      const currency = market === 'ID' ? 'IDR' : 'USD';
      const sharesPerLot = market === 'ID' ? 100 : 1;
      const pricePerLot = price * sharesPerLot;

      const maxLots = Math.floor(initialFund / pricePerLot);
      const totalShares = maxLots * sharesPerLot;
      const totalCost = totalShares * price;
      const remainingFund = initialFund - totalCost;
      const positionPercent = (totalCost / initialFund) * 100;

      const maxPositionValue = initialFund * 0.15;
      const recommendedLots = Math.max(1, Math.floor(maxPositionValue / pricePerLot));
      const actualRecommended = Math.min(recommendedLots, maxLots);

      let recommendedReason = '';
      if (market === 'ID') {
        const recCost = actualRecommended * sharesPerLot * price;
        const recPercent = (recCost / initialFund) * 100;
        recommendedReason = `We recommend buying ${actualRecommended} lot(s) (${(actualRecommended * sharesPerLot).toLocaleString('id-ID')} shares) for Rp${recCost.toLocaleString('id-ID')} (${recPercent.toFixed(1)}% of your capital). This follows the rule of risking no more than 15% of your capital on a single stock.`;
      } else {
        const recCost = actualRecommended * price;
        const recPercent = (recCost / initialFund) * 100;
        recommendedReason = `We recommend buying ${actualRecommended} share(s) for $${recCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${recPercent.toFixed(1)}% of your capital). This follows the rule of risking no more than 15% of your capital on a single stock.`;
      }

      setResult({
        symbol: symbol.toUpperCase(),
        market,
        price,
        currency,
        initialFund,
        lotSize: sharesPerLot,
        sharesPerLot,
        totalShares,
        totalLots: maxLots,
        totalCost,
        remainingFund,
        positionPercent,
        recommendedLots: actualRecommended,
        recommendedReason,
      });
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
            <p className="text-sm text-gray-400 mb-1">Current Price</p>
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
          </div>
        </div>
      )}
    </div>
  );
}