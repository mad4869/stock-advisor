'use client';

import { RedFlag } from '@/types/analysis';
import { AlertTriangle, AlertOctagon } from 'lucide-react';

interface Props {
  redFlags: RedFlag[];
}

export default function RedFlagsPanel({ redFlags }: Props) {
  if (redFlags.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">✅</span>
        </div>
        <div>
          <p className="text-sm font-bold text-green-400">No Red Flags Detected</p>
          <p className="text-xs text-green-400/70 mt-0.5">
            No major financial warnings found based on available data.
          </p>
        </div>
      </div>
    );
  }

  const dangers = redFlags.filter((f) => f.severity === 'danger');
  const warnings = redFlags.filter((f) => f.severity === 'warning');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">🚩</span>
        <h3 className="text-sm font-bold text-white">
          Red Flags
          <span className="ml-2 text-xs font-normal text-gray-500">
            {dangers.length > 0 && <span className="text-red-400">{dangers.length} danger</span>}
            {dangers.length > 0 && warnings.length > 0 && <span className="text-gray-600"> · </span>}
            {warnings.length > 0 && <span className="text-yellow-400">{warnings.length} warning</span>}
          </span>
        </h3>
      </div>

      {redFlags.map((flag) => {
        const isDanger = flag.severity === 'danger';
        return (
          <div
            key={flag.id}
            className={`rounded-xl p-4 border flex items-start gap-3 ${
              isDanger
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            }`}
          >
            <div className={`flex-shrink-0 mt-0.5 ${isDanger ? 'text-red-400' : 'text-yellow-400'}`}>
              {isDanger ? (
                <AlertOctagon className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${isDanger ? 'text-red-400' : 'text-yellow-400'}`}>
                {flag.title}
              </p>
              <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                {flag.message}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-gray-500">
                  {flag.metric}: <span className="text-gray-300">{flag.currentValue}</span>
                </span>
                <span className="text-[10px] text-gray-600">
                  Threshold: {flag.threshold}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
