# Firebase App Hosting Setup

This project is configured for Firebase App Hosting, which provides native GitHub integration for automatic CI/CD.

## 🚀 What's Configured

- ✅ Firebase App Hosting configuration (`firebase.json`)
- ✅ Firebase project configuration (`.firebaserc`)
- ✅ Next.js configured for App Hosting (supports SSR)

## 📋 Setup Steps

### 1. Enable Firebase App Hosting

1. Go to [Firebase Console](https://console.firebase.google.com/project/algo-ai-477010/apphosting)
2. Click **"Get started"** or **"Create app"**
3. Follow the setup wizard

### 2. Connect GitHub Repository

1. In Firebase App Hosting, click **"Connect repository"**
2. Select your GitHub account
3. Choose the repository: `algoai-frontend`
4. Select the branch: `main`
5. Authorize Firebase to access your repository

### 3. Configure Build Settings

Firebase App Hosting will auto-detect Next.js, but you can configure:

- **Build command**: `npm run build`
- **Output directory**: `.next` (auto-detected for Next.js)
- **Node.js version**: 20 (configured in `firebase.json`)

### 4. Set Environment Variables

**⚠️ CRITICAL: This step is required!** Without these, your app will use dummy Firebase credentials and authentication will fail.

In Firebase App Hosting settings:

1. Go to your app in [Firebase App Hosting](https://console.firebase.google.com/project/algo-ai-477010/apphosting)
2. Click on **"algoai-frontend"**
3. Navigate to **"Environment variables"** or **"Settings"** tab
4. Click **"Add variable"** or **"Edit variables"**

Add these 7 environment variables:

1. **`NEXT_PUBLIC_API_URL`**
   - Value: `https://algoai-backend-sbqvzhslha-el.a.run.app` (or your backend URL)

2. **`NEXT_PUBLIC_FIREBASE_API_KEY`**
   - Get from: [Firebase Console → Project Settings](https://console.firebase.google.com/project/algo-ai-477010/settings/general) → Your apps → Web app → Copy `apiKey`

3. **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`**
   - Value: `algo-ai-477010.firebaseapp.com`
   - Get from: Firebase Console → Project Settings → Your apps → Web app → Copy `authDomain`

4. **`NEXT_PUBLIC_FIREBASE_PROJECT_ID`**
   - Value: `algo-ai-477010`
   - Get from: Firebase Console → Project Settings → Your apps → Web app → Copy `projectId`

5. **`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`**
   - Value: `algo-ai-477010.appspot.com`
   - Get from: Firebase Console → Project Settings → Your apps → Web app → Copy `storageBucket`

6. **`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`**
   - Get from: Firebase Console → Project Settings → Your apps → Web app → Copy `messagingSenderId`

7. **`NEXT_PUBLIC_FIREBASE_APP_ID`**
   - Get from: Firebase Console → Project Settings → Your apps → Web app → Copy `appId`

**Important:**
- Variable names must match exactly (including `NEXT_PUBLIC_` prefix)
- No quotes around values
- Copy values directly from Firebase Console
- Firebase will automatically redeploy after saving variables

👉 **See `FIX_FIREBASE_ENV_VARS.md` for detailed step-by-step instructions.**

### 5. Deploy

Once connected:
- Firebase App Hosting will automatically build and deploy on every push to `main`
- Preview deployments are created for pull requests
- You'll get deployment URLs automatically

## 🔄 How It Works

### Automatic Deployments:
- ✅ **On push to main**: Auto-deploys to production
- ✅ **On pull requests**: Creates preview deployments
- ✅ **Build logs**: Available in Firebase Console
- ✅ **Rollback**: One-click rollback to previous versions

### No Manual Steps Needed:
- No GitHub Actions to maintain
- No service account keys to manage
- No manual deployments
- Everything handled by Firebase

## 📝 Local Testing

To test locally before pushing:

```bash
# Run development server
npm run dev

# Build for production (to test build)
npm run build
npm start
```

## 🎯 Benefits of App Hosting

1. **Native GitHub Integration**: Just connect and push
2. **Full Next.js Support**: SSR, API routes, all features work
3. **Automatic Scaling**: Handles traffic automatically
4. **Preview Deployments**: Every PR gets a preview URL
5. **Built-in CI/CD**: No need for GitHub Actions
6. **Easy Rollbacks**: One-click rollback in console

## 🔍 Troubleshooting

### Build fails
- Check build logs in Firebase Console
- Verify environment variables are set
- Check that `package.json` has correct scripts

### Deployment not triggering
- Verify GitHub repository is connected
- Check that you're pushing to the correct branch
- Ensure Firebase App Hosting is enabled for the project

### Environment variables not working
- Make sure variables are set in App Hosting settings (not just `.env.local`)
- Variable names must match exactly (including `NEXT_PUBLIC_` prefix)

## 📚 Resources

- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Next.js on App Hosting](https://firebase.google.com/docs/app-hosting/nextjs)
- [Firebase Console](https://console.firebase.google.com/project/algo-ai-477010/apphosting)

## ✅ Quick Checklist

- [ ] Enable Firebase App Hosting in console
- [ ] Connect GitHub repository
- [ ] Set all environment variables
- [ ] Push to `main` branch
- [ ] Verify deployment in Firebase Console

That's it! Firebase App Hosting handles everything else automatically. 🎉

