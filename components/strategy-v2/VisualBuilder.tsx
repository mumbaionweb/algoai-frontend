'use client';

import { useEffect } from 'react';
import type { Strategy, StrategyModel } from '@/types';
import { useVisualBuilder } from '@/hooks/useVisualBuilder';

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
  const { model, loading, error, loadModel, saveModel, setModel } = useVisualBuilder(currentStrategy?.id || null);

  // Notify parent when model changes
  useEffect(() => {
    if (onModelChange) {
      onModelChange(model);
    }
  }, [model, onModelChange]);

  // Refresh model when strategy is updated (e.g., after code save)
  // This ensures visual builder stays in sync with code changes
  useEffect(() => {
    if (currentStrategy?.id) {
      // Check if we need to refresh based on strategy_model timestamp or content
      // If strategy_model exists in currentStrategy, use it directly
      // Otherwise, fetch from API (which will auto-extract if code exists)
      if (currentStrategy.strategy_model) {
        console.log('[VISUAL_BUILDER] Strategy model available in currentStrategy, updating local state');
        setModel(currentStrategy.strategy_model);
      } else {
        // No model in strategy object, fetch from API (backend will extract if code exists)
        console.log('[VISUAL_BUILDER] No model in strategy, fetching from API (will auto-extract if code exists)');
        const timer = setTimeout(() => {
          loadModel();
        }, 500); // Small delay to ensure backend has processed any code saves
        return () => clearTimeout(timer);
      }
    }
  }, [currentStrategy?.id, currentStrategy?.strategy_model, loadModel]);

  // Save model changes (for future use when visual builder is fully implemented)
  const handleSaveModel = async (newModel: StrategyModel) => {
    if (!currentStrategy?.id) return;

    try {
      await saveModel(newModel);
      onStrategyUpdate();
    } catch (err) {
      console.error('[VISUAL_BUILDER] Failed to save model:', err);
    }
  };

  return (
    <div className="h-full bg-gray-900 p-4 overflow-auto min-h-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Visual Strategy Builder</h3>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Loading...
              </div>
            )}
            {!loading && model && (
              <div className="text-xs text-green-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Model loaded
              </div>
            )}
            {!loading && !model && currentStrategy?.id && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No model available
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500 text-red-400 rounded-lg text-sm">
            Error: {error.message}
            <button
              onClick={() => loadModel()}
              className="ml-2 text-red-300 hover:text-red-200 underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-700">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-400 mb-2">Visual Builder Coming Soon</p>
          <p className="text-sm text-gray-500 mb-4">Drag and drop components to build your strategy visually</p>
          
          {model && (
            <div className="mt-4 p-4 bg-gray-700 rounded text-left">
              <p className="text-xs text-gray-400 mb-2">Current Model Structure:</p>
              <pre className="text-xs text-gray-300 overflow-auto max-h-64">
                {JSON.stringify(model, null, 2)}
              </pre>
            </div>
          )}

          {!model && !loading && currentStrategy?.id && (
            <div className="mt-4 p-3 bg-gray-700/50 rounded text-sm text-gray-400">
              <p>Generate code in AI Chat or write code in the Code Editor to see the visual model here.</p>
              <p className="text-xs mt-2">The backend will automatically extract the model structure from your code.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

