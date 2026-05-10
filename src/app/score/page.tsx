'use client';

import React from 'react';
import { Target } from 'lucide-react';

export default function ScorePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="card text-center py-20">
        <Target className="w-16 h-16 text-blue-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Swing Trading Score</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          This module is currently being redesigned for the new swing trading and bandarmology approach.
        </p>
      </div>
    </div>
  );
}
