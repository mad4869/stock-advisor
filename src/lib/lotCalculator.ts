import { Market, LotCalculation } from '@/types';

export function calculateLots(
  symbol: string,
  market: Market,
  price: number,
  initialFund: number,
  riskPercent: number = 2 // risk 2% per trade by default
): LotCalculation {
  const currency = market === 'ID' ? 'IDR' : 'USD';

  // Indonesian stocks: 1 lot = 100 shares
  // US stocks: 1 lot = 1 share (no lot system, but we use it for consistency)
  const sharesPerLot = market === 'ID' ? 100 : 1;
  const pricePerLot = price * sharesPerLot;

  // Maximum lots you can afford
  const maxLots = Math.floor(initialFund / pricePerLot);
  const totalLots = maxLots;
  const totalShares = totalLots * sharesPerLot;
  const totalCost = totalShares * price;
  const remainingFund = initialFund - totalCost;
  const positionPercent = (totalCost / initialFund) * 100;

  // Recommended position sizing:
  // Risk management: don't put more than 10-20% of capital in one stock
  // Risk per trade: 2% of capital
  const maxPositionValue = initialFund * 0.15; // 15% max per stock
  const recommendedLots = Math.max(1, Math.floor(maxPositionValue / pricePerLot));
  const actualRecommended = Math.min(recommendedLots, maxLots);

  let recommendedReason = '';
  if (market === 'ID') {
    const recCost = actualRecommended * sharesPerLot * price;
    const recPercent = (recCost / initialFund) * 100;
    recommendedReason = `We recommend buying ${actualRecommended} lots (${actualRecommended * sharesPerLot} shares) for Rp${recCost.toLocaleString('id-ID')} (${recPercent.toFixed(1)}% of your capital). This follows the rule of risking no more than 15% of your capital on a single stock, allowing for proper diversification.`;
  } else {
    const recCost = actualRecommended * price;
    const recPercent = (recCost / initialFund) * 100;
    recommendedReason = `We recommend buying ${actualRecommended} shares for $${recCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${recPercent.toFixed(1)}% of your capital). This follows the rule of risking no more than 15% of your capital on a single stock, allowing for proper diversification.`;
  }

  return {
    symbol,
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
  };
}