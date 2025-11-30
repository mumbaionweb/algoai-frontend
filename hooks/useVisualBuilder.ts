import { useState, useEffect, useCallback } from 'react';
import { getVisualBuilderModel, updateVisualBuilderModel, type VisualBuilderModelResponse } from '@/lib/api/strategies';
import type { StrategyModel } from '@/types';

export interface UseVisualBuilderReturn {
  model: StrategyModel | null;
  loading: boolean;
  error: Error | null;
  loadModel: () => Promise<void>;
  saveModel: (newModel: StrategyModel) => Promise<VisualBuilderModelResponse>;
  setModel: React.Dispatch<React.SetStateAction<StrategyModel | null>>;
}

/**
 * Hook for managing visual builder model state and API interactions
 * @param strategyId Strategy ID (null if no strategy selected)
 * @returns Visual builder state and methods
 */
export function useVisualBuilder(strategyId: string | null): UseVisualBuilderReturn {
  const [model, setModel] = useState<StrategyModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load visual builder model
  const loadModel = useCallback(async () => {
    if (!strategyId) {
      setModel(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[VISUAL_BUILDER] Loading model for strategy:', strategyId);
      const response = await getVisualBuilderModel(strategyId);
      console.log('[VISUAL_BUILDER] Model loaded:', {
        hasModel: !!response.strategy_model,
        modelKeys: response.strategy_model ? Object.keys(response.strategy_model) : [],
      });
      setModel(response.strategy_model);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load visual builder model');
      setError(error);
      console.error('[VISUAL_BUILDER] Failed to load model:', error);
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  // Save visual builder model
  const saveModel = useCallback(
    async (newModel: StrategyModel): Promise<VisualBuilderModelResponse> => {
      if (!strategyId) {
        throw new Error('Strategy ID is required to save visual builder model');
      }

      setLoading(true);
      setError(null);

      try {
        console.log('[VISUAL_BUILDER] Saving model for strategy:', strategyId);
        const response = await updateVisualBuilderModel(strategyId, newModel);
        console.log('[VISUAL_BUILDER] Model saved successfully');
        setModel(response.strategy_model);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to save visual builder model');
        setError(error);
        console.error('[VISUAL_BUILDER] Failed to save model:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [strategyId]
  );

  // Load model on mount and when strategyId changes
  useEffect(() => {
    if (strategyId) {
      loadModel();
    } else {
      setModel(null);
      setError(null);
    }
  }, [strategyId, loadModel]);

  return {
    model,
    loading,
    error,
    loadModel,
    saveModel,
    setModel,
  };
}

