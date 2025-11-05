# Get Firebase Web Configuration - Step by Step

## 🎯 Quick Steps

### 1. Open Firebase Console
👉 https://console.firebase.google.com/

### 2. Select Your Project
- Click on project: **algo-ai-477010**

### 3. Go to Project Settings
- Click **⚙️** (gear icon) in top left
- Select **"Project settings"**

### 4. Add Web App (if not already added)
- Scroll down to **"Your apps"** section
- If you see a web app already, skip to step 5
- If not:
  - Click **"Add app"** button
  - Click **Web** icon (</>)
  - App nickname: **"AlgoAI Web"**
  - Click **"Register app"**

### 5. Copy the Config
You'll see a code block like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "algo-ai-477010.firebaseapp.com",
  projectId: "algo-ai-477010",
  storageBucket: "algo-ai-477010.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

### 6. Update .env.local File

Open `/Users/vishalnagadiya/algoai/algoai-frontend/.env.local` and replace the values:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080

# Copy these EXACTLY from Firebase Console
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...your-actual-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=algo-ai-477010.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=algo-ai-477010
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=algo-ai-477010.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

**Important:** 
- Copy the values EXACTLY as shown
- Don't include quotes
- Don't include `const firebaseConfig = {` or `};`

### 7. Restart Dev Server

After updating `.env.local`:

```bash
# Stop the server (Ctrl+C)
# Then restart:
cd /Users/vishalnagadiya/algoai/algoai-frontend
npm run dev
```

---

## 🔍 Quick Check

After updating, verify your `.env.local`:

```bash
cat .env.local | grep FIREBASE
```

You should see real values (not "your-firebase-api-key" or "your-sender-id").

---

## ⚠️ Common Mistakes

- ❌ Using placeholder values
- ❌ Including quotes around values
- ❌ Not restarting the server after changes
- ❌ Missing the `NEXT_PUBLIC_` prefix

---

## ✅ Once Configured

After setting up Firebase credentials:
- ✅ Registration will work
- ✅ Login will work
- ✅ Password reset will work
- ✅ All authentication features will function

