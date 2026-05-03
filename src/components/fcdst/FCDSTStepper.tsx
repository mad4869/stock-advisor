import React, { useMemo, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FundamentalData } from '@/types/screener';
import { FCDSTScore, TechnicalData, DEFAULT_FCDST_THRESHOLDS } from '@/types/fcdst';
import { calculateFCDSTScore, computeTotalFCDSTScore, calculateTScore } from '@/lib/fcdstEngine';
import { isBankingSector } from '@/lib/sectorUtils';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { useStoryAnalysisStore, computeStoryScore } from '@/lib/storyAnalysisStore';
import { useFCDSTAnalysis } from '@/hooks/useFCDSTAnalysis';

import { BankingMetricsForm } from './BankingMetricsForm';
import { StoryChecklist } from './StoryChecklist';
import { TimingSignals } from './TimingSignals';
import { RecordBuyForm } from './RecordBuyForm';
import { CheckCircle, XCircle, Lock, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';

interface FCDSTStepperProps {
  symbol: string;
  fundamentalData: FundamentalData;
  technicalData?: TechnicalData;
  onComplete?: (score: FCDSTScore) => void;
  mode?: 'single' | 'batch';
}

const STEPS = ['F', 'C', 'D', 'S', 'T'] as const;
type StepKey = typeof STEPS[number];

const STEP_TITLES: Record<StepKey, string> = {
  F: 'Fundamental Quality',
  C: 'Cheap (Valuation)',
  D: 'Debt (Health)',
  S: 'Story (Moat)',
  T: 'Timing (Action)',
};

export function FCDSTStepper({ symbol, fundamentalData, technicalData, onComplete, mode = 'single' }: FCDSTStepperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentStepParam = searchParams.get('step') as StepKey | null;
  const currentStepIndex = currentStepParam && STEPS.includes(currentStepParam) ? STEPS.indexOf(currentStepParam) : 0;
  const currentStep = STEPS[currentStepIndex];

  const [showBuyForm, setShowBuyForm] = useState(false);

  // Mount guard to prevent hydration errors
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const analysis = useFCDSTAnalysis({ symbol, fundamentalData, technicalData });

  // Derived UI states
  const dScoreComplete = analysis.dScore.status === 'complete';
  const sScoreComplete = typeof analysis.sScore === 'number' && analysis.sScore >= 1;

  // Navigation handlers
  const goToStep = (index: number) => {
    if (index >= 0 && index < STEPS.length) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('step', STEPS[index]);
      router.push(`${pathname}?${newParams.toString()}`);
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 'D' && analysis.isBanking && !dScoreComplete) return true;
    if (currentStep === 'S' && !sScoreComplete) return true;
    return false;
  };

  const handleNext = () => {
    if (currentStepIndex === STEPS.length - 1) {
      if (onComplete) {
        onComplete({
          fScore: analysis.fScore,
          fDetails: analysis.fDetails,
          cScore: analysis.cScore,
          cDetails: analysis.cDetails,
          dScore: analysis.dScore,
          dDetails: analysis.dDetails,
          sScore: analysis.sScore,
          sDetails: analysis.sDetails,
          tScore: analysis.tScore,
          totalScore: analysis.totalScore,
          grade: analysis.grade,
        });
      }
    } else {
      goToStep(currentStepIndex + 1);
    }
  };

  // Helper renderer for criteria lists
  const renderCriteria = (label: string, value: string, passed: boolean | null, target: string) => (
    <div key={label} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">({target})</span>
        <span className="font-mono text-sm">{value}</span>
        {passed === null ? (
          <span className="text-gray-500 font-bold text-sm w-5 text-center">N/A</span>
        ) : passed ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500" />
        )}
      </div>
    </div>
  );

  if (!mounted) {
    return <div className="p-8 text-center text-gray-400">Loading FCDS-T Stepper...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Progress Indicator */}
      <div className="bg-dark-800 p-4 rounded-xl border border-dark-600 flex justify-between items-center overflow-x-auto">
        {STEPS.map((step, idx) => {
          const isCurrent = idx === currentStepIndex;
          const isPast = idx < currentStepIndex;
          
          let locked = false;
          if (step === 'S' && analysis.isBanking && !dScoreComplete && idx > currentStepIndex) locked = true;
          if (step === 'T' && !sScoreComplete && idx > currentStepIndex) locked = true;

          return (
            <React.Fragment key={step}>
              <button 
                onClick={() => goToStep(idx)}
                className={`flex flex-col items-center flex-shrink-0 mx-2 transition-colors ${
                  isCurrent ? 'text-blue-400' : isPast ? 'text-green-500' : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1 border-2 relative ${
                  isCurrent ? 'border-blue-400 bg-blue-500/10' : 
                  isPast ? 'border-green-500 bg-green-500/10' : 
                  'border-gray-600 bg-dark-700'
                }`}>
                  <span className={locked ? 'text-gray-500' : ''}>{step}</span>
                  {locked && (
                    <div className="absolute -top-1 -right-1 bg-dark-800 rounded-full p-0.5">
                      <Lock className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold">{STEP_TITLES[step].split(' ')[0]}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded-full ${isPast ? 'bg-green-500/50' : 'bg-dark-600'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="bg-dark-800 p-6 rounded-xl border border-dark-600 min-h-[400px]">
        
        {/* Step F */}
        {currentStep === 'F' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Fundamental Quality</h2>
              <span className="text-xl font-bold text-blue-400">{analysis.fScore}/5</span>
            </div>
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
              {renderCriteria('Revenue Growth (YoY)', fundamentalData.revenueGrowth != null ? `${fundamentalData.revenueGrowth.toFixed(1)}%` : 'N/A', analysis.fDetails.revenueGrowth, 'min 15%')}
              {renderCriteria('Net Income Growth (YoY)', fundamentalData.earningsGrowth != null ? `${fundamentalData.earningsGrowth.toFixed(1)}%` : 'N/A', analysis.fDetails.netIncomeGrowth, 'min 15%')}
              {renderCriteria('Return on Equity (ROE)', fundamentalData.roe != null ? `${fundamentalData.roe.toFixed(1)}%` : 'N/A', analysis.fDetails.roe, 'min 15%')}
              {renderCriteria('Net Profit Margin', fundamentalData.netProfitMargin != null ? `${fundamentalData.netProfitMargin.toFixed(1)}%` : 'N/A', analysis.fDetails.netProfitMargin, 'min 10%')}
              {renderCriteria('Gross Profit Margin', fundamentalData.grossMargin != null ? `${fundamentalData.grossMargin.toFixed(1)}%` : 'N/A', analysis.fDetails.grossProfitMargin, 'min 20%')}
            </div>
          </div>
        )}

        {/* Step C */}
        {currentStep === 'C' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Cheap (Valuation)</h2>
              <span className="text-xl font-bold text-blue-400">{analysis.cScore}/4</span>
            </div>
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
              {renderCriteria('P/E Ratio', fundamentalData.peRatio != null ? fundamentalData.peRatio.toFixed(1) : 'N/A', analysis.cDetails.per, 'max 15x')}
              {renderCriteria('P/B Ratio', fundamentalData.pbRatio != null ? fundamentalData.pbRatio.toFixed(1) : 'N/A', analysis.cDetails.pbv, 'max 2x')}
              {renderCriteria('PEG Ratio', fundamentalData.pegRatio != null ? fundamentalData.pegRatio.toFixed(2) : 'N/A', analysis.cDetails.peg, 'max 1x')}
              {renderCriteria('EV/EBITDA', fundamentalData.evToEbitda != null ? fundamentalData.evToEbitda.toFixed(1) : 'N/A', analysis.cDetails.evEbitda, 'max 10x')}
            </div>
          </div>
        )}

        {/* Step D */}
        {currentStep === 'D' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Debt (Health)</h2>
              <span className={`text-xl font-bold ${dScoreComplete ? 'text-blue-400' : 'text-gray-500'}`}>
                {dScoreComplete ? `${analysis.dScore.score}/3` : 'Inc.'}
              </span>
            </div>
            
            {analysis.isBanking ? (
              <div className="space-y-6">
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 p-4 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p><strong>Banking sector detected.</strong> Standard debt metrics do not apply. Manual NPL and CAR inputs are required.</p>
                </div>
                <BankingMetricsForm symbol={symbol} onSave={analysis.handleChildSave} />
              </div>
            ) : (
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                {renderCriteria('Debt to Equity', fundamentalData.debtToEquity != null ? fundamentalData.debtToEquity.toFixed(2) : 'N/A', analysis.dDetails.der, 'max 1.0')}
                {renderCriteria('Current Ratio', fundamentalData.currentRatio != null ? fundamentalData.currentRatio.toFixed(2) : 'N/A', analysis.dDetails.currentRatio, 'min 1.5')}
                {renderCriteria('Interest Coverage', fundamentalData.interestCoverage != null ? fundamentalData.interestCoverage.toFixed(1) : 'N/A', analysis.dDetails.interestCoverage, 'min 3.0')}
              </div>
            )}
          </div>
        )}

        {/* Step S */}
        {currentStep === 'S' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Story (Moat)</h2>
              <p className="text-gray-400">Complete your qualitative analysis to proceed to Timing signals. Minimum 1 point required.</p>
            </div>
            <StoryChecklist symbol={symbol} onSave={analysis.handleChildSave} />
          </div>
        )}

        {/* Step T */}
        {currentStep === 'T' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Timing (Action)</h2>
              <p className="text-gray-400">Evaluate technical signals to determine entry timing.</p>
            </div>
            
            {!sScoreComplete ? (
              <div className="bg-dark-900 border border-dark-600 text-gray-300 p-8 rounded-lg flex flex-col items-center justify-center text-center">
                <Lock className="w-12 h-12 text-gray-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Step Locked</h3>
                <p>Please complete the <button onClick={() => goToStep(3)} className="text-blue-400 hover:underline">Story (Moat)</button> analysis with at least 1 point to unlock Timing signals.</p>
              </div>
            ) : (
              <>
                <TimingSignals technicalData={technicalData} tScore={analysis.tScore} />
                
                {showBuyForm ? (
                  <div className="mt-8 animate-slide-up">
                    <RecordBuyForm
                      symbol={symbol}
                      market={fundamentalData.exchange === 'JKT' || symbol.endsWith('.JK') ? 'ID' : 'US'}
                      currentPrice={fundamentalData.currentPrice ?? fundamentalData.price ?? 0}
                      stockName={fundamentalData.companyName || symbol}
                      fcdstScoreSnapshot={{
                        totalScore: analysis.totalScore,
                        grade: analysis.grade,
                        fScore: analysis.fScore,
                        cScore: analysis.cScore,
                        dScore: analysis.dScore,
                        sScore: analysis.sScore,
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
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-dark-700 flex justify-between">
          <button
            onClick={() => goToStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          
          <button
            onClick={handleNext}
            disabled={isNextDisabled()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-dark-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
          >
            {currentStepIndex === STEPS.length - 1 ? 'Finish' : `Next: ${STEP_TITLES[STEPS[currentStepIndex + 1]].split(' ')[0]}`}
            {currentStepIndex !== STEPS.length - 1 && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Running Score Summary */}
      <div className="bg-dark-900 border border-dark-600 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 sticky bottom-4 shadow-2xl">
        <div className="flex items-center gap-4 text-sm font-medium flex-wrap">
          <span className="text-gray-400">Running Score:</span>
          <span className="text-gray-200">F: <span className="text-white">{analysis.fScore}/5</span></span>
          <span className="text-dark-600">|</span>
          <span className="text-gray-200">C: <span className="text-white">{analysis.cScore}/4</span></span>
          <span className="text-dark-600">|</span>
          <span className="text-gray-200">D: <span className="text-white">{dScoreComplete ? `${analysis.dScore.score}/3` : 'Inc.'}</span></span>
          <span className="text-dark-600">|</span>
          <span className="text-gray-200">S: <span className="text-white">{analysis.sScore === 'Pending' ? 'Pend.' : `${analysis.sScore}/3`}</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">Total:</span>
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
      </div>
    </div>
  );
}
