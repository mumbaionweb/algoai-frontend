'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getStrategies } from '@/lib/api/strategies';
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
      const response = await getStrategies();
      setStrategies(response.strategies);
    } catch (err: any) {
      console.error('Failed to load strategies:', err);
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
          <div className="text-white">Loading strategies...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />
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
      />
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

