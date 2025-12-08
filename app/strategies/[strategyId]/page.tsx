'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStrategies, getStrategy, startStrategy, pauseStrategy, resumeStrategy, deleteStrategy } from '@/lib/api/strategies';
import type { Strategy } from '@/types';
import StrategyV2Layout from '@/components/strategy-v2/StrategyV2Layout';

function StrategyPageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const strategyId = params?.strategyId as string | undefined;
  
  const [loading, setLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currentStrategy, setCurrentStrategy] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>('');

  useEffect(() => {
    // Redirect old route to new v2 route
    if (strategyId) {
      console.log('[STRATEGY_OLD] Redirecting from old route to v2 route:', strategyId);
      router.replace(`/dashboard/strategies/v2/${strategyId}`);
      return;
    }
    
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated && strategyId) {
      loadStrategies();
      loadCurrentStrategy(strategyId);
    }
  }, [isAuthenticated, isInitialized, router, strategyId]);

  const loadStrategies = async () => {
    try {
      const response = await getStrategies({
        sort_by: 'updated_at',
        order: 'desc',
        limit: 100
      });
      setStrategies(response.strategies);
    } catch (err: any) {
      console.error('Failed to load strategies:', err);
      setActionError(err.response?.data?.detail || 'Failed to load strategies');
    }
  };

  const loadCurrentStrategy = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const strategy = await getStrategy(id);
      setCurrentStrategy(strategy);
      setActionError('');
    } catch (err: any) {
      console.error('Failed to load strategy:', err);
      setError(err.response?.data?.detail || 'Strategy not found');
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
      if (strategyId) {
        await loadCurrentStrategy(strategyId);
      }
    } catch (err: any) {
      console.error('Failed to start/resume strategy:', err);
      setActionError(err.response?.data?.detail || 'Failed to start strategy');
    }
  };

  const handleStrategyPause = async (strategy: Strategy) => {
    try {
      await pauseStrategy(strategy.id);
      await loadStrategies();
      if (strategyId) {
        await loadCurrentStrategy(strategyId);
      }
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
      await loadStrategies();
      router.push('/dashboard/strategies/v2');
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
          <div className="text-white">Loading strategy...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard/strategies')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Go to Strategies
            </button>
          </div>
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
            console.log('[STRATEGY_OLD] Strategy change requested:', {
              strategyId: strategy?.id,
              currentUrl: window.location.pathname,
              timestamp: new Date().toISOString()
            });
            
            if (strategy) {
              // Redirect to the correct v2 route instead of old route
              const newUrl = `/dashboard/strategies/v2/${strategy.id}`;
              console.log('[STRATEGY_OLD] Redirecting to v2 route:', newUrl);
              router.push(newUrl);
            } else {
              router.push('/dashboard/strategies/v2');
            }
          }}
          onStrategiesUpdate={() => {
            loadStrategies();
            if (strategyId) {
              loadCurrentStrategy(strategyId);
            }
          }}
          onStrategyPlay={handleStrategyPlay}
          onStrategyPause={handleStrategyPause}
          onStrategyDelete={handleStrategyDelete}
        />
      </ErrorBoundary>
    </div>
  );
}

export default function StrategyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <StrategyPageContent />
    </Suspense>
  );
}
