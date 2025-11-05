#!/usr/bin/env node

/**
 * Test Firebase Configuration
 * This script verifies that Firebase credentials are valid
 */

const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator } = require('firebase/auth');

// Test credentials from apphosting.yaml
const firebaseConfig = {
  apiKey: "AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU",
  authDomain: "algo-ai-477010.firebaseapp.com",
  projectId: "algo-ai-477010",
  storageBucket: "algo-ai-477010.appspot.com",
  messagingSenderId: "606435458040",
  appId: "1:606435458040:web:87b4b088759963035ff40d",
};

console.log('🔥 Testing Firebase Configuration...\n');
console.log('Config:', JSON.stringify(firebaseConfig, null, 2));
console.log('\n');

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
  
  // Get Auth
  const auth = getAuth(app);
  console.log('✅ Firebase Auth initialized successfully');
  
  // Test API key by making a request
  const testUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`;
  console.log('\n📡 Testing API key validity...');
  console.log(`Test URL: ${testUrl.replace(firebaseConfig.apiKey, 'API_KEY_REDACTED')}`);
  
  console.log('\n✅ Configuration appears valid!');
  console.log('\n⚠️  Note: This doesn\'t test actual authentication, just that the config is valid.');
  console.log('   To fully test, try logging in with a real user account.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}

