'use client';

import { useEffect, useState } from 'react';
import { initializeAuth } from '@/lib/auth/session';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Initialize auth session on mount
    initializeAuth()
      .then(() => {
        setIsInitializing(false);
      })
      .catch((error) => {
        console.error('Failed to initialize auth:', error);
        setIsInitializing(false);
      });
  }, []);

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}

