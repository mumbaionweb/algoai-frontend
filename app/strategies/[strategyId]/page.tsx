'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStrategies, getStrategy } from '@/lib/api/strategies';
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

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated && strategyId) {
      loadStrategies();
      loadCurrentStrategy();
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
    }
  };

  const loadCurrentStrategy = async () => {
    if (!strategyId) return;
    
    try {
      setLoading(true);
      setError(null);
      const strategy = await getStrategy(strategyId);
      setCurrentStrategy(strategy);
    } catch (err: any) {
      console.error('Failed to load strategy:', err);
      setError(err.response?.data?.detail || 'Strategy not found');
    } finally {
      setLoading(false);
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
      <ErrorBoundary>
        <StrategyV2Layout
          strategies={strategies}
          currentStrategy={currentStrategy}
          onStrategyChange={(strategy) => {
            if (strategy) {
              router.push(`/strategies/${strategy.id}`);
            } else {
              router.push('/dashboard/strategies');
            }
          }}
          onStrategiesUpdate={() => {
            loadStrategies();
            if (strategyId) {
              loadCurrentStrategy();
            }
          }}
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

