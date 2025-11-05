# ✅ Verify Firebase App Hosting Environment Variables

## 🔍 How to Check if Variables Are Being Used

The error shows `YOUR_FIREBASE_API_KEY_HERE` is still in the deployed code. Here's how to verify and fix:

### Step 1: Verify GitHub Repository Has Correct Values

Check what's in your GitHub repository:

```bash
# The file should show your actual API key, not placeholders
git show origin/main:apphosting.yaml | grep "NEXT_PUBLIC_FIREBASE_API_KEY" -A 1
```

### Step 2: Check Firebase App Hosting Build Logs

1. Go to: https://console.firebase.google.com/project/algo-ai-477010/apphosting
2. Click on **algoai-frontend**
3. Click on the **latest deployment**
4. Click **"View build logs"** or **"Build details"**
5. Look for:
   - Environment variables being set
   - Any errors about `apphosting.yaml`
   - The build command output

### Step 3: Check the Deployed JavaScript Bundle

1. Visit: https://algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app/
2. Open DevTools (F12)
3. Go to **Network** tab → Reload page
4. Find a `.js` file (like `_app-*.js` or similar)
5. Click it → View **Response** tab
6. Search for: `NEXT_PUBLIC_FIREBASE_API_KEY` or `AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU`
   - ✅ If you see your actual API key → Variables are working!
   - ❌ If you see `YOUR_FIREBASE_API_KEY_HERE` → Variables not loaded

### Step 4: Check Network Requests

In browser console, look at network requests:
- Open Network tab
- Filter by "identitytoolkit"
- Check the request URL
- Look at the `key=` parameter
  - ✅ Should show: `key=AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU`
  - ❌ Currently shows: `key=YOUR_FIREBASE_API_KEY_HERE`

## 🔧 Possible Issues & Solutions

### Issue 1: Deployment Using Old Build

**Solution:**
- Wait for the latest commit to trigger a new deployment
- Check Firebase Console → App Hosting → Deployments
- Ensure latest deployment shows your recent commit hash

### Issue 2: apphosting.yaml Not Being Read

**Solution:**
- Verify `apphosting.yaml` is in the root directory
- Check YAML syntax is correct (indentation matters!)
- Ensure file is committed to the `main` branch

### Issue 3: Variables Not Available at Build Time

**Solution:**
- Check that `availability: [BUILD, RUNTIME]` is set
- For Next.js, `NEXT_PUBLIC_*` variables must be available at BUILD time
- They get embedded in the JavaScript bundle during build

### Issue 4: Cached Build

**Solution:**
- Firebase App Hosting might be using cached builds
- Try making a small change to trigger a fresh build:
  ```bash
  # Add a comment to trigger rebuild
  echo "# Updated: $(date)" >> apphosting.yaml
  git add apphosting.yaml
  git commit -m "Trigger rebuild with updated env vars"
  git push origin main
  ```

## ✅ Test Your Credentials

I've created a test script to verify your Firebase credentials are valid:

```bash
node scripts/test-firebase-config.js
```

This will verify:
- ✅ Firebase config is valid
- ✅ API key format is correct
- ✅ All required fields are present

## 📊 Expected Behavior After Fix

**Before (Current Error):**
```
❌ key=YOUR_FIREBASE_API_KEY_HERE
❌ Error: API key not valid
❌ Authentication fails
```

**After (Should Work):**
```
✅ key=AIzaSyC36jQd1MSvFmhOj0XDNpSw0xnLaRSONbU
✅ No errors
✅ Authentication works
```

## 🚀 Next Steps

1. **Verify the latest deployment** in Firebase Console
2. **Check build logs** to see if environment variables are being read
3. **Wait 2-5 minutes** for the new deployment to complete
4. **Hard refresh** your browser (Ctrl+Shift+R)
5. **Test authentication** again

If it still doesn't work after a fresh deployment, the issue might be:
- Firebase App Hosting configuration
- Build process not reading `apphosting.yaml`
- YAML syntax error

Let me know what you find in the build logs!

