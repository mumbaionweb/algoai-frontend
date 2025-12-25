'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStrategies, startStrategy, pauseStrategy, resumeStrategy, deleteStrategy } from '@/lib/api/strategies';
import type { Strategy } from '@/types';
import StrategyV2Layout from '@/components/strategy-v2/StrategyV2Layout';

function StrategyV2PageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const strategyId = params?.strategyId?.[0] as string | undefined;
  
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const previousStrategyIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadStrategies();
    }
  }, [isAuthenticated, isInitialized, router]);

  // Update current strategy when URL parameter or strategies change
  useEffect(() => {
    // Skip if strategies haven't loaded yet
    if (strategies.length === 0) {
      return;
    }

    console.log('[STRATEGY_V2] URL parameter effect:', {
      strategyId,
      previousStrategyId: previousStrategyIdRef.current,
      strategiesCount: strategies.length,
      currentStrategyId: currentStrategy?.id,
      strategyIds: strategies.map(s => s.id),
      timestamp: new Date().toISOString()
    });

    // Only update if strategyId changed or if we don't have a current strategy yet
    const strategyIdChanged = previousStrategyIdRef.current !== strategyId;
    const needsUpdate = strategyIdChanged || !currentStrategy;

    if (!needsUpdate) {
      console.log('[STRATEGY_V2] No update needed - strategyId unchanged and currentStrategy exists');
      return;
    }

    previousStrategyIdRef.current = strategyId;

    if (strategyId) {
      const strategy = strategies.find(s => s.id === strategyId);
      console.log('[STRATEGY_V2] Finding strategy:', {
        lookingFor: strategyId,
        found: strategy ? strategy.id : null,
        strategyName: strategy?.name || null,
        currentStrategyId: currentStrategy?.id
      });
      
      if (strategy) {
        // Always update if strategyId changed, or if currentStrategy doesn't match
        if (strategyIdChanged || currentStrategy?.id !== strategy.id) {
          console.log('[STRATEGY_V2] Setting current strategy:', strategy.id);
          setCurrentStrategy(strategy);
        }
      } else {
        // Strategy not found in list - might be deleted
        console.log('[STRATEGY_V2] Strategy not found in list, clearing selection');
        setCurrentStrategy(null);
      }
    } else {
      // No strategy ID in URL - clear selection
      if (strategyIdChanged || currentStrategy !== null) {
        console.log('[STRATEGY_V2] No strategy ID in URL, clearing selection');
        setCurrentStrategy(null);
      }
    }
  }, [strategyId, strategies, currentStrategy]);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      const response = await getStrategies({
        sort_by: 'created_at',
        order: 'desc',
        limit: 100
      });
      setStrategies(response.strategies);
      setActionError('');
    } catch (err: any) {
      console.error('Failed to load strategies:', err);
      setActionError(err.response?.data?.detail || 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyPlay = async (strategy: Strategy) => {
    try {
      if (strategy.status === 'paused') {
        await resumeStrategy(strategy.id);
      } else {
        await startStrategy(strategy.id);
      }
      await loadStrategies();
    } catch (err: any) {
      console.error('Failed to start/resume strategy:', err);
      setActionError(err.response?.data?.detail || 'Failed to start strategy');
    }
  };

  const handleStrategyPause = async (strategy: Strategy) => {
    try {
      await pauseStrategy(strategy.id);
      await loadStrategies();
    } catch (err: any) {
      console.error('Failed to pause strategy:', err);
      setActionError(err.response?.data?.detail || 'Failed to pause strategy');
    }
  };

  const handleStrategyDelete = async (strategy: Strategy) => {
    if (strategy.status === 'active') {
      setActionError('Please pause or stop the strategy before deleting.');
      return;
    }

    if (!confirm(`Delete strategy "${strategy.name}"?`)) {
      return;
    }

    try {
      await deleteStrategy(strategy.id);
      if (currentStrategy?.id === strategy.id) {
        router.push('/dashboard/strategies/v2');
      }
      await loadStrategies();
    } catch (err: any) {
      console.error('Failed to delete strategy:', err);
      setActionError(err.response?.data?.detail || 'Failed to delete strategy');
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <div className="flex items-center justify-center h-screen">
          <div className="text-white">Loading strategies...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />
      {actionError && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
            {actionError}
          </div>
        </div>
      )}
      <ErrorBoundary>
        <StrategyV2Layout
          strategies={strategies}
          currentStrategy={currentStrategy}
          onStrategyChange={(strategy) => {
            console.log('[STRATEGY_V2] Strategy change requested:', {
              strategyId: strategy?.id,
              currentUrl: window.location.pathname,
              timestamp: new Date().toISOString()
            });
            
            if (strategy) {
              const newUrl = `/dashboard/strategies/v2/${strategy.id}`;
              // Only navigate if URL is different to prevent unnecessary re-renders
              if (window.location.pathname !== newUrl) {
                console.log('[STRATEGY_V2] Navigating to:', newUrl);
                router.push(newUrl);
              } else {
                console.log('[STRATEGY_V2] Already on this URL, skipping navigation');
              }
            } else {
              const newUrl = '/dashboard/strategies/v2';
              if (window.location.pathname !== newUrl) {
                console.log('[STRATEGY_V2] Navigating to new strategy:', newUrl);
                router.push(newUrl);
              }
            }
          }}
          onStrategiesUpdate={loadStrategies}
          onStrategyPlay={handleStrategyPlay}
          onStrategyPause={handleStrategyPause}
          onStrategyDelete={handleStrategyDelete}
        />
      </ErrorBoundary>
    </div>
  );
}

export default function StrategyV2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <StrategyV2PageContent />
    </Suspense>
  );
}
