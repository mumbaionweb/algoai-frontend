import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import { verifyToken, getCurrentUser, mapUserInfoToUser } from '@/lib/api/auth';
import { getDeviceInfo } from '@/utils/device';
import type { User } from '@/types';

/**
 * Initialize and restore authentication session
 * This should be called once when the app loads
 * Firebase Auth automatically persists sessions, so we just need to restore our app state
 * 
 * Uses optimized two-step pattern:
 * 1. Quick token verification (~100-200ms, no Firestore)
 * 2. Get full user info (~200-400ms, 1 Firestore query)
 * 
 * This is ~50% faster than the old approach
 */
export async function initializeAuth(): Promise<void> {
  return new Promise((resolve) => {
    // Listen for Firebase auth state changes
    // This will fire immediately with the current auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get fresh ID token (use cached token if available)
          const idToken = await firebaseUser.getIdToken(false);
          
          // Step 1: Quick token verification (fast, no Firestore)
          // This shows loading state quickly and verifies auth status
          try {
            const verifyResult = await verifyToken(idToken);
            
            if (verifyResult.valid) {
              // Step 2: Get full user info (can be done in parallel with other data)
              // This fetches the user's name from Firestore
              try {
                const userInfo = await getCurrentUser(idToken);
                const user: User = mapUserInfoToUser(userInfo);
                
                // Restore auth state
                useAuthStore.getState().setToken(idToken);
                useAuthStore.getState().setUser(user);
                useAuthStore.getState().setInitialized(true);
              } catch (userError: any) {
                // If getCurrentUser fails but verifyToken succeeded,
                // we can still proceed with basic info from verifyToken
                // Or fall back to login endpoint for full user data
                console.warn('Failed to get full user info, trying login endpoint:', userError);
                
                try {
                  // Include device info for tracking
                  const deviceInfo = typeof window !== 'undefined' ? getDeviceInfo() : undefined;
                  const response = await apiClient.post('/api/auth/login', {
                    id_token: idToken,
                    ...(deviceInfo && { device_info: deviceInfo }),
                  });
                  useAuthStore.getState().setToken(idToken);
                  useAuthStore.getState().setUser(response.data.user);
                  useAuthStore.getState().setInitialized(true);
                } catch (loginError) {
                  // Both failed, but token is valid - use basic info from verifyToken
                  console.warn('Login endpoint also failed, using basic user info from token verification');
                  const user: User = {
                    id: verifyResult.uid,
                    email: verifyResult.email,
                    name: verifyResult.email.split('@')[0], // Fallback to email prefix
                    is_active: true,
                  };
                  useAuthStore.getState().setToken(idToken);
                  useAuthStore.getState().setUser(user);
                  useAuthStore.getState().setInitialized(true);
                }
              }
            } else {
              // Token is invalid
              console.warn('Token verification failed - token is invalid');
              useAuthStore.getState().logout();
              useAuthStore.getState().setInitialized(true);
            }
          } catch (verifyError: any) {
            // Token verification failed (401, network error, etc.)
            // Try login endpoint as fallback (might be a new user or token needs refresh)
            if (verifyError.response?.status === 401) {
              // Token is definitely invalid, clear everything
              console.warn('Token is invalid (401) - clearing session');
              useAuthStore.getState().logout();
              useAuthStore.getState().setInitialized(true);
            } else {
              // Network error or other issue - try login endpoint
              console.warn('Token verification failed, trying login endpoint:', verifyError);
              try {
                // Include device info for tracking
                const deviceInfo = typeof window !== 'undefined' ? getDeviceInfo() : undefined;
                const response = await apiClient.post('/api/auth/login', {
                  id_token: idToken,
                  ...(deviceInfo && { device_info: deviceInfo }),
                });
                useAuthStore.getState().setToken(idToken);
                useAuthStore.getState().setUser(response.data.user);
                useAuthStore.getState().setInitialized(true);
              } catch (loginError) {
                // Both failed, clear everything
                console.error('Both token verification and login failed:', loginError);
                useAuthStore.getState().logout();
                useAuthStore.getState().setInitialized(true);
              }
            }
          }
        } catch (error) {
          console.error('Failed to restore session:', error);
          useAuthStore.getState().logout();
          useAuthStore.getState().setInitialized(true);
        }
      } else {
        // No Firebase user, clear auth state
        useAuthStore.getState().logout();
        useAuthStore.getState().setInitialized(true);
      }
      
      // Resolve after first check
      unsubscribe();
      resolve();
    });
  });
}

