'use client';

import type { Strategy } from '@/types';

interface VisualBuilderProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
}

export default function VisualBuilder({ currentStrategy, onStrategyUpdate }: VisualBuilderProps) {
  return (
    <div className="h-full bg-gray-900 p-4 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-white mb-4">Visual Strategy Builder</h3>
        <div className="bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-700">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-400 mb-2">Visual Builder Coming Soon</p>
          <p className="text-sm text-gray-500">Drag and drop components to build your strategy visually</p>
        </div>
      </div>
    </div>
  );
}

