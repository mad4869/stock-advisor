import React from 'react';
import { Download, Printer } from 'lucide-react';
import { DCFResult, DCFAssumptions } from '@/types/dcf';

interface Props {
  symbol: string;
  assumptions: DCFAssumptions;
  result: DCFResult | null;
}

export default function ExportControls({ symbol, assumptions, result }: Props) {
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!result) return;

    // Build CSV Content
    const rows = [
      ['Discounted Cash Flow Valuation', `Symbol: ${symbol}`, `Date: ${new Date().toISOString().split('T')[0]}`],
      [],
      ['--- ASSUMPTIONS ---'],
      ['Risk-Free Rate (%)', assumptions.riskFreeRate],
      ['Beta', assumptions.beta],
      ['Equity Risk Premium (%)', assumptions.equityRiskPremium],
      ['Cost of Debt (%)', assumptions.costOfDebt],
      ['Tax Rate (%)', assumptions.taxRate],
      ['Phase 1 Growth (%)', assumptions.phase1Growth],
      ['Phase 2 Growth (%)', assumptions.phase2Growth],
      ['Terminal Growth (%)', assumptions.terminalGrowth],
      ['Calculated WACC (%)', result.wacc.toFixed(2)],
      [],
      ['--- PROJECTIONS ---'],
      ['Year', 'Projected FCF', 'Discount Factor', 'Present Value']
    ];

    result.projections.forEach(p => {
      rows.push([
        p.year.toString(),
        p.fcf.toString(),
        p.discountFactor.toString(),
        p.presentValue.toString()
      ]);
    });

    rows.push([]);
    rows.push(['--- VALUATION ---']);
    rows.push(['PV of Projections', result.pvOfProjections]);
    rows.push(['Terminal Value', result.terminalValue]);
    rows.push(['PV of Terminal Value', result.pvOfTerminalValue]);
    rows.push(['Enterprise Value', result.enterpriseValue]);
    rows.push(['Less: Total Debt', result.totalDebt]);
    rows.push(['Plus: Cash & Equivalents', result.cashAndEquivalents]);
    rows.push(['Equity Value', result.equityValue]);
    rows.push(['Shares Outstanding', result.sharesOutstanding]);
    rows.push(['Intrinsic Value Per Share', result.intrinsicValuePerShare.toFixed(2)]);
    rows.push(['Current Price', result.currentPrice.toFixed(2)]);
    rows.push(['Margin of Safety (%)', result.marginOfSafety.toFixed(2)]);
    rows.push(['Verdict', result.verdict]);

    const csvContent = rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${symbol}_DCF_Valuation.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-3 mt-8 hide-on-print">
      <button 
        onClick={handleExportCSV}
        disabled={!result}
        className="flex items-center gap-2 px-4 py-2 bg-black/30 hover:bg-black/50 border border-white/10 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        Export to CSV
      </button>
      <button 
        onClick={handlePrint}
        disabled={!result}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Printer className="w-4 h-4" />
        Save as PDF (Print)
      </button>
    </div>
  );
}
