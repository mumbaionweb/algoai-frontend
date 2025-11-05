# Firebase Setup for Frontend

## 🔥 Get Firebase Web Configuration

### Step 1: Go to Firebase Console

1. Open: https://console.firebase.google.com/
2. Select your project: **algo-ai-477010**

### Step 2: Get Web App Config

1. Click **⚙️ Project Settings** (gear icon, top left)
2. Scroll down to **"Your apps"** section
3. If you don't have a web app yet:
   - Click **"Add app"** → **Web** (</> icon)
   - Register app (nickname: "AlgoAI Web")
   - Click **Register app**
4. Copy the **config object** that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "algo-ai-477010.firebaseapp.com",
  projectId: "algo-ai-477010",
  storageBucket: "algo-ai-477010.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 3: Create .env.local File

1. **Create the file:**
   ```bash
   cd /Users/vishalnagadiya/algoai/algoai-frontend
   touch .env.local
   ```

2. **Add your Firebase config:**
   ```env
   # Backend API URL
   NEXT_PUBLIC_API_URL=http://localhost:8080

   # Firebase Configuration (from Firebase Console)
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=algo-ai-477010.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=algo-ai-477010
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=algo-ai-477010.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

3. **Replace the values** with your actual Firebase config values

### Step 4: Restart Development Server

After creating `.env.local`:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## ✅ Verification

1. **Check .env.local exists:**
   ```bash
   ls -la .env.local
   ```

2. **Verify values are set:**
   ```bash
   cat .env.local
   ```

3. **Restart server** and check if error is gone

---

## 🔍 Quick Reference

**Firebase Console:** https://console.firebase.google.com/  
**Project:** algo-ai-477010  
**Location:** Project Settings → Your apps → Web app

---

## ⚠️ Important Notes

- `.env.local` is in `.gitignore` (won't be committed)
- Never commit Firebase credentials to git
- Restart dev server after changing `.env.local`
- All `NEXT_PUBLIC_*` variables are exposed to browser (this is normal for Firebase)

