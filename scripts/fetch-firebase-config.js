#!/usr/bin/env node

/**
 * Helper script to fetch Firebase web app config
 * This opens Firebase Console and helps you copy the config
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'algo-ai-477010';
const ENV_FILE = path.join(__dirname, '..', '.env.local');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔥 Firebase Config Updater\n');
  console.log('📋 Steps:');
  console.log('1. Firebase Console should open in your browser');
  console.log('2. Scroll to "Your apps" section');
  console.log('3. If no web app exists, click "Add app" → Web (</> icon)');
  console.log('4. Copy the config values from the code snippet\n');
  
  const url = `https://console.firebase.google.com/project/${PROJECT_ID}/settings/general`;
  console.log(`👉 Opening: ${url}\n`);
  
  // Try to open browser (macOS)
  require('child_process').exec(`open "${url}"`);
  
  await question('Press Enter after you have the Firebase config values...\n');
  
  console.log('\n📝 Enter the Firebase config values:\n');
  
  const apiKey = await question('API Key (starts with AIzaSy...): ');
  const authDomain = await question(`Auth Domain [${PROJECT_ID}.firebaseapp.com]: `) || `${PROJECT_ID}.firebaseapp.com`;
  const projectId = await question(`Project ID [${PROJECT_ID}]: `) || PROJECT_ID;
  const storageBucket = await question(`Storage Bucket [${PROJECT_ID}.appspot.com]: `) || `${PROJECT_ID}.appspot.com`;
  const messagingSenderId = await question('Messaging Sender ID (numbers only): ');
  const appId = await question('App ID (format: 1:123456789012:web:abc123): ');
  
  if (!apiKey || !messagingSenderId || !appId) {
    console.error('\n❌ Error: API Key, Sender ID, and App ID are required!');
    process.exit(1);
  }
  
  // Read current .env.local
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf8');
  }
  
  // Update Firebase config values
  envContent = envContent.replace(
    /NEXT_PUBLIC_FIREBASE_API_KEY=.*/g,
    `NEXT_PUBLIC_FIREBASE_API_KEY=${apiKey}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=.*/g,
    `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${authDomain}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_FIREBASE_PROJECT_ID=.*/g,
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${projectId}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=.*/g,
    `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${storageBucket}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=.*/g,
    `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_FIREBASE_APP_ID=.*/g,
    `NEXT_PUBLIC_FIREBASE_APP_ID=${appId}`
  );
  
  // Write back to file
  fs.writeFileSync(ENV_FILE, envContent);
  
  console.log('\n✅ Successfully updated .env.local!');
  console.log('\n📝 Updated values:');
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`   Auth Domain: ${authDomain}`);
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Storage Bucket: ${storageBucket}`);
  console.log(`   Sender ID: ${messagingSenderId}`);
  console.log(`   App ID: ${appId}`);
  console.log('\n⚠️  Don\'t forget to restart your dev server:');
  console.log('   npm run dev\n');
  
  rl.close();
}

main().catch(console.error);

