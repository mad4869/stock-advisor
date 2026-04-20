'use client';

import { useState, useCallback } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  Server,
  Globe,
  Zap,
  AlertTriangle,
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  data?: any;
  error?: string;
}

interface TestResponse {
  summary: {
    total: number;
    passed: number;
    failed: number;
    totalDuration: string;
    allPassed: boolean;
  };
  results: TestResult[];
  timestamp: string;
  environment: {
    usProvider: string;
    idxProvider: string;
    hasTwelveDataKey: boolean;
    runtime: string;
  };
}

interface ManualTestResult {
  success: boolean;
  duration: number;
  symbol: string;
  market: string;
  yahooSymbol: string;
  quote: any;
  quoteError: string | null;
  historical: any;
  histError: string | null;
  note: string;
  error?: string;
}

type TestType =
  | 'all'
  | 'connectivity'
  | 'us-quote'
  | 'idx-quote'
  | 'idx-itmg'
  | 'us-history'
  | 'idx-history'
  | 'search-us'
  | 'search-idx'
  | 'idx-batch'
  | 'rate-limit';

const TEST_GROUPS: { label: string; type: TestType; description: string; icon: any }[] = [
  { label: 'Run All Tests', type: 'all', description: 'Runs all 11 tests — takes ~15 seconds', icon: Zap },
  { label: 'Connectivity', type: 'connectivity', description: 'Check if Yahoo Finance API is reachable', icon: Globe },
  { label: 'US Stock Quote', type: 'us-quote', description: 'Fetch AAPL current price', icon: Server },
  { label: 'IDX Stock Quote', type: 'idx-quote', description: 'Fetch BBCA.JK current price', icon: Server },
  { label: 'IDX ITMG Test', type: 'idx-itmg', description: 'Test the previously problematic ITMG stock', icon: Server },
  { label: 'US Historical', type: 'us-history', description: 'Fetch 6 months of AAPL daily data', icon: Clock },
  { label: 'IDX Historical', type: 'idx-history', description: 'Fetch 6 months of BBCA daily data', icon: Clock },
  { label: 'Search (US)', type: 'search-us', description: 'Search for "Apple" stocks', icon: Globe },
  { label: 'Search (IDX)', type: 'search-idx', description: 'Search for Indonesian bank stocks', icon: Globe },
  { label: 'IDX Batch (10 stocks)', type: 'idx-batch', description: 'Test 10 common IDX stocks', icon: Zap },
  { label: 'Rate Limit Test', type: 'rate-limit', description: '5 rapid sequential requests', icon: Zap },
];

export default function TestPage() {
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTest, setActiveTest] = useState<TestType | null>(null);

  const [manualSymbol, setManualSymbol] = useState('');
  const [manualMarket, setManualMarket] = useState<'US' | 'ID'>('US');
  const [manualResult, setManualResult] = useState<ManualTestResult | null>(null);
  const [manualLoading, setManualLoading] = useState(false);

  const runTests = useCallback(async (type: TestType) => {
    setLoading(true);
    setActiveTest(type);
    setResponse(null);

    try {
      const res = await fetch(`/api/test?type=${type}`);
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setResponse({
        summary: { total: 1, passed: 0, failed: 1, totalDuration: '0ms', allPassed: false },
        results: [{ name: 'API Call', status: 'fail', duration: 0, error: err.message }],
        timestamp: new Date().toISOString(),
        environment: { usProvider: 'unknown', idxProvider: 'unknown', hasTwelveDataKey: false, runtime: 'unknown' },
      });
    } finally {
      setLoading(false);
      setActiveTest(null);
    }
  }, []);

  // Fixed: calls YOUR API route (server-side), not Yahoo directly
  const runManualTest = async () => {
    if (!manualSymbol.trim()) return;
    setManualLoading(true);
    setManualResult(null);

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: manualSymbol.trim(),
          market: manualMarket,
        }),
      });

      const data = await res.json();
      setManualResult(data);
    } catch (err: any) {
      setManualResult({
        success: false,
        duration: 0,
        symbol: manualSymbol,
        market: manualMarket,
        yahooSymbol: '',
        quote: null,
        quoteError: null,
        historical: null,
        histError: null,
        note: '',
        error: err.message || 'Failed to connect to test API',
      });
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">🧪 API Test Suite</h1>
        <p className="text-sm text-gray-400">
          Test Yahoo Finance API connectivity for both US and Indonesian stocks.
          All tests run <strong className="text-white">server-side</strong> through
          your API routes — exactly how the app fetches data.
        </p>
      </div>

      {/* CORS Explanation Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200/80">
          <p className="font-medium text-blue-300 mb-1">Why browser-direct calls fail</p>
          <p>
            Yahoo Finance blocks direct browser requests (CORS). All tests here go through
            your Next.js API routes (server-side), which is exactly how the app works in
            production. If these tests pass, the app will work.
          </p>
        </div>
      </div>

      {/* Manual Test */}
      <div className="card">
        <h2 className="text-lg font-bold text-white mb-4">🔍 Test Any Stock</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-dark-800 rounded-xl border border-dark-500 p-1">
            <button
              onClick={() => setManualMarket('US')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                manualMarket === 'US'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🇺🇸 US
            </button>
            <button
              onClick={() => setManualMarket('ID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                manualMarket === 'ID'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🇮🇩 IDX
            </button>
          </div>

          <input
            type="text"
            value={manualSymbol}
            onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && runManualTest()}
            placeholder={manualMarket === 'ID' ? 'e.g. BBCA, ITMG, GOTO' : 'e.g. AAPL, TSLA'}
            className="input-field flex-1"
          />

          <button
            onClick={runManualTest}
            disabled={manualLoading || !manualSymbol.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {manualLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Test
          </button>
        </div>

        {/* Quick test buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-gray-500 py-1">Quick test:</span>
          {['AAPL', 'MSFT', 'NVDA', 'BBCA', 'BBRI', 'ITMG', 'GOTO', 'ADRO'].map((sym) => {
            const isIDX = ['BBCA', 'BBRI', 'ITMG', 'GOTO', 'ADRO'].includes(sym);
            return (
              <button
                key={sym}
                onClick={() => {
                  setManualSymbol(sym);
                  setManualMarket(isIDX ? 'ID' : 'US');
                  // Auto-run after state update
                  setTimeout(async () => {
                    setManualLoading(true);
                    setManualResult(null);
                    try {
                      const res = await fetch('/api/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbol: sym, market: isIDX ? 'ID' : 'US' }),
                      });
                      setManualResult(await res.json());
                    } catch (err: any) {
                      setManualResult({
                        success: false, duration: 0, symbol: sym,
                        market: isIDX ? 'ID' : 'US', yahooSymbol: '', quote: null,
                        quoteError: err.message, historical: null, histError: null, note: '',
                      });
                    } finally {
                      setManualLoading(false);
                    }
                  }, 50);
                }}
                disabled={manualLoading}
                className="text-xs bg-dark-600 hover:bg-dark-500 text-gray-300 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                {isIDX ? '🇮🇩' : '🇺🇸'} {sym}
              </button>
            );
          })}
        </div>

        {/* Manual Result */}
        {manualResult && (
          <div className="mt-4 animate-fade-in">
            <div
              className={`rounded-xl p-4 border ${
                manualResult.success
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}
            >
              {/* Status Header */}
              <div className="flex items-center gap-2 mb-3">
                {manualResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span
                  className={`font-bold ${
                    manualResult.success ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {manualResult.success ? 'SUCCESS' : 'FAILED'}
                </span>
                <span className="text-xs text-gray-500 ml-auto">
                  {manualResult.duration}ms • {manualResult.yahooSymbol}
                </span>
              </div>

              {/* Note */}
              <p className="text-sm text-gray-300 mb-3">{manualResult.note}</p>

              {/* Quote Data */}
              {manualResult.quote && (
                <div className="bg-dark-800 rounded-lg p-3 mb-3">
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                    Quote Data
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Name: </span>
                      <span className="text-white">{manualResult.quote.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Price: </span>
                      <span className="text-white font-bold">
                        {manualResult.quote.currency === 'IDR' ? 'Rp' : '$'}
                        {manualResult.quote.price?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Change: </span>
                      <span
                        className={
                          manualResult.quote.change >= 0 ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        {manualResult.quote.change >= 0 ? '+' : ''}
                        {manualResult.quote.change?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Currency: </span>
                      <span className="text-white">{manualResult.quote.currency}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Exchange: </span>
                      <span className="text-white">{manualResult.quote.exchange}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Market: </span>
                      <span className="text-white">{manualResult.quote.marketState}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">52W High: </span>
                      <span className="text-white">
                        {manualResult.quote.fiftyTwoWeekHigh?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">52W Low: </span>
                      <span className="text-white">
                        {manualResult.quote.fiftyTwoWeekLow?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quote Error */}
              {manualResult.quoteError && (
                <div className="bg-red-500/10 rounded-lg p-3 mb-3 text-sm text-red-300">
                  <strong>Quote Error:</strong> {manualResult.quoteError}
                </div>
              )}

              {/* Historical Data */}
              {manualResult.historical && (
                <div className="bg-dark-800 rounded-lg p-3 mb-3">
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                    Historical Data (6 months)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Data Points: </span>
                      <span className="text-white">
                        {manualResult.historical.validDataPoints} valid /{' '}
                        {manualResult.historical.totalDataPoints} total
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Range: </span>
                      <span className="text-white">
                        {manualResult.historical.firstDate} → {manualResult.historical.lastDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Sufficient for analysis: </span>
                      <span
                        className={
                          manualResult.historical.sufficient ? 'text-green-400' : 'text-red-400'
                        }
                      >
                        {manualResult.historical.sufficient ? '✅ Yes (50+ days)' : '❌ No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Error */}
              {manualResult.histError && (
                <div className="bg-red-500/10 rounded-lg p-3 mb-3 text-sm text-red-300">
                  <strong>Historical Error:</strong> {manualResult.histError}
                </div>
              )}

              {/* General Error */}
              {manualResult.error && (
                <div className="bg-red-500/10 rounded-lg p-3 text-sm text-red-300">
                  <strong>Error:</strong> {manualResult.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Test Buttons */}
      <div className="card">
        <h2 className="text-lg font-bold text-white mb-4">🧪 Automated Tests</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEST_GROUPS.map((test) => {
            const Icon = test.icon;
            const isRunning = loading && activeTest === test.type;

            return (
              <button
                key={test.type}
                onClick={() => runTests(test.type)}
                disabled={loading}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${
                  test.type === 'all'
                    ? 'bg-blue-600/10 border-blue-500/30 hover:bg-blue-600/20 sm:col-span-2'
                    : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                } disabled:opacity-50`}
              >
                <div className="mt-0.5">
                  {isRunning ? (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white text-sm">{test.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{test.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {loading && !response && (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mr-3" />
          <span className="text-gray-400">Running tests...</span>
        </div>
      )}

      {response && (
        <div className="space-y-4 animate-slide-up">
          {/* Summary */}
          <div
            className={`card border ${
              response.summary.allPassed
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {response.summary.allPassed ? (
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400" />
                )}
                <div>
                  <h3
                    className={`text-lg font-bold ${
                      response.summary.allPassed ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {response.summary.allPassed ? 'All Tests Passed!' : 'Some Tests Failed'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {response.summary.passed}/{response.summary.total} passed •{' '}
                    {response.summary.totalDuration}
                  </p>
                </div>
              </div>

              <button
                onClick={() => runTests('all')}
                disabled={loading}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Rerun
              </button>
            </div>

            {/* Environment */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-dark-800 rounded-lg p-2">
                <span className="text-gray-500">US: </span>
                <span className="text-white">{response.environment.usProvider}</span>
              </div>
              <div className="bg-dark-800 rounded-lg p-2">
                <span className="text-gray-500">IDX: </span>
                <span className="text-white">{response.environment.idxProvider}</span>
              </div>
              <div className="bg-dark-800 rounded-lg p-2">
                <span className="text-gray-500">12Data: </span>
                <span className="text-white">
                  {response.environment.hasTwelveDataKey ? '✅' : '❌'}
                </span>
              </div>
              <div className="bg-dark-800 rounded-lg p-2">
                <span className="text-gray-500">Runtime: </span>
                <span className="text-white">{response.environment.runtime}</span>
              </div>
            </div>
          </div>

          {/* Individual Results */}
          {response.results.map((result, idx) => (
            <TestResultCard key={idx} result={result} />
          ))}

          {/* Next Steps */}
          {response.summary.allPassed && (
            <div className="card border border-green-500/20 bg-green-500/5">
              <h3 className="font-bold text-green-400 mb-2">✅ Ready to go!</h3>
              <p className="text-sm text-gray-300 mb-3">
                Yahoo Finance API works from this environment. Set your config:
              </p>
              <pre className="bg-dark-900 rounded-xl p-4 text-sm text-green-300 overflow-x-auto">
{`# .env.local
US_STOCK_PROVIDER=yahoo
IDX_STOCK_PROVIDER=yahoo`}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestResultCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  const isPassed = result.status === 'pass';

  return (
    <div className={`rounded-xl border overflow-hidden ${isPassed ? 'border-dark-600' : 'border-red-500/30'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
          isPassed ? 'bg-dark-700 hover:bg-dark-600' : 'bg-red-500/5 hover:bg-red-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          {isPassed ? (
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-white">{result.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{result.duration}ms</span>
          <span className={`text-xs font-bold ${isPassed ? 'text-green-400' : 'text-red-400'}`}>
            {isPassed ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 bg-dark-800 border-t border-dark-600 animate-fade-in">
          {result.error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-300 font-mono">{result.error}</p>
            </div>
          )}
          {result.data && (
            <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono bg-dark-900 rounded-lg p-3">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}