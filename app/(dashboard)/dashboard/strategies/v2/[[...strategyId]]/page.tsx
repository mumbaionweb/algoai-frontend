'use client';

import { useState, useEffect, Suspense } from 'react';
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

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadStrategies();
    }
  }, [isAuthenticated, isInitialized, router]);

  useEffect(() => {
    if (strategyId && strategies.length > 0) {
      const strategy = strategies.find(s => s.id === strategyId);
      setCurrentStrategy(strategy || null);
    } else if (!strategyId && strategies.length > 0) {
      // Default: create new strategy
      setCurrentStrategy(null);
    }
  }, [strategyId, strategies]);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      const response = await getStrategies({
        sort_by: 'updated_at',
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
            if (strategy) {
              router.push(`/dashboard/strategies/v2/${strategy.id}`);
            } else {
              router.push('/dashboard/strategies/v2');
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
