import { Market, LotCalculation } from '@/types';

export function calculateLots(
  symbol: string,
  market: Market,
  entryPrice: number,
  initialFund: number,
  riskPercent: number = 1, // risk 1% per trade by default
  stopLossPrice?: number | null,
  options?: {
    strictRiskBasedOnly?: boolean;
    bufferPercent?: number; // increases stop distance by % (slippage/fees buffer)
    feePerShare?: number; // absolute cost per share (same currency as price)
  }
): LotCalculation {
  const currency = market === 'ID' ? 'IDR' : 'USD';

  // Indonesian stocks: 1 lot = 100 shares
  // US stocks: 1 lot = 1 share (no lot system, but we use it for consistency)
  const sharesPerLot = market === 'ID' ? 100 : 1;
  const pricePerLot = entryPrice * sharesPerLot;

  // Maximum lots you can afford
  const maxLots = Math.floor(initialFund / pricePerLot);
  const totalLots = maxLots;
  const totalShares = totalLots * sharesPerLot;
  const totalCost = totalShares * entryPrice;
  const remainingFund = initialFund - totalCost;
  const positionPercent = (totalCost / initialFund) * 100;

  // Recommended position sizing (risk-based):
  // riskAmount = initialFund * riskPercent
  // quantity = floor(riskAmount / (entryPrice - stopLossPrice))
  const riskAmount = initialFund * (riskPercent / 100);

  const stop =
    typeof stopLossPrice === 'number' && Number.isFinite(stopLossPrice) ? stopLossPrice : null;
  const isValidStop = stop !== null && stop > 0 && stop < entryPrice;
  const riskPerShare = isValidStop ? entryPrice - stop! : null;
  const strictRiskBasedOnly = options?.strictRiskBasedOnly ?? false;
  const bufferPercent = options?.bufferPercent ?? 0;
  const feePerShare = options?.feePerShare ?? 0;

  const bufferMultiplier = bufferPercent > 0 ? 1 + bufferPercent / 100 : 1;
  const effectiveRiskPerShare =
    riskPerShare && riskPerShare > 0
      ? riskPerShare * bufferMultiplier + (feePerShare > 0 ? feePerShare : 0)
      : null;

  const maxLotsByRisk =
    effectiveRiskPerShare && effectiveRiskPerShare > 0
      ? Math.floor(riskAmount / (effectiveRiskPerShare * sharesPerLot))
      : null;

  const candidateLots: number[] = [maxLots];
  if (typeof maxLotsByRisk === 'number') candidateLots.push(maxLotsByRisk);

  const actualRecommended = strictRiskBasedOnly
    ? isValidStop
      ? Math.max(0, Math.min(...candidateLots))
      : 0
    : Math.max(0, Math.min(...candidateLots));
  const recommendedShares = actualRecommended * sharesPerLot;
  const recommendedCost = recommendedShares * entryPrice;
  const recommendedPercent = initialFund > 0 ? (recommendedCost / initialFund) * 100 : 0;
  const maxLossAtStop = effectiveRiskPerShare ? recommendedShares * effectiveRiskPerShare : null;

  let recommendedReason = '';
  if (market === 'ID') {
    const recCost = recommendedCost;
    const recPercent = recommendedPercent;
    const bufferPart =
      bufferPercent > 0 || feePerShare > 0
        ? ` (buffer: ${bufferPercent > 0 ? `${bufferPercent}%` : '0%'}${feePerShare > 0 ? ` + Rp${feePerShare.toLocaleString('id-ID')}/share` : ''})`
        : '';

    if (!isValidStop) {
      recommendedReason = strictRiskBasedOnly
        ? `Strict risk-based mode is ON, but stop-loss is missing/invalid. Please enter a valid stop-loss below entry to get a position size recommendation.`
        : `Without a stop-loss price, we can’t size the position based on “max loss per trade”. The recommendation below is limited by what you can afford. Add a stop-loss price to get a risk-based (1–2% rule) position size.`;
    } else if (actualRecommended === 0) {
      recommendedReason = `Your stop-loss is too tight relative to your risk limit: with risk ${riskPercent}% (≈ Rp${riskAmount.toLocaleString('id-ID')}) and effective stop distance Rp${effectiveRiskPerShare!.toLocaleString('id-ID')}/share${bufferPart}, the risk-based size rounds down to 0 lot. Increase risk %, widen stop-loss, or use a cheaper entry.`;
    } else {
      recommendedReason = `Recommended size is ${actualRecommended} lot(s) (${recommendedShares.toLocaleString('id-ID')} shares) for Rp${recCost.toLocaleString('id-ID')} (${recPercent.toFixed(1)}% of your capital). With entry Rp${entryPrice.toLocaleString('id-ID')} and stop Rp${stop!.toLocaleString('id-ID')}, max loss at stop is ≈ Rp${maxLossAtStop!.toLocaleString('id-ID')} (≤ ${riskPercent}% of capital)${bufferPart}.`;
    }
  } else {
    const recCost = recommendedCost;
    const recPercent = recommendedPercent;
    const bufferPart =
      bufferPercent > 0 || feePerShare > 0
        ? ` (buffer: ${bufferPercent > 0 ? `${bufferPercent}%` : '0%'}${feePerShare > 0 ? ` + $${feePerShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/share` : ''})`
        : '';

    if (!isValidStop) {
      recommendedReason = strictRiskBasedOnly
        ? `Strict risk-based mode is ON, but stop-loss is missing/invalid. Please enter a valid stop-loss below entry to get a position size recommendation.`
        : `Without a stop-loss price, we can’t size the position based on “max loss per trade”. The recommendation below is limited by what you can afford. Add a stop-loss price to get a risk-based (1–2% rule) position size.`;
    } else if (actualRecommended === 0) {
      recommendedReason = `Your stop-loss is too tight relative to your risk limit: with risk ${riskPercent}% (≈ $${riskAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) and effective stop distance $${effectiveRiskPerShare!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/share${bufferPart}, the risk-based size rounds down to 0 shares. Increase risk %, widen stop-loss, or use a cheaper entry.`;
    } else {
      recommendedReason = `Recommended size is ${actualRecommended} share(s) for $${recCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${recPercent.toFixed(1)}% of your capital). With entry $${entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} and stop $${stop!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, max loss at stop is ≈ $${maxLossAtStop!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (≤ ${riskPercent}% of capital)${bufferPart}.`;
    }
  }

  return {
    symbol,
    market,
    price: entryPrice,
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
    stopLossPrice: stop,
    riskPercent,
    riskAmount,
    riskPerShare,
    maxLossAtStop,
    strictRiskBasedOnly,
    bufferPercent,
    feePerShare,
    effectiveRiskPerShare,
  };
}