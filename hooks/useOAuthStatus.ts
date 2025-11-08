import { useState, useEffect } from 'react';
import { getOAuthStatus } from '@/lib/api/broker';
import type { OAuthStatus } from '@/types';

/**
 * React hook to check Zerodha OAuth status
 * 
 * @param credentialsId Optional credentials ID to check status for
 * @returns Object with status, loading, and error states
 * 
 * @example
 * ```tsx
 * const { status, loading, error } = useOAuthStatus(credentialsId);
 * 
 * if (loading) return <div>Checking OAuth status...</div>;
 * if (error) return <div>Error: {error}</div>;
 * if (status?.is_connected) {
 *   return <div>✅ Connected to Zerodha</div>;
 * }
 * ```
 */
export function useOAuthStatus(credentialsId?: string) {
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getOAuthStatus(credentialsId);
        setStatus(data);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || err.message || 'Failed to check OAuth status';
        setError(errorMessage);
        setStatus(null);
        console.error('Failed to fetch OAuth status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [credentialsId]);

  return { status, loading, error };
}

