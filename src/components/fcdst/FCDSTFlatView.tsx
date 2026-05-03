'use client';

import React, { useState, useEffect } from 'react';
import { FundamentalData } from '@/types/screener';
import { TechnicalData } from '@/types/fcdst';
import { useFCDSTAnalysis } from '@/hooks/useFCDSTAnalysis';
import { CheckCircle2, XCircle, AlertTriangle, Lock } from 'lucide-react';
import { BankingMetricsForm } from './BankingMetricsForm';
import { StoryChecklist } from './StoryChecklist';
import { TimingSignals } from './TimingSignals';
import { RecordBuyForm } from './RecordBuyForm';
import { useRouter } from 'next/navigation';

interface FCDSTFlatViewProps {
  symbol: string;
  fundamentalData: FundamentalData;
  technicalData?: TechnicalData;
}

export function FCDSTFlatView({ symbol, fundamentalData, technicalData }: FCDSTFlatViewProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showBuyForm, setShowBuyForm] = useState(false);

  useEffect(() => setMounted(true), []);

  const analysis = useFCDSTAnalysis({ symbol, fundamentalData, technicalData });

  if (!mounted) {
    return <div className="p-8 text-center text-gray-400">Loading FCDS-T Analysis...</div>;
  }

  const dScoreComplete = analysis.dScore.status === 'complete';
  const sScoreComplete = typeof analysis.sScore === 'number' && analysis.sScore >= 1;

  // Helper for F and C criteria
  const renderFlatCriteriaRow = (criteriaArr: Array<{ label: string, value: string, passed: boolean | null, target: string }>) => {
    return (
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-3">
        {criteriaArr.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {c.passed === true ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
             c.passed === false ? <XCircle className="w-4 h-4 text-red-400" /> :
             <span className="w-4 h-4 text-gray-500 flex items-center justify-center">-</span>}
            <span className="text-gray-300">{c.label}</span>
            <span className="text-gray-500 text-xs">({c.value})</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Sticky Header */}
      <div className="bg-dark-900 border border-dark-600 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 sticky top-4 z-20 shadow-2xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          FCDS-T Analysis: <span className="text-blue-400">{symbol}</span>
        </h2>
        <div className="flex items-center gap-4 text-sm font-medium flex-wrap">
          <div className="flex items-center gap-2 text-gray-200">
            <span>Score:</span>
            <span className="text-lg font-bold text-white">
              {analysis.totalScore === 'Incomplete' ? 'Inc.' : `${analysis.totalScore}/15`}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              analysis.grade.startsWith('A') ? 'bg-green-500/20 text-green-400' :
              analysis.grade.startsWith('B') ? 'bg-blue-500/20 text-blue-400' :
              analysis.grade.startsWith('C') ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {analysis.grade.split(' ')[0]}
            </span>
          </div>
          {fundamentalData.freeCashFlow && fundamentalData.freeCashFlow > 0 && (
            <div className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-1 rounded text-xs font-bold">
              <span>⭐ FCF Bonus</span>
            </div>
          )}
          {analysis.sScore === 'Pending' && (
            <div className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>S Pending</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* F Section */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex justify-between items-center border-b border-dark-700 pb-3">
            <h3 className="text-lg font-bold text-white">[F] Fundamental (Quality)</h3>
            <span className="text-lg font-bold text-blue-400">{analysis.fScore}/5</span>
          </div>
          {renderFlatCriteriaRow([
            { label: 'Rev Growth', value: fundamentalData.revenueGrowth != null ? `${fundamentalData.revenueGrowth.toFixed(1)}%` : 'N/A', passed: analysis.fDetails.revenueGrowth, target: 'min 15%' },
            { label: 'NI Growth', value: fundamentalData.earningsGrowth != null ? `${fundamentalData.earningsGrowth.toFixed(1)}%` : 'N/A', passed: analysis.fDetails.netIncomeGrowth, target: 'min 15%' },
            { label: 'ROE', value: fundamentalData.roe != null ? `${fundamentalData.roe.toFixed(1)}%` : 'N/A', passed: analysis.fDetails.roe, target: 'min 15%' },
            { label: 'NPM', value: fundamentalData.netProfitMargin != null ? `${fundamentalData.netProfitMargin.toFixed(1)}%` : 'N/A', passed: analysis.fDetails.netProfitMargin, target: 'min 10%' },
            { label: 'GPM', value: fundamentalData.grossMargin != null ? `${fundamentalData.grossMargin.toFixed(1)}%` : 'N/A', passed: analysis.fDetails.grossProfitMargin, target: 'min 20%' },
          ])}
        </div>

        {/* C Section */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex justify-between items-center border-b border-dark-700 pb-3">
            <h3 className="text-lg font-bold text-white">[C] Cheap (Valuation)</h3>
            <span className="text-lg font-bold text-blue-400">{analysis.cScore}/4</span>
          </div>
          {renderFlatCriteriaRow([
            { label: 'PER', value: fundamentalData.peRatio != null ? fundamentalData.peRatio.toFixed(1) : 'N/A', passed: analysis.cDetails.per, target: 'max 15x' },
            { label: 'PBV', value: fundamentalData.pbRatio != null ? fundamentalData.pbRatio.toFixed(1) : 'N/A', passed: analysis.cDetails.pbv, target: 'max 2x' },
            { label: 'PEG', value: fundamentalData.pegRatio != null ? fundamentalData.pegRatio.toFixed(2) : 'N/A', passed: analysis.cDetails.peg, target: 'max 1x' },
            { label: 'EV/EBITDA', value: fundamentalData.evToEbitda != null ? fundamentalData.evToEbitda.toFixed(1) : 'N/A', passed: analysis.cDetails.evEbitda, target: 'max 10x' },
          ])}
        </div>

        {/* D Section */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex justify-between items-center border-b border-dark-700 pb-3 mb-3">
            <h3 className="text-lg font-bold text-white">[D] Debt (Health)</h3>
            <span className={`text-lg font-bold ${dScoreComplete ? 'text-blue-400' : 'text-gray-500'}`}>
              {dScoreComplete ? `${analysis.dScore.score}/3` : 'Inc.'}
            </span>
          </div>
          {analysis.isBanking ? (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 p-3 rounded-lg flex items-start gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Banking sector detected. Manual input required for NPL and CAR.</p>
              </div>
              <BankingMetricsForm symbol={symbol} onSave={analysis.handleChildSave} />
            </div>
          ) : (
            renderFlatCriteriaRow([
              { label: 'DER', value: fundamentalData.debtToEquity != null ? fundamentalData.debtToEquity.toFixed(2) : 'N/A', passed: analysis.dDetails.der, target: 'max 1.0' },
              { label: 'Current Ratio', value: fundamentalData.currentRatio != null ? fundamentalData.currentRatio.toFixed(2) : 'N/A', passed: analysis.dDetails.currentRatio, target: 'min 1.5' },
              { label: 'Interest Cov', value: fundamentalData.interestCoverage != null ? fundamentalData.interestCoverage.toFixed(1) : 'N/A', passed: analysis.dDetails.interestCoverage, target: 'min 3.0' },
            ])
          )}
        </div>

        {/* S Section */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex justify-between items-center border-b border-dark-700 pb-3 mb-4">
            <h3 className="text-lg font-bold text-white">[S] Story (Moat)</h3>
            <span className={`text-lg font-bold ${analysis.sScore !== 'Pending' ? 'text-blue-400' : 'text-gray-500'}`}>
              {analysis.sScore !== 'Pending' ? `${analysis.sScore}/3` : 'Inc.'}
            </span>
          </div>
          <StoryChecklist symbol={symbol} onSave={analysis.handleChildSave} />
        </div>

        {/* T Section */}
        <div className={`bg-dark-800 border border-dark-600 rounded-xl p-5 ${!sScoreComplete ? 'opacity-70' : ''}`}>
          <div className="flex justify-between items-center border-b border-dark-700 pb-3 mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              [T] Timing (Action)
              {!sScoreComplete && <Lock className="w-4 h-4 text-gray-500" />}
            </h3>
          </div>
          {!sScoreComplete ? (
            <div className="relative border border-dashed border-dark-500 bg-dark-900/50 p-6 rounded-lg text-center overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMWYyOTM3IiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzM3NDE1MSIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPg==')] opacity-20"></div>
              <div className="relative z-10 flex flex-col items-center justify-center space-y-2">
                <Lock className="w-8 h-8 text-gray-500" />
                <p className="text-gray-400 font-medium">Complete Story analysis above to unlock Timing signals</p>
              </div>
            </div>
          ) : (
            <>
              <TimingSignals technicalData={technicalData} tScore={analysis.tScore} />
              
              {showBuyForm ? (
                <div className="mt-8 animate-slide-up">
                    <RecordBuyForm
                      symbol={symbol}
                      market={fundamentalData.market}
                      currentPrice={fundamentalData.price ?? 0}
                      stockName={fundamentalData.name || symbol}
                    fcdstScoreSnapshot={{
                      totalScore: analysis.totalScore,
                      grade: analysis.grade,
                      fScore: analysis.fScore,
                      cScore: analysis.cScore,
                      dScore: analysis.dScore,
                      sScore: typeof analysis.sScore === 'number' ? analysis.sScore : null,
                      snapshotDate: Date.now(),
                    }}
                    onCancel={() => setShowBuyForm(false)}
                    onSuccess={() => {
                      setShowBuyForm(false);
                      alert('Transaction recorded! Check your Watchlist.');
                      router.push('/watchlist');
                    }}
                  />
                </div>
              ) : (
                <div className="mt-8 flex gap-4">
                  <button className="flex-1 bg-dark-700 hover:bg-dark-600 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-dark-500">
                    Add to Watchlist
                  </button>
                  <button 
                    onClick={() => setShowBuyForm(true)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Record Buy Transaction
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
