'use client';

import { useState, useEffect } from 'react';
import type { Strategy, StrategyModel } from '@/types';
import { updateStrategy } from '@/lib/api/strategies';

interface VisualBuilderProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
  onModelChange?: (model: StrategyModel | null) => void; // Callback when model changes
}

export default function VisualBuilder({ 
  currentStrategy, 
  onStrategyUpdate,
  onModelChange 
}: VisualBuilderProps) {
  const [model, setModel] = useState<StrategyModel | null>(null);

  // Load model from strategy when it changes
  useEffect(() => {
    if (currentStrategy?.strategy_model) {
      setModel(currentStrategy.strategy_model);
      onModelChange?.(currentStrategy.strategy_model);
    } else {
      // If no model exists, initialize empty
      setModel(null);
      onModelChange?.(null);
    }
  }, [currentStrategy?.id, currentStrategy?.strategy_model, onModelChange]);

  // Save model changes
  const handleSaveModel = async (newModel: StrategyModel) => {
    if (!currentStrategy?.id) return;

    try {
      await updateStrategy(currentStrategy.id, { strategy_model: newModel }, false);
      setModel(newModel);
      onModelChange?.(newModel);
      onStrategyUpdate();
    } catch (err) {
      console.error('Failed to save visual builder model:', err);
    }
  };

  return (
    <div className="h-full bg-gray-900 p-4 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Visual Strategy Builder</h3>
          {model && (
            <div className="text-xs text-green-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Model loaded
            </div>
          )}
        </div>
        <div className="bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-700">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-400 mb-2">Visual Builder Coming Soon</p>
          <p className="text-sm text-gray-500 mb-4">Drag and drop components to build your strategy visually</p>
          {model && (
            <div className="mt-4 p-4 bg-gray-700 rounded text-left">
              <p className="text-xs text-gray-400 mb-2">Current Model Structure:</p>
              <pre className="text-xs text-gray-300 overflow-auto max-h-32">
                {JSON.stringify(model, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

