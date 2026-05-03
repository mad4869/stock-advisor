import React, { useState, useEffect } from 'react';
import { useBankingMetricsStore } from '@/lib/bankingMetricsStore';
import { AlertTriangle, CheckCircle, Save } from 'lucide-react';

interface BankingMetricsFormProps {
  symbol: string;
  onSave?: () => void;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function BankingMetricsForm({ symbol, onSave }: BankingMetricsFormProps) {
  const getMetrics = useBankingMetricsStore(state => state.getMetrics);
  const saveMetrics = useBankingMetricsStore(state => state.saveMetrics);
  
  const existing = getMetrics(symbol);
  
  const [npl, setNpl] = useState<string>(existing?.npl.toString() || '');
  const [car, setCar] = useState<string>(existing?.car.toString() || '');
  const [note, setNote] = useState<string>(existing?.sourceNote || '');
  const [error, setError] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset form when symbol changes
  useEffect(() => {
    const data = getMetrics(symbol);
    if (data) {
      setNpl(data.npl.toString());
      setCar(data.car.toString());
      setNote(data.sourceNote);
    } else {
      setNpl('');
      setCar('');
      setNote('');
    }
    setSaved(false);
    setError('');
  }, [symbol, getMetrics]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const parseDecimalInput = (value: string): number => {
      if (!value || value.trim() === '') return NaN;
      const normalized = value.replace(',', '.');
      return parseFloat(normalized);
    };
    
    const nplVal = parseDecimalInput(npl);
    const carVal = parseDecimalInput(car);
    
    if (isNaN(nplVal) || nplVal < 0 || nplVal > 100) {
      setError('NPL must be a number between 0 and 100');
      return;
    }
    
    if (isNaN(carVal) || carVal < 0 || carVal > 100) {
      setError('CAR must be a number between 0 and 100');
      return;
    }

    saveMetrics(symbol, {
      npl: nplVal,
      car: carVal,
      sourceNote: note,
    });
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    if (onSave) onSave();
  };

  const isStale = existing ? (Date.now() - existing.lastUpdated) > NINETY_DAYS_MS : false;
  
  const formattedDate = existing 
    ? new Date(existing.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  if (!mounted) return null;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 shadow-lg flex flex-col h-full">
      <h3 className="text-lg font-bold text-white mb-4">Banking Metrics (Manual Input)</h3>
      
      {existing && (
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-3 border ${isStale ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-dark-900 border-dark-700'}`}>
          {isStale ? (
             <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          ) : (
             <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <p className={isStale ? "text-yellow-200 font-medium" : "text-gray-300 font-medium"}>
              {isStale ? 'Warning: Data is >90 days old' : 'Data is up to date'}
            </p>
            <p className="text-gray-400 mt-0.5">Last saved: {formattedDate}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="npl-input" className="block text-sm font-medium text-gray-400 mb-1">NPL Ratio (%)</label>
            <input 
              id="npl-input"
              type="number" 
              step="0.01"
              value={npl}
              onChange={e => setNpl(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. 1.5"
              required
            />
          </div>
          <div>
            <label htmlFor="car-input" className="block text-sm font-medium text-gray-400 mb-1">CAR (%)</label>
            <input 
              id="car-input"
              type="number" 
              step="0.01"
              value={car}
              onChange={e => setCar(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. 20.5"
              required
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="note-input" className="block text-sm font-medium text-gray-400 mb-1">Source Note (Optional)</label>
          <input 
            id="note-input"
            type="text" 
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="e.g. Q3 2024 Financial Report"
          />
        </div>

        </div>

        <div className="mt-4">
          {error && <p className="text-red-400 text-sm font-medium mb-3">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Metrics'}
          </button>
        </div>
      </form>
    </div>
  );
}
