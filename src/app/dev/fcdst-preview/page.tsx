'use client';

import React from 'react';
import { FCDSTScoreCard } from '@/components/fcdst/FCDSTScoreCard';
import { BankingMetricsForm } from '@/components/fcdst/BankingMetricsForm';
import { StoryChecklist } from '@/components/fcdst/StoryChecklist';
import { FCDSTStepper } from '@/components/fcdst/FCDSTStepper';
import { RecordBuyForm } from '@/components/fcdst/RecordBuyForm';
import { RecordSellForm } from '@/components/fcdst/RecordSellForm';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';
import { WatchlistItem } from '@/types';
import { FCDSTScore, TechnicalData } from '@/types/fcdst';
import { FundamentalData } from '@/types/screener';
import { Suspense } from 'react';

const completeScore: FCDSTScore = {
  fScore: 5,
  fDetails: {
    revenueGrowth: true,
    netIncomeGrowth: true,
    roe: true,
    netProfitMargin: true,
    grossProfitMargin: true,
    bonusFcfPass: true,
  },
  cScore: 4,
  cDetails: { per: true, pbv: true, peg: true, evEbitda: true },
  dScore: { status: 'complete', score: 3 },
  dDetails: { der: true, currentRatio: true, interestCoverage: true, npl: null, car: null },
  sScore: 3,
  sDetails: { megatrend: true, moat: true, catalyst: true },
  tScore: {
    priceAboveMA20: true,
    rsiFavorable: true,
    volumeSpike: false,
    mosFavorable: true,
    status: 'BUY ZONE',
  },
  totalScore: 15,
  grade: 'A+',
};

const incompleteBankScore: FCDSTScore = {
  ...completeScore,
  dScore: { status: 'incomplete', score: 0, reason: 'Bank requires manual input' },
  sScore: 'Pending', // Force pending S score for demo
  tScore: undefined,
  totalScore: 'Incomplete',
  grade: 'Incomplete',
};

const pendingStoryScore: FCDSTScore = {
  ...completeScore,
  sScore: 'Pending',
  totalScore: 12,
  grade: 'B (Pending Story)',
  tScore: undefined,
};

const mockFundamentalData: FundamentalData = {
  symbol: 'DEMO.JK',
  name: 'Demo Corp',
  market: { id: 'idx', name: 'IDX', country: 'ID', currency: 'IDR', timezone: 'Asia/Jakarta' },
  currency: 'IDR',
  sector: 'Consumer',
  revenueGrowth: 20,
  earningsGrowth: 20,
  roe: 20,
  netProfitMargin: 15,
  grossMargin: 30,
  freeCashFlow: 1000,
  peRatio: 10,
  pbRatio: 1.5,
  pegRatio: 0.8,
  evToEbitda: 8,
  debtToEquity: 0.5,
  currentRatio: 2.0,
  interestCoverage: 5,
  forwardPE: null,
  psRatio: null,
  roa: null,
  operatingMargin: null,
  epsGrowthCurrentYear: null,
  epsGrowthNext5Y: null,
  dividendYield: null,
  payoutRatio: null,
  marketCap: null,
  avgVolume3M: null,
  high52Week: null,
  low52Week: null,
  beta: null,
  price: 1000,
};

const mockTechnicalData: TechnicalData = {
  price: 1000,
  ma20: 900,
  rsi14: 50,
  volume: 1000000,
  volume20dAvg: 800000,
  fairValue: 1500,
};

const mockWatchlistItem: WatchlistItem = {
  id: 'dev-demo-position',
  symbol: 'DEMO.JK',
  market: 'ID',
  name: 'Demo Corp',
  buyPrice: 1000,
  buyDate: '2026-01-15',
  quantity: 10,
  currentPrice: 1200,
  pnl: 200000,
  pnlPercent: 20,
  action: 'HOLD',
  actionReason: 'Dev preview position.',
  lastUpdated: new Date().toISOString(),
  fcdstScore: {
    totalScore: 14,
    grade: 'A',
    fScore: 5,
    cScore: 4,
    dScore: { status: 'complete', score: 3 },
    sScore: 2,
    snapshotDate: Date.now(),
  },
  thesis: {
    summary: 'Dev preview thesis for Commit 8 sell workflow.',
    megatrendNote: 'Payments and digitization tailwinds.',
    moatNote: 'Scale and brand trust.',
  },
};

export default function FCDSTDemoPage() {
  const saveAnalysis = useStoryAnalysisStore(state => state.saveAnalysis);

  React.useEffect(() => {
    saveAnalysis('DEMO.JK', {
      megatrend: { checked: true, justification: 'Payments and digitization tailwinds remain durable.' },
      moat: { checked: true, justification: 'Scale, distribution, and trust create switching costs.' },
      catalyst: { checked: true, justification: 'Margin recovery and new product rollout can re-rate earnings.' },
    });
  }, [saveAnalysis]);

  if (process.env.NODE_ENV === 'production') {
    return <div className="p-8 text-center text-red-500 font-bold">404 - Not Found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-white mb-8">FCDS-T UI Preview (Dev Only)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-gray-300 mb-4">1. Quantitative Complete, Story Pending</h2>
          <FCDSTScoreCard score={pendingStoryScore} />
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-gray-300 mb-4">2. Incomplete Score (Bank)</h2>
          <FCDSTScoreCard 
            score={incompleteBankScore} 
            onManualInputClick={() => alert('Manual Input Clicked!')} 
          />
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-300 mb-4">3. Fully Analyzed A+</h2>
          <FCDSTScoreCard score={completeScore} />
        </div>
      </div>

      <div id="commit-8-forms" className="mt-16 pt-8 border-t border-dark-600">
        <h2 className="text-2xl font-bold text-white mb-8">Input Components Preview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold text-gray-300 mb-4">Banking Metrics Form</h3>
            <BankingMetricsForm symbol="DEMO.JK" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-300 mb-4">Story Analysis Checklist</h3>
            <StoryChecklist symbol="DEMO.JK" />
          </div>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-dark-600">
        <h2 className="text-2xl font-bold text-white mb-8">Commit 8 Forms Preview</h2>
        <div className="space-y-10">
          <div id="commit-8-buy-form">
            <RecordBuyForm
              symbol="DEMO.JK"
              market="ID"
              currentPrice={1000}
              stockName="Demo Corp"
              fcdstScoreSnapshot={{
                totalScore: completeScore.totalScore,
                grade: completeScore.grade,
                fScore: completeScore.fScore,
                cScore: completeScore.cScore,
                dScore: completeScore.dScore,
                sScore: completeScore.sScore,
                snapshotDate: Date.now(),
              }}
              onCancel={() => undefined}
              onSuccess={() => undefined}
            />
          </div>
          <div id="commit-8-sell-form">
            <RecordSellForm
              item={mockWatchlistItem}
              currentFcdstScore={{ totalScore: 10, grade: 'B' }}
              formatCurrency={(value, market) =>
                market === 'ID' ? `Rp${value.toLocaleString('id-ID')}` : `$${value.toLocaleString('en-US')}`
              }
              onCancel={() => undefined}
              onSubmit={() => undefined}
            />
          </div>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-dark-600">
        <h2 className="text-2xl font-bold text-white mb-8">Full Stepper Flow</h2>
        <Suspense fallback={<div>Loading stepper...</div>}>
          <FCDSTStepper 
            symbol="DEMO.JK" 
            fundamentalData={mockFundamentalData} 
            technicalData={mockTechnicalData} 
            onComplete={(score) => alert('Stepper completed! Total score: ' + score.totalScore)}
          />
        </Suspense>
      </div>
    </div>
  );
}
