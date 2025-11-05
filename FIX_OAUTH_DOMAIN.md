# Fix OAuth Domain Warning

## 🔧 Quick Fix

The warning says:
> The current domain is not authorized for OAuth operations. Add your domain (algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app) to the OAuth redirect domains list.

### Steps to Fix:

1. Go to [Firebase Console - Authentication Settings](https://console.firebase.google.com/project/algo-ai-477010/authentication/settings)
2. Click on **"Authorized domains"** tab
3. Click **"Add domain"**
4. Enter: `algoai-frontend--algo-ai-477010.asia-southeast1.hosted.app`
5. Click **"Add"**

**Note:** This only affects OAuth operations (Google Sign-In, Facebook, etc.). If you're only using email/password authentication, this warning won't affect functionality.

## 📝 Alternative: Also Add Root Domain

If you want to cover all subdomains, you can also add:
- `asia-southeast1.hosted.app` (if Firebase allows wildcards)

But the specific domain is usually sufficient.

