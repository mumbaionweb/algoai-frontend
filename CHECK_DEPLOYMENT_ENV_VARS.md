# How to Check if Firebase App Hosting Used Environment Variables

## 🔍 Methods to Verify Environment Variables Are Being Used

### Method 1: Check Build Logs in Firebase Console

1. Go to [Firebase App Hosting](https://console.firebase.google.com/project/algo-ai-477010/apphosting)
2. Click on your app: **algoai-frontend**
3. Click on the latest deployment
4. Click **"View build logs"** or **"Build details"**
5. Look for environment variables being set during build
6. Search for `NEXT_PUBLIC_FIREBASE` in the logs

### Method 2: Check the Built JavaScript Bundle

1. Visit your deployed app: https://algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app/
2. Open browser DevTools (F12)
3. Go to **Network** tab
4. Reload the page
5. Find a JavaScript file (like `_app.js` or similar)
6. Click on it and view the **Response** tab
7. Search for `NEXT_PUBLIC_FIREBASE_API_KEY` or your actual API key
8. If you see your actual API key (not `YOUR_FIREBASE_API_KEY_HERE`), it's working!

### Method 3: Check Browser Console

1. Visit your deployed app
2. Open browser console (F12 → Console)
3. Type: `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` (won't work in browser)
4. Instead, check the network requests:
   - Look for requests to `identitytoolkit.googleapis.com`
   - Check the `key=` parameter in the URL
   - If it shows `YOUR_FIREBASE_API_KEY_HERE` → Variables not loaded
   - If it shows your actual API key → Variables loaded correctly

### Method 4: Add Debug Logging (Temporary)

Add this to your code temporarily to see what values are being used:

```typescript
// In lib/firebase/config.ts or any component
console.log('Firebase API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) + '...');
console.log('Firebase Config:', {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) + '...',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
```

Then check the browser console after deployment.

### Method 5: Check apphosting.yaml in GitHub

1. Go to your GitHub repository
2. Check the `apphosting.yaml` file in the `main` branch
3. Verify the values are correct (not placeholders)
4. If placeholders are still there, the deployment is using old values

## ✅ Expected Behavior

**If environment variables are working:**
- ✅ No error: `Firebase config not found`
- ✅ No error: `API key not valid`
- ✅ Authentication works (login/register)
- ✅ Network requests show your actual API key (not placeholders)

**If environment variables are NOT working:**
- ❌ Error: `Firebase config not found`
- ❌ Error: `API key not valid. Please pass a valid API key`
- ❌ Network requests show `YOUR_FIREBASE_API_KEY_HERE`
- ❌ Authentication fails

## 🔧 Troubleshooting

### Issue: Still seeing placeholder values

**Solution:**
1. Verify `apphosting.yaml` is committed to GitHub with correct values
2. Check that the latest deployment completed successfully
3. Wait for the new deployment to finish (can take 2-5 minutes)
4. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: Variables not available at build time

**Solution:**
- Ensure `availability: [BUILD, RUNTIME]` is set in `apphosting.yaml`
- Check build logs for any errors
- Verify the YAML syntax is correct (indentation matters!)

### Issue: Variables not available at runtime

**Solution:**
- For `NEXT_PUBLIC_*` variables, they must be available at BUILD time
- Next.js embeds these in the client-side bundle during build
- If missing at build, they won't be available at runtime

## 📝 Quick Test Script

You can add this temporary test to verify values are being read:

```typescript
// Add to any page component temporarily
useEffect(() => {
  console.log('=== Firebase Env Check ===');
  console.log('API Key:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 15) + '...');
  console.log('Has API Key:', !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  console.log('Is Placeholder:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.includes('YOUR_FIREBASE'));
}, []);
```

Then check the browser console after deployment.

