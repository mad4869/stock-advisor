'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ApiStatusData {
  provider: string;
  status: 'connected' | 'error' | 'mock';
  message: string;
  details?: {
    us: { provider: string; status: string; message: string };
    idx: { provider: string; status: string; message: string };
  };
}

export default function ApiStatus() {
  const [status, setStatus] = useState<ApiStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        provider: 'unknown',
        status: 'error',
        message: 'Cannot reach server',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading || !status) return null;

  const colors = {
    connected: 'text-green-400 bg-green-500/10 border-green-500/20',
    mock: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const icons = {
    connected: Wifi,
    mock: Database,
    error: WifiOff,
  };

  const Icon = icons[status.status];
  const statusLabel =
    status.status === 'mock'
      ? 'Demo Mode'
      : status.status === 'connected'
        ? 'Live Data'
        : 'Error';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${colors[status.status]}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{statusLabel}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl p-4 z-50 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">API Status</h3>
            <button
              onClick={checkStatus}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {status.details && (
            <div className="space-y-2">
              {/* US Status */}
              <div className="flex items-center justify-between bg-dark-800 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🇺🇸</span>
                  <span className="text-xs text-gray-400">US Market</span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-medium ${
                      status.details.us.status === 'connected'
                        ? 'text-green-400'
                        : status.details.us.status === 'mock'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {status.details.us.provider}
                  </span>
                  <p className="text-[10px] text-gray-500">{status.details.us.message}</p>
                </div>
              </div>

              {/* IDX Status */}
              <div className="flex items-center justify-between bg-dark-800 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🇮🇩</span>
                  <span className="text-xs text-gray-400">IDX Market</span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-medium ${
                      status.details.idx.status === 'connected'
                        ? 'text-green-400'
                        : status.details.idx.status === 'mock'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {status.details.idx.provider}
                  </span>
                  <p className="text-[10px] text-gray-500">{status.details.idx.message}</p>
                </div>
              </div>
            </div>
          )}

          {status.status === 'mock' && (
            <p className="mt-3 text-[10px] text-gray-500 leading-relaxed">
              Using simulated data. Edit <code className="text-gray-400">.env.local</code> and set{' '}
              <code className="text-gray-400">US_STOCK_PROVIDER=twelvedata</code> and{' '}
              <code className="text-gray-400">IDX_STOCK_PROVIDER=idxscraper</code> for real data.
            </p>
          )}
        </div>
      )}
    </div>
  );
}