import { create } from 'zustand';
import { User } from '@/types';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => {
    set({ token });
    if (token) {
      localStorage.setItem('firebase_token', token);
    } else {
      localStorage.removeItem('firebase_token');
    }
  },
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  logout: async () => {
    // Sign out from Firebase
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out from Firebase:', error);
    }
    // Clear app state
    set({ user: null, token: null, isAuthenticated: false });
    localStorage.removeItem('firebase_token');
  },
}));

