# 🔧 Fix Firebase Environment Variables in App Hosting

Your app is deployed but missing Firebase credentials. Follow these steps to fix it.

## 🚨 Current Issue

The deployed app at https://algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app/ is using dummy Firebase credentials, causing authentication to fail.

## ✅ Solution: Add Environment Variables

### Step 1: Get Firebase Config Values

1. Go to [Firebase Console - Project Settings](https://console.firebase.google.com/project/algo-ai-477010/settings/general)
2. Scroll down to **"Your apps"** section
3. Click on your web app (or create one if needed)
4. Copy these values from the config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",              // ← Copy this
  authDomain: "algo-ai-477010.firebaseapp.com",  // ← Copy this
  projectId: "algo-ai-477010",        // ← Copy this
  storageBucket: "algo-ai-477010.appspot.com",    // ← Copy this
  messagingSenderId: "123456789012",  // ← Copy this
  appId: "1:123456789012:web:abc123"  // ← Copy this
};
```

### Step 2: Add Environment Variables in Firebase App Hosting

1. Go to [Firebase App Hosting](https://console.firebase.google.com/project/algo-ai-477010/apphosting)
2. Click on your app: **algoai-frontend**
3. Go to **"Environment variables"** or **"Settings"** tab
4. Click **"Add variable"** or **"Edit variables"**

### Step 3: Add Each Variable

Add these 7 environment variables one by one:

| Variable Name | Value from Firebase Console |
|--------------|------------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` value (e.g., `AIzaSyC...`) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` value (e.g., `algo-ai-477010.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` value (e.g., `algo-ai-477010`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` value (e.g., `algo-ai-477010.appspot.com`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` value (e.g., `123456789012`) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` value (e.g., `1:123456789012:web:abc123`) |

**Also add:**
| `NEXT_PUBLIC_API_URL` | `https://algoai-backend-sbqvzhslha-el.a.run.app` (or your backend URL) |

### Step 4: Save and Redeploy

1. **Save** all environment variables
2. Firebase App Hosting will **automatically trigger a new deployment**
3. Wait for the deployment to complete (check the deployment status)
4. Once deployed, refresh your app URL

## 🔍 Quick Verification

After adding the variables and redeploying:

1. Visit: https://algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app/
2. Open browser console (F12)
3. You should **NOT** see: `Firebase config not found`
4. Try logging in - it should work now!

## 📋 Example Values

Here's what your environment variables should look like (replace with your actual values):

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=algo-ai-477010.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=algo-ai-477010
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=algo-ai-477010.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=606435458040
NEXT_PUBLIC_FIREBASE_APP_ID=1:606435458040:web:your-app-id-here
NEXT_PUBLIC_API_URL=https://algoai-backend-sbqvzhslha-el.a.run.app
```

## ⚠️ Important Notes

1. **Variable names must match exactly** - including `NEXT_PUBLIC_` prefix
2. **No quotes** - Don't wrap values in quotes
3. **No spaces** - Remove any spaces around the `=` sign
4. **Redeploy required** - Changes take effect after redeployment

## 🔗 Direct Links

- **Firebase Console (Project Settings)**: https://console.firebase.google.com/project/algo-ai-477010/settings/general
- **Firebase App Hosting**: https://console.firebase.google.com/project/algo-ai-477010/apphosting
- **Your Deployed App**: https://algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app/

## 🆘 Still Having Issues?

If you still see errors after adding variables:

1. **Check deployment logs** in Firebase App Hosting
2. **Verify variable names** are exactly as shown above
3. **Ensure values are correct** - copy directly from Firebase Console
4. **Wait for deployment** to complete before testing

