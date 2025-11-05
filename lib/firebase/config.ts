import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase is already initialized
let app;
if (getApps().length === 0) {
  // Validate config before initializing
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your-firebase-api-key') {
    console.warn('Firebase config not found. Please set up .env.local with Firebase credentials.');
    // Create a dummy app to prevent errors (won't work for auth, but prevents crash)
    app = initializeApp({
      apiKey: 'dummy-key',
      authDomain: 'dummy.firebaseapp.com',
      projectId: 'dummy',
      storageBucket: 'dummy.appspot.com',
      messagingSenderId: '123456789',
      appId: 'dummy',
    });
  } else {
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApps()[0];
}

// Initialize Auth with optimized settings
export const auth = getAuth(app);

// Optimize auth settings for faster login
// Disable unnecessary features that might cause extra API calls
if (typeof window !== 'undefined') {
  // Set language code (optional, but helps reduce locale detection calls)
  auth.languageCode = 'en';
}

export default app;

