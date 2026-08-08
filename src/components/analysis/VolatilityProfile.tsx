'use client';

import { TAData } from '@/lib/technicalIndicators';

interface Props {
  fundamentalsBeta: number | null;
  taData: TAData;
  market: 'ID' | 'US';
}

function BetaGauge({ beta }: { beta: number | null }) {
  if (beta == null) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 flex flex-col items-center justify-center gap-1 min-h-[110px]">
        <p className="text-[10px] text-gray-500">Beta (vs Market)</p>
        <p className="text-2xl font-bold text-gray-600">—</p>
        <p className="text-[9px] text-gray-600">No data</p>
      </div>
    );
  }

  let color: string;
  let label: string;
  let labelColor: string;
  if (beta < 0) {
    color = '#a855f7'; label = 'Inverse'; labelColor = 'text-purple-400';
  } else if (beta < 0.5) {
    color = '#22c55e'; label = 'Very Low'; labelColor = 'text-green-400';
  } else if (beta < 0.8) {
    color = '#86efac'; label = 'Low'; labelColor = 'text-green-300';
  } else if (beta < 1.0) {
    color = '#eab308'; label = 'Moderate'; labelColor = 'text-yellow-400';
  } else if (beta < 1.3) {
    color = '#f97316'; label = 'Market-like'; labelColor = 'text-orange-400';
  } else if (beta < 1.8) {
    color = '#ef4444'; label = 'High'; labelColor = 'text-red-400';
  } else {
    color = '#dc2626'; label = 'Very High'; labelColor = 'text-red-500';
  }

  const gaugeMax = 2.5;
  const clamped = Math.min(Math.max(beta, 0), gaugeMax);
  const angle = (clamped / gaugeMax) * 180;

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 flex flex-col items-center">
      <p className="text-[10px] text-gray-500 mb-1">Beta (vs Market)</p>
      <div className="relative mx-auto overflow-hidden" style={{ width: '120px', height: '60px' }}>
        <svg viewBox="0 0 120 60" className="w-full h-full" style={{ overflow: 'hidden' }}>
          <path d="M 15 50 A 45 45 0 0 1 105 50" fill="none" stroke="#2a2a3d" strokeWidth="8" strokeLinecap="round" />
          <path
            d="M 15 50 A 45 45 0 0 1 105 50"
            fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.4} 141.4`}
            className="transition-all duration-700"
          />
        </svg>
      </div>
      <p className="text-xl font-bold text-white -mt-1">{beta.toFixed(2)}</p>
      <span className={`text-[10px] font-semibold mt-0.5 ${labelColor}`}>{label} Volatility</span>
      <p className="text-[9px] text-gray-600 mt-0.5">1.0 = same as market</p>
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-white' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function VolatilityProfile({ fundamentalsBeta, taData: ta, market }: Props) {
  const atr = ta.atrPercent;
  const high52w = ta.fiftyTwoWeekHigh;
  const low52w = ta.fiftyTwoWeekLow;
  const bollingerB = ta.bollingerB;
  const maxAtr = market === 'ID' ? 12 : 8;

  let atrColor = 'text-green-400';
  if (atr != null) {
    if (market === 'ID') {
      if (atr > 5) atrColor = 'text-red-400';
      else if (atr > 3) atrColor = 'text-yellow-400';
    } else {
      if (atr > 4) atrColor = 'text-red-400';
      else if (atr > 2.5) atrColor = 'text-yellow-400';
    }
  }

  let rangePosition: number | null = null;
  if (high52w != null && low52w != null && high52w > low52w) {
    rangePosition = ((ta.close - low52w) / (high52w - low52w)) * 100;
  }

  let bbColor = 'text-yellow-400';
  let bbLabel = 'Mid-band';
  if (bollingerB != null) {
    if (bollingerB <= 0.2) { bbColor = 'text-green-400'; bbLabel = 'Near Lower Band'; }
    else if (bollingerB >= 0.8) { bbColor = 'text-red-400'; bbLabel = 'Near Upper Band'; }
  }

  let defensiveScore = 0;
  let defensiveLabel = 'N/A';
  let defensiveColor = 'text-gray-500';
  if (fundamentalsBeta != null && atr != null) {
    if (fundamentalsBeta > 0 && fundamentalsBeta < 0.8) defensiveScore += 40;
    else if (fundamentalsBeta >= 0.8 && fundamentalsBeta < 1.0) defensiveScore += 20;
    const atrThresh = market === 'ID' ? 3.0 : 2.0;
    if (atr < atrThresh) defensiveScore += 40;
    else if (atr < atrThresh * 1.5) defensiveScore += 20;
    if (rangePosition != null && rangePosition < 60) defensiveScore += 20;
    if (defensiveScore >= 80) { defensiveLabel = 'Excellent'; defensiveColor = 'text-green-400'; }
    else if (defensiveScore >= 60) { defensiveLabel = 'Good'; defensiveColor = 'text-green-300'; }
    else if (defensiveScore >= 40) { defensiveLabel = 'Moderate'; defensiveColor = 'text-yellow-400'; }
    else { defensiveLabel = 'Aggressive'; defensiveColor = 'text-red-400'; }
  }

  const atrFill = atr != null
    ? (atr < (market === 'ID' ? 3 : 2) ? '#22c55e' : atr < (market === 'ID' ? 5 : 4) ? '#eab308' : '#ef4444')
    : '#2a2a3d';

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        📉 Volatility Profile
        <span className="text-[10px] text-gray-500 font-normal">
          (how much this stock moves vs the market)
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <BetaGauge beta={fundamentalsBeta} />
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 flex flex-col items-center">
          <p className="text-[10px] text-gray-500 mb-1">ATR% (Daily Swing)</p>
          {atr != null ? (
            <>
              <div className="relative mx-auto overflow-hidden" style={{ width: '120px', height: '60px' }}>
                <svg viewBox="0 0 120 60" className="w-full h-full" style={{ overflow: 'hidden' }}>
                  <path d="M 15 50 A 45 45 0 0 1 105 50" fill="none" stroke="#2a2a3d" strokeWidth="8" strokeLinecap="round" />
                  <path
                    d="M 15 50 A 45 45 0 0 1 105 50"
                    fill="none" stroke={atrFill} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${Math.min(atr / maxAtr, 1) * 141.4} 141.4`}
                    className="transition-all duration-700"
                  />
                </svg>
              </div>
              <p className={`text-xl font-bold -mt-1 ${atrColor}`}>{atr.toFixed(1)}%</p>
              <p className="text-[9px] text-gray-600 mt-0.5">avg daily range (14-day ATR)</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-600 mt-4">—</p>
          )}
        </div>
      </div>

      {high52w != null && low52w != null && rangePosition != null && (
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] text-gray-500">52-Week Price Range</p>
            <span className="text-[10px] text-gray-400">
              Position:{' '}
              <span className={`font-semibold ${rangePosition > 70 ? 'text-red-400' : rangePosition < 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                {rangePosition.toFixed(0)}% from low
              </span>
            </span>
          </div>
          <div className="relative h-3 bg-dark-600 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full w-full rounded-full opacity-30"
              style={{ background: 'linear-gradient(to right, #22c55e, #eab308, #ef4444)' }}
            />
            <div
              className="absolute top-0 h-full w-1 bg-white rounded-full transition-all duration-700"
              style={{ left: `${Math.min(Math.max(rangePosition, 2), 98)}%`, transform: 'translateX(-50%)' }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-600">
            <span>Low: {low52w.toLocaleString()}</span>
            <span>High: {high52w.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Bollinger %B"
          value={bollingerB != null ? bollingerB.toFixed(2) : '—'}
          sub={bollingerB != null ? bbLabel : undefined}
          color={bbColor}
        />
        <StatCard
          label="Dist. from 52W High"
          value={ta.distanceTo52wHigh != null ? `${(ta.distanceTo52wHigh * 100).toFixed(1)}%` : '—'}
          sub="below peak"
          color={ta.distanceTo52wHigh != null && ta.distanceTo52wHigh < 0.1 ? 'text-red-400' : 'text-white'}
        />
        <StatCard
          label="CCI (Momentum)"
          value={ta.cci != null ? ta.cci.toFixed(0) : '—'}
          sub={ta.cci != null ? (ta.cci > 100 ? 'Overbought' : ta.cci < -100 ? 'Oversold' : 'Neutral') : undefined}
          color={ta.cci != null ? (ta.cci > 100 ? 'text-red-400' : ta.cci < -100 ? 'text-green-400' : 'text-yellow-400') : 'text-white'}
        />
        {fundamentalsBeta != null && atr != null ? (
          <div className="bg-dark-800 rounded-xl p-3 border border-dark-600 flex flex-col justify-between">
            <p className="text-[10px] text-gray-500">Defensive Rating</p>
            <p className={`text-sm font-bold ${defensiveColor}`}>{defensiveLabel}</p>
            <div className="w-full bg-dark-600 rounded-full h-1.5 mt-1">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  defensiveScore >= 80 ? 'bg-green-500' :
                  defensiveScore >= 60 ? 'bg-green-400' :
                  defensiveScore >= 40 ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${defensiveScore}%` }}
              />
            </div>
            <p className="text-[9px] text-gray-600 mt-0.5">{defensiveScore}/100</p>
          </div>
        ) : (
          <StatCard label="Defensive Rating" value="—" sub="Insufficient data" />
        )}
      </div>

      <div className="bg-dark-900/60 rounded-xl p-3 border border-dark-700 text-[10px] text-gray-400 leading-relaxed">
        {fundamentalsBeta == null && atr == null ? (
          <span>Volatility data not available for this stock.</span>
        ) : (
          <>
            {fundamentalsBeta != null && (
              <span>
                <span className="text-gray-300 font-medium">Beta {fundamentalsBeta.toFixed(2)}</span>
                {' '}means when the market moves 10%, this stock historically moves ~{(Math.abs(fundamentalsBeta) * 10).toFixed(1)}%
                {fundamentalsBeta < 0 ? ' in the opposite direction' : ''}.{' '}
              </span>
            )}
            {atr != null && (
              <span>
                The ATR of <span className="text-gray-300 font-medium">{atr.toFixed(1)}%</span>{' '}
                suggests typical daily price swings of {atr.toFixed(1)}%.
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
