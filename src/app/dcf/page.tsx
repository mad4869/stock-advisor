'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Market } from '@/types';
import { AnalysisResponse } from '@/types/analysis';
import { DCFAssumptions, DCFScenario, ScenarioType } from '@/types/dcf';
import { calculateDCF, generateSensitivityMatrix, DCFInputs } from '@/lib/dcfCalculator';

import StockSearch from '@/components/StockSearch';
import MarketToggle from '@/components/MarketToggle';
import DCFAssumptionsForm from '@/components/dcf/DCFAssumptionsForm';
import FCFProjectionTable from '@/components/dcf/FCFProjectionTable';
import TerminalValueCard from '@/components/dcf/TerminalValueCard';
import IntrinsicValueOutput from '@/components/dcf/IntrinsicValueOutput';
import SensitivityMatrix from '@/components/dcf/SensitivityMatrix';
import ScenarioManager from '@/components/dcf/ScenarioManager';
import ExportControls from '@/components/dcf/ExportControls';
import { Calculator, Loader2, AlertCircle } from 'lucide-react';

function DCFPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const market = (searchParams.get('market') as Market) || 'US';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const [activeScenario, setActiveScenario] = useState<ScenarioType>('base');
  const [scenarios, setScenarios] = useState<Record<ScenarioType, DCFScenario> | null>(null);

  const currencySymbol = market === 'US' ? '$' : 'Rp';

  // Fetch Data
  useEffect(() => {
    async function fetchData() {
      if (!symbol) {
        setData(null);
        setScenarios(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analysis?symbol=${symbol}&market=${market}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to fetch data');
        }
        const json: AnalysisResponse = await res.json();
        setData(json);
        initializeScenarios(json, market);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [symbol, market]);

  const initializeScenarios = (apiData: AnalysisResponse, mkt: Market) => {
    const analysis = apiData.analysis;
    const isUS = mkt === 'US';
    
    // Auto-calculate Base Assumptions
    const riskFreeRate = isUS ? 4.3 : 6.8;
    const erp = isUS ? 5.5 : 7.0;
    const beta = analysis.fundamentals.beta || 1.0;
    
    // Cost of Debt approximation: Interest Expense / Total Debt
    let costOfDebt = 5.0; // Default
    const recentInterest = analysis.financials[0]?.interestExpense || 0;
    const recentDebt = analysis.balanceSheets[0]?.totalDebt || 0;
    if (recentInterest > 0 && recentDebt > 0) {
      costOfDebt = (recentInterest / recentDebt) * 100;
    }

    // Tax Rate approximation: Income Tax / Pretax Income
    let taxRate = isUS ? 21.0 : 22.0;
    const recentTax = analysis.financials[0]?.incomeTaxExpense || 0;
    const recentPretax = analysis.financials[0]?.incomeBeforeTax || 0;
    if (recentTax > 0 && recentPretax > 0) {
      taxRate = (recentTax / recentPretax) * 100;
    }

    // Weights
    const marketCap = analysis.fundamentals.marketCap || 0;
    const totalCap = marketCap + recentDebt;
    const equityWeight = totalCap > 0 ? marketCap / totalCap : 1;
    const debtWeight = totalCap > 0 ? recentDebt / totalCap : 0;

    // Growth rates
    const histCagr = analysis.cagr?.revenue5Y || analysis.cagr?.revenue3Y || 5.0;
    const phase1Growth = Math.max(0, Math.min(histCagr, 20)); // Cap between 0 and 20%
    const phase2Growth = phase1Growth * 0.6; // Deceleration
    const terminalGrowth = isUS ? 2.5 : 3.0;

    const baseAssumptions: DCFAssumptions = {
      riskFreeRate,
      beta,
      equityRiskPremium: erp,
      costOfDebt,
      taxRate,
      equityWeight,
      debtWeight,
      phase1Growth,
      phase2Growth,
      terminalGrowth,
    };

    setScenarios({
      conservative: {
        type: 'conservative',
        label: 'Conservative',
        assumptions: {
          ...baseAssumptions,
          riskFreeRate: baseAssumptions.riskFreeRate + 1.0,
          phase1Growth: baseAssumptions.phase1Growth * 0.7,
          phase2Growth: (baseAssumptions.phase1Growth * 0.7) * 0.6,
          terminalGrowth: Math.max(1.0, baseAssumptions.terminalGrowth - 0.5),
        }
      },
      base: {
        type: 'base',
        label: 'Base Case',
        assumptions: baseAssumptions,
      },
      optimistic: {
        type: 'optimistic',
        label: 'Optimistic',
        assumptions: {
          ...baseAssumptions,
          riskFreeRate: Math.max(1.0, baseAssumptions.riskFreeRate - 1.0),
          phase1Growth: baseAssumptions.phase1Growth * 1.2,
          phase2Growth: (baseAssumptions.phase1Growth * 1.2) * 0.6,
          terminalGrowth: Math.min(4.0, baseAssumptions.terminalGrowth + 0.5),
        }
      }
    });
  };

  // Run DCF Calculator whenever scenarios or active scenario changes
  useEffect(() => {
    if (!data || !scenarios) return;

    const inputs: DCFInputs = {
      currentFCF: data.analysis.fundamentals.freeCashFlow || 0,
      totalDebt: data.analysis.balanceSheets[0]?.totalDebt || 0,
      cashAndEquivalents: data.analysis.balanceSheets[0]?.cash || 0,
      sharesOutstanding: data.analysis.fundamentals.sharesOutstanding || (
        (data.analysis.fundamentals.marketCap || 0) / (data.analysis.fundamentals.price || 1)
      ),
      currentPrice: data.analysis.fundamentals.price || 0,
    };

    // Calculate all scenarios
    const updatedScenarios = { ...scenarios };
    let changed = false;

    (['conservative', 'base', 'optimistic'] as ScenarioType[]).forEach((type) => {
      const currentRes = updatedScenarios[type].result;
      const newRes = calculateDCF(updatedScenarios[type].assumptions, inputs);
      
      // Deep compare could be better, but simple check on intrinsic value to prevent infinite loop
      if (!currentRes || Math.abs(currentRes.intrinsicValuePerShare - newRes.intrinsicValuePerShare) > 0.01) {
        updatedScenarios[type].result = newRes;
        changed = true;
      }
    });

    if (changed) {
      setScenarios(updatedScenarios);
    }
  }, [scenarios, data]);


  const handleSearch = (s: string, m: Market) => {
    router.push(`/dcf?symbol=${s}&market=${m}`);
  };

  const handleMarketChange = (mkt: Market) => {
    if (symbol) {
      router.push(`/dcf?symbol=${symbol}&market=${mkt}`);
    } else {
      router.push(`/dcf?market=${mkt}`);
    }
  };

  const handleAssumptionChange = (key: keyof DCFAssumptions, value: number) => {
    if (!scenarios) return;
    setScenarios(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [activeScenario]: {
          ...prev[activeScenario],
          assumptions: {
            ...prev[activeScenario].assumptions,
            [key]: value
          }
        }
      };
    });
  };

  // Prepare active data
  const activeData = scenarios ? scenarios[activeScenario] : null;
  const currentPrice = data?.analysis.fundamentals.price || 0;

  // Generate matrix
  let matrix = null;
  if (activeData?.result && data) {
    const inputs: DCFInputs = {
      currentFCF: data.analysis.fundamentals.freeCashFlow || 0,
      totalDebt: data.analysis.balanceSheets[0]?.totalDebt || 0,
      cashAndEquivalents: data.analysis.balanceSheets[0]?.cash || 0,
      sharesOutstanding: data.analysis.fundamentals.sharesOutstanding || (
        (data.analysis.fundamentals.marketCap || 0) / currentPrice
      ),
      currentPrice: currentPrice,
    };
    // -2% to +2% WACC, -1% to +1% Terminal Growth
    matrix = generateSensitivityMatrix(
      activeData.assumptions, 
      inputs, 
      [-2, -1, 0, 1, 2],
      [-1, -0.5, 0, 0.5, 1]
    );
  }

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in pb-20">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 hide-on-print">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-500" />
            DCF Valuation Engine
          </h1>
          <p className="text-gray-400 mt-2">
            Calculate intrinsic value using the Discounted Cash Flow model.
          </p>
        </div>
        <div className="w-full md:w-auto flex flex-col md:flex-row items-end md:items-center gap-4">
          <MarketToggle market={market} onChange={handleMarketChange} />
          <div className="w-full md:w-80">
            <StockSearch onSelect={handleSearch} market={market} placeholder="Search to run DCF..." />
          </div>
        </div>
      </header>

      {/* States */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
          <p>Fetching comprehensive data for {symbol}…</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Error Loading Data</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {!symbol && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500 border border-dashed border-white/10 rounded-xl">
          <Calculator className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">Search for a stock to begin valuation.</p>
        </div>
      )}

      {/* Main Content */}
      {symbol && data && scenarios && activeData && activeData.result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Assumptions */}
          <div className="lg:col-span-4 space-y-6">
            <div className="card sticky top-6">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                  {symbol}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{data.analysis.profile.name}</h2>
                  <div className="text-sm text-gray-400">
                    {currencySymbol}{currentPrice.toFixed(2)} • {data.analysis.profile.sector}
                  </div>
                </div>
              </div>

              <DCFAssumptionsForm
                market={market}
                assumptions={activeData.assumptions}
                onChange={handleAssumptionChange}
                result={activeData.result}
              />
            </div>
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-8 space-y-6">
            
            <ScenarioManager 
              scenarios={scenarios}
              activeScenario={activeScenario}
              onScenarioSelect={setActiveScenario}
              currentPrice={currentPrice}
              currencySymbol={currencySymbol}
            />

            <IntrinsicValueOutput 
              result={activeData.result} 
              currencySymbol={currencySymbol} 
            />

            {matrix && (
              <SensitivityMatrix 
                matrix={matrix} 
                currentPrice={currentPrice} 
                currencySymbol={currencySymbol} 
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <FCFProjectionTable 
                  projections={activeData.result.projections} 
                  currencySymbol={currencySymbol} 
                />
              </div>
              <div className="md:col-span-2">
                <TerminalValueCard 
                  result={activeData.result} 
                  currencySymbol={currencySymbol} 
                />
              </div>
            </div>

            <ExportControls 
              symbol={symbol}
              assumptions={activeData.assumptions}
              result={activeData.result}
            />

          </div>
        </div>
      )}

    </main>
  );
}

export default function DCFPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <DCFPageContent />
    </React.Suspense>
  );
}
