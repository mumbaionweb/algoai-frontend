# Where to Find Firebase App ID

## 📍 Step-by-Step Guide

### Step 1: Open Firebase Console
👉 **Go to:** https://console.firebase.google.com/project/algo-ai-477010/settings/general

### Step 2: Scroll to "Your apps" Section
- Scroll down the page until you see **"Your apps"** section
- This is near the bottom of the Project Settings page

### Step 3: Find Your Web App
- Look for a web app icon: **</>** (angled brackets)
- If you see **"Add app"** button, click it and create a web app first
- If you already have a web app, click on it

### Step 4: View Config
Once you click on your web app, you'll see a code snippet like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU",
  authDomain: "algo-ai-477010.firebaseapp.com",
  projectId: "algo-ai-477010",
  storageBucket: "algo-ai-477010.appspot.com",
  messagingSenderId: "606435458040",
  appId: "1:606435458040:web:abc123def456"  👈 THIS IS THE APP ID!
};
```

### Step 5: Copy the App ID
- The `appId` is the value that looks like: `1:606435458040:web:XXXXX`
- Format: `1:SENDER_ID:web:UNIQUE_ID`
- Copy the entire value (including quotes if shown, but we'll use it without quotes)

---

## 🎯 Quick Visual Guide

1. **Project Settings** page
2. **Scroll down** to "Your apps"
3. **Click** the web app (</> icon)
4. **Look for** `appId` in the config code
5. **Copy** the value

---

## ⚡ Quick Link

**Direct link to Project Settings:**
https://console.firebase.google.com/project/algo-ai-477010/settings/general

Scroll down to "Your apps" → Click web app → Copy `appId`

---

## 💡 If You Don't Have a Web App Yet

1. Click **"Add app"** button
2. Click the **Web** icon (</>)
3. Enter app nickname: **"AlgoAI Web"** (or any name)
4. Click **"Register app"**
5. The config will appear immediately with all values including `appId`

