# 🔧 Update Firebase App Hosting Configuration

Your Firebase App Hosting is configured to use `apphosting.yaml` for environment variables. You need to update it with your actual Firebase credentials.

## 📋 Steps to Update

### Step 1: Get Your Firebase Config Values

1. Go to [Firebase Console - Project Settings](https://console.firebase.google.com/project/algo-ai-477010/settings/general)
2. Scroll down to **"Your apps"** section
3. Click on your web app (or create one if needed)
4. Copy these values from the config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",              // ← Copy this
  authDomain: "algo-ai-477010.firebaseapp.com",  // ← Already set
  projectId: "algo-ai-477010",        // ← Already set
  storageBucket: "algo-ai-477010.appspot.com",    // ← Already set
  messagingSenderId: "123456789012",  // ← Copy this
  appId: "1:123456789012:web:abc123"  // ← Copy this
};
```

### Step 2: Update `apphosting.yaml`

Open `apphosting.yaml` in your project root and replace these placeholders:

1. **`YOUR_FIREBASE_API_KEY_HERE`** → Replace with your `apiKey` value
2. **`YOUR_MESSAGING_SENDER_ID_HERE`** → Replace with your `messagingSenderId` value  
3. **`YOUR_FIREBASE_APP_ID_HERE`** → Replace with your `appId` value

### Step 3: Example After Update

Your `apphosting.yaml` should look like this (with your actual values):

```yaml
env:
  - variable: NEXT_PUBLIC_API_URL
    value: https://algoai-backend-sbqvzhslha-el.a.run.app

  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU  # Your actual API key

  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: algo-ai-477010.firebaseapp.com

  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: algo-ai-477010

  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: algo-ai-477010.appspot.com

  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: 606435458040  # Your actual sender ID

  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: 1:606435458040:web:your-actual-app-id  # Your actual app ID
```

### Step 4: Commit and Push

```bash
git add apphosting.yaml
git commit -m "Add Firebase config to apphosting.yaml"
git push origin main
```

Firebase App Hosting will automatically:
1. Detect the changes
2. Start a new build
3. Use the environment variables from `apphosting.yaml`
4. Deploy the updated app

## ✅ Verification

After pushing:
1. Wait for the deployment to complete (check Firebase Console)
2. Visit: https://algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app/
3. Open browser console (F12)
4. You should **NOT** see: `Firebase config not found`
5. Try logging in - it should work now!

## 🔒 Security Note

These are `NEXT_PUBLIC_*` variables, which means they're embedded in the client-side bundle. This is safe for Firebase API keys because:
- Firebase API keys are meant to be public
- They're restricted by domain/hostname in Firebase Console
- They can only be used with your Firebase project

## 📚 Resources

- **Firebase Console**: https://console.firebase.google.com/project/algo-ai-477010/settings/general
- **Firebase App Hosting Docs**: https://firebase.google.com/docs/app-hosting/configure

