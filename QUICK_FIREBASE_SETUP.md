# Quick Firebase Setup - Fix API Key Error

## 🔴 Problem
Your `.env.local` has placeholder values. You need real Firebase credentials.

## ✅ Solution (5 minutes)

### Step 1: Get Firebase Config
1. **Open:** https://console.firebase.google.com/project/algo-ai-477010/settings/general
2. **Scroll down** to "Your apps" section
3. **If no web app exists:**
   - Click **"Add app"** → **Web** (</> icon)
   - Nickname: "AlgoAI Web"
   - Click **"Register app"**
4. **Copy the config** that looks like:
   ```javascript
   apiKey: "AIzaSy...",
   authDomain: "algo-ai-477010.firebaseapp.com",
   projectId: "algo-ai-477010",
   storageBucket: "algo-ai-477010.appspot.com",
   messagingSenderId: "123456789012",
   appId: "1:123456789012:web:abcdef123456"
   ```

### Step 2: Update .env.local

**File location:** `/Users/vishalnagadiya/algoai/algoai-frontend/.env.local`

**Replace these lines:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**With your actual values (no quotes):**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...your-actual-key
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### Step 3: Restart Server

```bash
# Stop current server (Ctrl+C)
# Then:
cd /Users/vishalnagadiya/algoai/algoai-frontend
npm run dev
```

---

## 🔍 Verify It's Fixed

After updating and restarting:
1. Go to http://localhost:3000/register
2. Try registering - should work without API key error

---

## 📝 Quick Edit Command

You can edit the file directly:

```bash
cd /Users/vishalnagadiya/algoai/algoai-frontend
nano .env.local
# Or use your preferred editor
```

**Replace the placeholder values with real Firebase config values.**

---

## 🎯 Firebase Console Direct Link

👉 **Project Settings:** https://console.firebase.google.com/project/algo-ai-477010/settings/general

Scroll down to "Your apps" → Web app → Copy config

