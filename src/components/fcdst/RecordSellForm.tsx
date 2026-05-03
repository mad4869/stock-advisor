'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import { WatchlistItem } from '@/types';

type ThesisAccuracy = 'correct' | 'partially_correct' | 'wrong';

interface FCDSTExitScore {
  totalScore: number | 'Incomplete';
  grade: string;
  snapshotDate?: number;
}

interface RecordSellFormProps {
  item: WatchlistItem;
  currentFcdstScore: FCDSTExitScore | null;
  formatCurrency: (value: number, market: WatchlistItem['market']) => string;
  onCancel: () => void;
  onSubmit: (
    sellPrice: number,
    lessonLearned: string,
    thesisAccuracy: ThesisAccuracy,
    scoreAtSell: FCDSTExitScore | null
  ) => void;
}

export function getFCDSTScoreDiff(
  scoreAtBuy: WatchlistItem['fcdstScore'],
  scoreAtSell: FCDSTExitScore | null
) {
  if (
    !scoreAtBuy ||
    !scoreAtSell ||
    typeof scoreAtBuy.totalScore !== 'number' ||
    typeof scoreAtSell.totalScore !== 'number'
  ) {
    return null;
  }

  return scoreAtSell.totalScore - scoreAtBuy.totalScore;
}

export function RecordSellForm({
  item,
  currentFcdstScore,
  formatCurrency,
  onCancel,
  onSubmit,
}: RecordSellFormProps) {
  const [sellPrice, setSellPrice] = useState('');
  const [lessonLearned, setLessonLearned] = useState('');
  const [thesisAccuracy, setThesisAccuracy] = useState<ThesisAccuracy | ''>('');
  const [error, setError] = useState('');

  const scoreDiff = useMemo(
    () => getFCDSTScoreDiff(item.fcdstScore ?? null, currentFcdstScore),
    [item.fcdstScore, currentFcdstScore]
  );

  const handleSubmit = () => {
    setError('');

    const price = parseFloat(sellPrice);
    if (!price || price <= 0) {
      setError('Please enter a valid sell price.');
      return;
    }

    const trimmedLesson = lessonLearned.trim();
    if (trimmedLesson.length < 20) {
      setError('Lesson learned must be at least 20 characters.');
      return;
    }

    if (!thesisAccuracy) {
      setError('Please select if your thesis was correct.');
      return;
    }

    onSubmit(price, trimmedLesson, thesisAccuracy, currentFcdstScore);
  };

  return (
    <div className="mt-3 bg-dark-800 rounded-xl p-4 border border-dark-600 animate-fade-in flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-dark-700 pb-2">
        <h4 className="font-bold text-white">Close Position</h4>
        <button onClick={onCancel} className="text-gray-500 hover:text-white" aria-label="Cancel close position">
          X
        </button>
      </div>

      {item.fcdstScore && currentFcdstScore && (
        <div className="bg-dark-900 rounded p-3 text-xs">
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Score at Buy:</span>
            <span className="font-bold text-white">
              {item.fcdstScore.totalScore}/15 [{item.fcdstScore.grade}]
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">Score Now:</span>
            <span className="font-bold text-white">
              {currentFcdstScore.totalScore}/15 [{currentFcdstScore.grade}]
            </span>
          </div>
          {scoreDiff !== null && (
            <div className="flex justify-between mt-2 pt-2 border-t border-dark-700">
              <span className="text-gray-400">Change:</span>
              <span
                className={`font-bold ${
                  scoreDiff > 0 ? 'text-green-400' : scoreDiff < 0 ? 'text-red-400' : 'text-gray-300'
                }`}
              >
                {scoreDiff > 0 ? '+' : ''}
                {scoreDiff}
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="label">Lesson Learned *</label>
        <p className="text-[10px] text-gray-500 mb-1">What did you learn from this trade? (min 20 characters)</p>
        <textarea
          value={lessonLearned}
          onChange={(e) => setLessonLearned(e.target.value)}
          className="input-field min-h-[60px] text-sm"
          placeholder="I learned that..."
        />
      </div>

      <div>
        <label className="label">Was your thesis correct? *</label>
        <div className="flex flex-col gap-2 mt-2">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="radio"
              name={`accuracy-${item.id}`}
              value="correct"
              checked={thesisAccuracy === 'correct'}
              onChange={() => setThesisAccuracy('correct')}
              className="accent-blue-500"
            />
            Correct - thesis played out as expected
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="radio"
              name={`accuracy-${item.id}`}
              value="partially_correct"
              checked={thesisAccuracy === 'partially_correct'}
              onChange={() => setThesisAccuracy('partially_correct')}
              className="accent-blue-500"
            />
            Partially correct - some elements played out
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="radio"
              name={`accuracy-${item.id}`}
              value="wrong"
              checked={thesisAccuracy === 'wrong'}
              onChange={() => setThesisAccuracy('wrong')}
              className="accent-blue-500"
            />
            Wrong - thesis was invalidated
          </label>
        </div>
      </div>

      <div className="flex gap-2 items-end mt-2">
        <div className="flex-1">
          <label className="label">Sell Price ({item.market === 'ID' ? 'Rp' : '$'}) *</label>
          <input
            type="number"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            placeholder={`Current: ${formatCurrency(item.currentPrice, item.market)}`}
            className="input-field py-2"
            min="0"
            step="any"
          />
        </div>
        <button onClick={handleSubmit} className="btn-primary py-2 px-6 flex items-center gap-2">
          <Save className="w-4 h-4" />
          Sell & Save
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
