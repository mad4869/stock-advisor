import React, { useState, useEffect } from 'react';
import { useStoryAnalysisStore } from '@/lib/storyAnalysisStore';
import { CheckSquare, Square, Save, CheckCircle } from 'lucide-react';

interface StoryChecklistProps {
  symbol: string;
  onSave?: () => void;
}

export function StoryChecklist({ symbol, onSave }: StoryChecklistProps) {
  const getAnalysis = useStoryAnalysisStore(state => state.getAnalysis);
  const saveAnalysis = useStoryAnalysisStore(state => state.saveAnalysis);
  
  const existing = getAnalysis(symbol);
  
  const [megatrendChecked, setMegatrendChecked] = useState(existing?.megatrend.checked || false);
  const [megatrendNote, setMegatrendNote] = useState(existing?.megatrend.justification || '');
  
  const [moatChecked, setMoatChecked] = useState(existing?.moat.checked || false);
  const [moatNote, setMoatNote] = useState(existing?.moat.justification || '');
  
  const [catalystChecked, setCatalystChecked] = useState(existing?.catalyst.checked || false);
  const [catalystNote, setCatalystNote] = useState(existing?.catalyst.justification || '');

  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = getAnalysis(symbol);
    if (data) {
      setMegatrendChecked(data.megatrend.checked);
      setMegatrendNote(data.megatrend.justification);
      setMoatChecked(data.moat.checked);
      setMoatNote(data.moat.justification);
      setCatalystChecked(data.catalyst.checked);
      setCatalystNote(data.catalyst.justification);
    } else {
      setMegatrendChecked(false);
      setMegatrendNote('');
      setMoatChecked(false);
      setMoatNote('');
      setCatalystChecked(false);
      setCatalystNote('');
    }
    setSaved(false);
  }, [symbol, getAnalysis]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    saveAnalysis(symbol, {
      megatrend: { checked: megatrendChecked, justification: megatrendNote },
      moat: { checked: moatChecked, justification: moatNote },
      catalyst: { checked: catalystChecked, justification: catalystNote },
    });
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    if (onSave) onSave();
  };

  const currentScore = [
    megatrendChecked && megatrendNote.trim().length > 0,
    moatChecked && moatNote.trim().length > 0,
    catalystChecked && catalystNote.trim().length > 0
  ].filter(Boolean).length;

  const scoreColor = currentScore === 3 ? 'text-green-400 border-green-500 bg-green-500/10' :
                     currentScore > 0 ? 'text-yellow-400 border-yellow-500 bg-yellow-500/10' :
                     'text-gray-400 border-dark-600 bg-dark-900';

  if (!mounted) return null;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">Story Checklist (Qualitative)</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-bold border ${scoreColor}`}>
          Score: {currentScore}/3
        </span>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Megatrend */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group w-fit" onClick={(e) => { e.preventDefault(); setMegatrendChecked(!megatrendChecked); }}>
            <div>
              {megatrendChecked ? (
                <CheckSquare className="w-5 h-5 text-blue-500" />
              ) : (
                <Square className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
              )}
            </div>
            <span className="font-semibold text-gray-200">1. Megatrend / Tailwinds</span>
          </label>
          <textarea
            disabled={!megatrendChecked}
            value={megatrendNote}
            onChange={e => setMegatrendNote(e.target.value)}
            placeholder={megatrendChecked ? "Type your justification here..." : "e.g. EV adoption growing 30% YoY, government subsidies increasing..."}
            className={`w-full border rounded-lg p-3 text-sm focus:outline-none min-h-[80px] transition-colors ${
              megatrendChecked 
                ? 'bg-dark-900 border-dark-600 text-white focus:border-blue-500' 
                : 'bg-dark-800 border-dark-700 text-gray-500 cursor-not-allowed opacity-60'
            }`}
            required={megatrendChecked}
          />
          {megatrendChecked && megatrendNote.trim().length === 0 && (
            <p className="text-xs text-yellow-500 font-medium">Justification required to earn a point.</p>
          )}
        </div>

        {/* Moat */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group w-fit" onClick={(e) => { e.preventDefault(); setMoatChecked(!moatChecked); }}>
            <div>
              {moatChecked ? (
                <CheckSquare className="w-5 h-5 text-blue-500" />
              ) : (
                <Square className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
              )}
            </div>
            <span className="font-semibold text-gray-200">2. Economic Moat</span>
          </label>
          <textarea
            disabled={!moatChecked}
            value={moatNote}
            onChange={e => setMoatNote(e.target.value)}
            placeholder={moatChecked ? "Type your justification here..." : "e.g. Strongest brand in category, 60% market share, high switching costs..."}
            className={`w-full border rounded-lg p-3 text-sm focus:outline-none min-h-[80px] transition-colors ${
              moatChecked 
                ? 'bg-dark-900 border-dark-600 text-white focus:border-blue-500' 
                : 'bg-dark-800 border-dark-700 text-gray-500 cursor-not-allowed opacity-60'
            }`}
            required={moatChecked}
          />
          {moatChecked && moatNote.trim().length === 0 && (
            <p className="text-xs text-yellow-500 font-medium">Justification required to earn a point.</p>
          )}
        </div>

        {/* Catalyst */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer group w-fit" onClick={(e) => { e.preventDefault(); setCatalystChecked(!catalystChecked); }}>
            <div>
              {catalystChecked ? (
                <CheckSquare className="w-5 h-5 text-blue-500" />
              ) : (
                <Square className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
              )}
            </div>
            <span className="font-semibold text-gray-200">3. Clear Catalyst</span>
          </label>
          <textarea
            disabled={!catalystChecked}
            value={catalystNote}
            onChange={e => setCatalystNote(e.target.value)}
            placeholder={catalystChecked ? "Type your justification here..." : "e.g. New factory operational Q2 2025, expanding to 3 new provinces..."}
            className={`w-full border rounded-lg p-3 text-sm focus:outline-none min-h-[80px] transition-colors ${
              catalystChecked 
                ? 'bg-dark-900 border-dark-600 text-white focus:border-blue-500' 
                : 'bg-dark-800 border-dark-700 text-gray-500 cursor-not-allowed opacity-60'
            }`}
            required={catalystChecked}
          />
          {catalystChecked && catalystNote.trim().length === 0 && (
            <p className="text-xs text-yellow-500 font-medium">Justification required to earn a point.</p>
          )}
        </div>

        <button 
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Story Analysis'}
        </button>
      </form>
    </div>
  );
}
