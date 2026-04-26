import React from 'react';
import { SensitivityCell } from '@/lib/dcfCalculator';
import { Info } from 'lucide-react';

interface Props {
  matrix: SensitivityCell[][];
  currentPrice: number;
  currencySymbol: string;
}

export default function SensitivityMatrix({ matrix, currentPrice, currencySymbol }: Props) {
  if (!matrix || matrix.length === 0) return null;

  // The columns correspond to Terminal Growth Steps
  const tgSteps = matrix[0].map(c => c.terminalGrowth);
  // The rows correspond to WACC Steps
  const waccSteps = matrix.map(row => row[0].wacc);

  // Formatting helpers
  const formatVal = (val: number) => val.toFixed(2);
  const formatPct = (val: number) => `${val.toFixed(2)}%`;

  // Color coding relative to current price
  const getCellColor = (intrinsicValue: number) => {
    const margin = (intrinsicValue - currentPrice) / intrinsicValue;
    if (margin > 0.1) return 'bg-green-500/20 text-green-300';
    if (margin > 0) return 'bg-green-500/10 text-green-400';
    if (margin > -0.1) return 'bg-yellow-500/10 text-yellow-400';
    return 'bg-red-500/10 text-red-400';
  };

  // The base case is the center cell assuming we generate 5x5 matrix
  const isBaseCase = (rowIndex: number, colIndex: number) => {
    return rowIndex === Math.floor(matrix.length / 2) && colIndex === Math.floor(tgSteps.length / 2);
  };

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-lg font-semibold text-white">Sensitivity Analysis</h3>
        <div className="group relative">
          <Info className="w-4 h-4 text-gray-500 cursor-help" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-300 z-10">
            Shows how the Intrinsic Value changes when tweaking the Discount Rate (WACC) and Terminal Growth Rate.
            <br/><br/>
            Green cells mean the stock is undervalued at those assumptions relative to the current price of {currencySymbol}{currentPrice.toFixed(2)}.
          </div>
        </div>
      </div>

      <div className="min-w-[600px]">
        {/* Terminal Growth Header */}
        <div className="text-center text-xs text-gray-400 font-medium mb-2 pl-24">
          Terminal Growth Rate
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-24 border-none"></th>
              {tgSteps.map((tg, i) => (
                <th key={i} className="py-2 px-1 text-center font-mono text-gray-400 bg-black/20 border-b border-white/5 w-1/5">
                  {formatPct(tg)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rIndex) => (
              <tr key={rIndex}>
                {/* WACC Label */}
                <td className="py-2 pr-4 text-right font-mono text-gray-400 text-xs relative bg-black/20 border-r border-white/5">
                  {rIndex === Math.floor(matrix.length / 2) && (
                    <span className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] tracking-widest uppercase opacity-50 whitespace-nowrap">
                      Discount Rate
                    </span>
                  )}
                  {formatPct(waccSteps[rIndex])}
                </td>

                {/* Cells */}
                {row.map((cell, cIndex) => {
                  const isCenter = isBaseCase(rIndex, cIndex);
                  return (
                    <td 
                      key={cIndex}
                      className={`
                        p-1 text-center border border-black/50 transition-colors
                        ${getCellColor(cell.intrinsicValue)}
                        ${isCenter ? 'ring-2 ring-blue-500 z-10 relative shadow-lg' : 'hover:brightness-125'}
                      `}
                    >
                      <div className="font-medium">
                        {formatVal(cell.intrinsicValue)}
                      </div>
                      {isCenter && (
                        <div className="text-[9px] uppercase tracking-wider text-blue-300 mt-0.5 font-bold">
                          Base Case
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex items-center justify-end gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500/20"></div> Undervalued</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-yellow-500/10"></div> Fair</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500/10"></div> Overvalued</div>
      </div>
    </div>
  );
}
