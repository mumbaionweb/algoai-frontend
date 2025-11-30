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
  }, [currentStrategy?.id, currentStrategy?.strategy_model, loadModel, setModel]);

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

  // Render a section card
  const renderSection = (title: string, icon: React.ReactNode, content: React.ReactNode) => (
    <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      {content}
    </div>
  );

  if (loading) {
    return (
      <div className="h-full bg-gray-900 p-4 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-sm text-gray-400">Loading visual builder...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="p-4 bg-red-500/10 border border-red-500 text-red-400 rounded-lg">
            <p className="font-semibold mb-2">Error loading visual builder</p>
            <p className="text-sm mb-3">{error.message}</p>
            <button
              onClick={() => loadModel()}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="h-full bg-gray-900 p-4 overflow-auto min-h-0">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-700">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-400 mb-2">No Model Available</p>
            <p className="text-sm text-gray-500 mb-4">Generate code in AI Chat or write code in the Code Editor</p>
            <p className="text-xs text-gray-600">The backend will automatically extract the model structure from your code.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 p-4 overflow-auto min-h-0">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Visual Strategy Builder</h3>
            {model.meta?.class_name && (
              <p className="text-xs text-gray-400 mt-1">Class: {model.meta.class_name}</p>
            )}
          </div>
          <div className="text-xs text-green-400 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Model loaded
          </div>
        </div>

        {/* Meta Information */}
        {model.meta && (
          renderSection(
            'Strategy Information',
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>,
            <div className="space-y-2">
              {model.meta.class_name && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-24">Class Name:</span>
                  <span className="text-sm text-white font-mono">{model.meta.class_name}</span>
                </div>
              )}
              {model.meta.description && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 w-24">Description:</span>
                  <span className="text-sm text-gray-300">{model.meta.description}</span>
                </div>
              )}
            </div>
          )
        )}

        {/* Parameters */}
        {model.parameters && Object.keys(model.parameters).length > 0 && (
          renderSection(
            'Parameters',
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>,
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(model.parameters).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-xs text-gray-400 font-medium">{key}:</span>
                  <span className="text-sm text-white font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Indicators */}
        {model.indicators && model.indicators.length > 0 && (
          renderSection(
            'Indicators',
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>,
            <div className="space-y-2">
              {model.indicators.map((indicator: any, index: number) => (
                <div key={index} className="p-3 bg-gray-700/50 rounded border-l-2 border-yellow-400">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{indicator.type || 'Indicator'}</span>
                    {indicator.period && (
                      <span className="text-xs text-gray-400">Period: {indicator.period}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    {indicator.source && <span>Source: {indicator.source}</span>}
                    {Object.entries(indicator).map(([key, value]) => 
                      key !== 'type' && key !== 'period' && key !== 'source' && (
                        <span key={key}>{key}: {String(value)}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Entry Conditions */}
        {model.entries && model.entries.length > 0 && (
          renderSection(
            'Entry Conditions',
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>,
            <div className="space-y-2">
              {model.entries.map((entry: any, index: number) => (
                <div key={entry.id || index} className="p-3 bg-gray-700/50 rounded border-l-2 border-green-400">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{entry.type || 'Entry Condition'}</span>
                    {entry.id && (
                      <span className="text-xs text-gray-400 font-mono">{entry.id}</span>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-xs text-gray-300 mb-2">{entry.description}</p>
                  )}
                  {entry.condition && (
                    <div className="text-xs text-gray-400 font-mono bg-gray-800/50 p-2 rounded">
                      {entry.condition}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Exit Conditions */}
        {model.exits && model.exits.length > 0 && (
          renderSection(
            'Exit Conditions',
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>,
            <div className="space-y-2">
              {model.exits.map((exit: any, index: number) => (
                <div key={exit.id || index} className="p-3 bg-gray-700/50 rounded border-l-2 border-red-400">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{exit.type || 'Exit Condition'}</span>
                    {exit.id && (
                      <span className="text-xs text-gray-400 font-mono">{exit.id}</span>
                    )}
                  </div>
                  {exit.description && (
                    <p className="text-xs text-gray-300 mb-2">{exit.description}</p>
                  )}
                  {exit.condition && (
                    <div className="text-xs text-gray-400 font-mono bg-gray-800/50 p-2 rounded">
                      {exit.condition}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Risk Management */}
        {model.risk && Object.keys(model.risk).length > 0 && (
          renderSection(
            'Risk Management',
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>,
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(model.risk).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                  <span className="text-xs text-gray-400 font-medium capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-sm text-white font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Additional Fields (if any) */}
        {Object.keys(model).filter(key => 
          !['meta', 'parameters', 'indicators', 'entries', 'exits', 'risk'].includes(key)
        ).length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-semibold text-white mb-3">Additional Information</h4>
            <pre className="text-xs text-gray-300 overflow-auto max-h-48 bg-gray-900/50 p-3 rounded">
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(model).filter(([key]) => 
                    !['meta', 'parameters', 'indicators', 'entries', 'exits', 'risk'].includes(key)
                  )
                ),
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

