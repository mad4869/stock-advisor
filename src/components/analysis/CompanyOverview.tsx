'use client';

import { ComprehensiveAnalysis } from '@/types/analysis';
import { Building2, Globe, Users, MapPin, Briefcase } from 'lucide-react';

interface Props {
  analysis: ComprehensiveAnalysis;
}

function formatLargeNum(value: number | null): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString();
}

export default function CompanyOverview({ analysis }: Props) {
  const { profile, fundamentals, enterpriseValue } = analysis;
  const price = fundamentals.price;
  const high52 = fundamentals.high52Week;
  const low52 = fundamentals.low52Week;

  // 52-week position: 0% = at low, 100% = at high
  const range52pct =
    price != null && high52 != null && low52 != null && high52 > low52
      ? ((price - low52) / (high52 - low52)) * 100
      : null;

  const currencySymbol = fundamentals.market === 'ID' ? 'Rp' : '$';
  const fmtPrice = (v: number | null) =>
    v == null ? '—' : `${currencySymbol}${v.toLocaleString()}`;

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">{profile.name}</h2>
            <span className="text-xs bg-dark-600 text-gray-400 px-2 py-0.5 rounded">
              {profile.symbol}
            </span>
            <span className="text-xs">
              {profile.market === 'ID' ? '🇮🇩' : '🇺🇸'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {profile.sector} • {profile.industry}
            </span>
            {profile.country && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {profile.country}
              </span>
            )}
          </div>
        </div>

        {price != null && (
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{fmtPrice(price)}</p>
            {fundamentals.avgVolume3M != null && (
              <p className="text-xs text-gray-500 mt-0.5">
                Avg Vol: {formatLargeNum(fundamentals.avgVolume3M)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500 font-medium">Market Cap</p>
          <p className="text-sm font-bold text-white">{formatLargeNum(fundamentals.marketCap)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500 font-medium">Enterprise Value</p>
          <p className="text-sm font-bold text-white">{formatLargeNum(enterpriseValue)}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500 font-medium">Beta</p>
          <p className="text-sm font-bold text-white">
            {fundamentals.beta != null ? fundamentals.beta.toFixed(2) : '—'}
          </p>
        </div>
        <div className="bg-dark-800 rounded-xl p-3 border border-dark-600">
          <p className="text-[10px] text-gray-500 font-medium">Employees</p>
          <p className="text-sm font-bold text-white">
            {profile.employeeCount ? profile.employeeCount.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {/* 52-Week Range */}
      {range52pct !== null && (
        <div>
          <p className="text-xs text-gray-500 mb-2">52-Week Range</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-20 text-right">{fmtPrice(low52)}</span>
            <div className="flex-1 relative h-2 bg-dark-600 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                style={{ width: '100%', opacity: 0.3 }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow-lg shadow-blue-500/30 transition-all"
                style={{ left: `calc(${Math.min(Math.max(range52pct, 2), 98)}% - 6px)` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-20">{fmtPrice(high52)}</span>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-1">
            Current price is {range52pct.toFixed(0)}% from 52-week low
          </p>
        </div>
      )}

      {/* Description */}
      {profile.description && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">About</p>
          <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
            {profile.description}
          </p>
        </div>
      )}

      {/* Officers */}
      {profile.officers.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-xs text-gray-500">Key Officers</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {profile.officers.map((officer, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-7 h-7 bg-dark-600 rounded-full flex items-center justify-center text-gray-400 font-bold text-[10px]">
                  {officer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-white font-medium">{officer.name}</p>
                  <p className="text-gray-500 text-[10px]">{officer.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Website */}
      {profile.website && (
        <a
          href={profile.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
      )}
    </div>
  );
}
