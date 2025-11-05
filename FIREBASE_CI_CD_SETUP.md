# Firebase CI/CD Setup Guide (DEPRECATED)

⚠️ **This guide is for Firebase Hosting with GitHub Actions.**

**We're now using Firebase App Hosting instead**, which has native GitHub integration.

👉 **See `FIREBASE_APP_HOSTING_SETUP.md` for the current setup guide.**

---

## Old Setup (Not Used)

## 🚀 What's Configured

- ✅ GitHub Actions workflow (`.github/workflows/firebase-deploy.yml`)
- ✅ Firebase Hosting configuration (`firebase.json`)
- ✅ Firebase project configuration (`.firebaserc`)
- ✅ Next.js static export configuration

## 📋 Setup Steps

### 1. Generate Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/project/algo-ai-477010/settings/serviceaccounts/adminsdk)
2. Click **"Generate new private key"**
3. Save the JSON file (you'll need this for GitHub secrets)

### 2. Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

#### Required Secrets:

1. **`FIREBASE_SERVICE_ACCOUNT`**
   - Value: The entire contents of the JSON file from step 1
   - Example format:
     ```json
     {
       "type": "service_account",
       "project_id": "algo-ai-477010",
       ...
     }
     ```

2. **`NEXT_PUBLIC_FIREBASE_API_KEY`**
   - Get from: Firebase Console → Project Settings → Your apps → Web app
   - Value: Your Firebase API key

3. **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`**
   - Value: `algo-ai-477010.firebaseapp.com`

4. **`NEXT_PUBLIC_FIREBASE_PROJECT_ID`**
   - Value: `algo-ai-477010`

5. **`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`**
   - Value: `algo-ai-477010.appspot.com`

6. **`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`**
   - Get from: Firebase Console → Project Settings → Your apps → Web app

7. **`NEXT_PUBLIC_FIREBASE_APP_ID`**
   - Get from: Firebase Console → Project Settings → Your apps → Web app

#### Optional Secrets:

8. **`NEXT_PUBLIC_API_URL`** (optional)
   - Default: `https://algoai-backend-sbqvzhslha-el.a.run.app`
   - Only add if you want to override the backend URL

### 3. Verify Firebase Hosting is Enabled

1. Go to [Firebase Console](https://console.firebase.google.com/project/algo-ai-477010/hosting)
2. If hosting is not enabled, click **"Get started"**
3. Follow the setup wizard (you can skip since we're using GitHub Actions)

### 4. Test the Workflow

1. Push your code to the `main` branch
2. Go to **Actions** tab in GitHub
3. Watch the workflow run
4. Once complete, your site will be live at:
   - `https://algo-ai-477010.web.app`
   - `https://algo-ai-477010.firebaseapp.com`

## 🔄 How It Works

### On Push to Main:
- ✅ Installs dependencies
- ✅ Runs linter
- ✅ Builds Next.js app (creates static export in `out/` folder)
- ✅ Deploys to Firebase Hosting (live channel)

### On Pull Requests:
- ✅ Same build process
- ✅ Creates preview deployment
- ✅ Preview URL will be commented on the PR

## 📝 Local Testing

To test the build locally before pushing:

```bash
# Build the static export
npm run build

# The output will be in the `out/` directory
# You can preview it with a local server:
npx serve out
```

## ⚠️ Important Notes

1. **Static Export**: This setup uses Next.js static export, which means:
   - No server-side rendering
   - No API routes
   - All pages are pre-rendered at build time

2. **Environment Variables**: All `NEXT_PUBLIC_*` variables must be set as GitHub secrets for the build to work.

3. **Firebase CLI**: The workflow uses the Firebase GitHub Action, so you don't need to install Firebase CLI locally unless you want to test deployments manually.

## 🐛 Troubleshooting

### Build fails with "Missing environment variables"
- Make sure all `NEXT_PUBLIC_*` secrets are set in GitHub

### Deployment fails with "Permission denied"
- Check that `FIREBASE_SERVICE_ACCOUNT` secret contains the full JSON
- Verify the service account has Firebase Hosting permissions

### Preview channels not working
- Make sure `GITHUB_TOKEN` has write permissions (it's usually automatic)

## 📚 Resources

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [GitHub Actions for Firebase](https://github.com/FirebaseExtended/action-hosting-deploy)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

