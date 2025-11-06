import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

/**
 * Initialize and restore authentication session
 * This should be called once when the app loads
 * Firebase Auth automatically persists sessions, so we just need to restore our app state
 */
export async function initializeAuth(): Promise<void> {
  return new Promise((resolve) => {
    // Listen for Firebase auth state changes
    // This will fire immediately with the current auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get fresh ID token
          const idToken = await firebaseUser.getIdToken(false);
          
          // Verify token with backend and get user data
          try {
            const response = await apiClient.get('/api/auth/me');
            const user: User = response.data;
            
            // Restore auth state
            useAuthStore.getState().setToken(idToken);
            useAuthStore.getState().setUser(user);
            useAuthStore.getState().setInitialized(true);
          } catch (error) {
            // Token might be invalid, try login endpoint to refresh
            try {
              const response = await apiClient.post('/api/auth/login', {
                id_token: idToken,
              });
              useAuthStore.getState().setToken(idToken);
              useAuthStore.getState().setUser(response.data.user);
              useAuthStore.getState().setInitialized(true);
            } catch (loginError) {
              // Token is invalid, clear everything
              console.warn('Session expired or invalid');
              useAuthStore.getState().logout();
              useAuthStore.getState().setInitialized(true);
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

