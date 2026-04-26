import React from 'react';
import { DCFAssumptions, DCFResult } from '@/types/dcf';
import { Market } from '@/types';
import { Info, Percent, Activity, Banknote } from 'lucide-react';

interface Props {
  market: Market;
  assumptions: DCFAssumptions;
  onChange: (key: keyof DCFAssumptions, value: number) => void;
  result: DCFResult | null;
}

export default function DCFAssumptionsForm({ market, assumptions, onChange, result }: Props) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof DCFAssumptions) => {
    const value = parseFloat(e.target.value);
    onChange(key, isNaN(value) ? 0 : value);
  };

  interface InputRowProps {
    label: string;
    valueKey: keyof DCFAssumptions;
    step?: number;
    icon?: any;
    tooltip?: string;
  }

  const InputRow = ({ label, valueKey, step = 0.1, icon: Icon, tooltip }: InputRowProps) => (
    <div className="flex items-center justify-between py-2 border-b border-white/5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {tooltip && (
          <div className="group relative">
            <Info className="w-3 h-3 text-gray-600 cursor-help" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 z-10 text-center">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          step={step}
          value={assumptions[valueKey]}
          onChange={(e) => handleInputChange(e, valueKey)}
          className="w-24 bg-black/30 border border-white/10 rounded px-2 py-1 text-right text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* WACC Section */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-purple-400" />
          Discount Rate (WACC)
        </h3>
        
        <div className="space-y-1">
          <InputRow 
            label="Risk-Free Rate" 
            valueKey="riskFreeRate" 
            icon={Activity} 
            tooltip={`Default: ${market === 'US' ? '4.3%' : '6.8%'} based on 10Y Government Bond`} 
          />
          <InputRow 
            label="Beta" 
            valueKey="beta" 
            step={0.01}
            icon={Activity} 
            tooltip="Measure of volatility relative to the market" 
          />
          <InputRow 
            label="Equity Risk Premium" 
            valueKey="equityRiskPremium" 
            icon={Percent} 
            tooltip="Expected market return above the risk-free rate" 
          />
          <InputRow 
            label="Cost of Debt" 
            valueKey="costOfDebt" 
            icon={Percent} 
            tooltip="Interest rate paid on debt" 
          />
          <InputRow 
            label="Effective Tax Rate" 
            valueKey="taxRate" 
            icon={Percent} 
          />
        </div>

        {/* WACC Breakdown Visual */}
        {result && (
          <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">Calculated WACC</span>
              <span className="text-lg font-bold text-blue-400">{result.wacc.toFixed(2)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex">
              <div 
                style={{ width: `${(assumptions.equityWeight || 1) * 100}%` }} 
                className="h-full bg-blue-500/80"
                title={`Equity Weight: ${((assumptions.equityWeight || 1) * 100).toFixed(1)}%`}
              />
              <div 
                style={{ width: `${(assumptions.debtWeight || 0) * 100}%` }} 
                className="h-full bg-orange-500/80"
                title={`Debt Weight: ${((assumptions.debtWeight || 0) * 100).toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-500">
              <span>Equity: {((assumptions.equityWeight || 1) * 100).toFixed(1)}%</span>
              <span>Debt: {((assumptions.debtWeight || 0) * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Growth Section */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUpIcon className="w-5 h-5 text-green-400" />
          Growth Assumptions
        </h3>
        <div className="space-y-1">
          <InputRow 
            label="Phase 1 Growth (Yr 1-5)" 
            valueKey="phase1Growth" 
            step={0.5}
            tooltip="Short-term growth rate based on historicals or analyst estimates" 
          />
          <InputRow 
            label="Phase 2 Growth (Yr 6-10)" 
            valueKey="phase2Growth" 
            step={0.5}
            tooltip="Medium-term growth, usually decelerating (e.g. 60% of Phase 1)" 
          />
          <InputRow 
            label="Terminal Growth" 
            valueKey="terminalGrowth" 
            step={0.1}
            tooltip="Long-term growth into perpetuity. Should not exceed GDP growth." 
          />
        </div>
      </div>
    </div>
  );
}

function TrendingUpIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}
