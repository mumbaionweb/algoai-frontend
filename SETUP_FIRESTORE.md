# 🔧 Fix: Firestore Database Not Initialized

## 🚨 Error Message

```
The database (default) does not exist for project algo-ai-477010
Please visit https://console.cloud.google.com/datastore/setup?project=algo-ai-477010
to add a Cloud Datastore or Cloud Firestore database.
```

## ✅ Solution: Initialize Firestore

Your backend needs Firestore to store user data and other information. Here's how to set it up:

### Option 1: Quick Setup (Recommended)

1. **Click the direct link:**
   👉 https://console.cloud.google.com/datastore/setup?project=algo-ai-477010

2. **Or navigate manually:**
   - Go to [Firebase Console](https://console.firebase.google.com/project/algo-ai-477010)
   - Click **"Firestore Database"** in the left sidebar
   - Click **"Create database"**

3. **Choose database mode:**
   - **Production mode** (recommended) - More secure, rules required
   - **Test mode** (for development) - Less secure, open access for 30 days

4. **Select location:**
   - Choose a region close to your users
   - For India: `asia-south1` (Mumbai) or `asia-southeast1` (Singapore)
   - Click **"Enable"**

5. **Wait for initialization:**
   - Takes 1-2 minutes
   - You'll see "Cloud Firestore is ready" when done

### Option 2: Via Firebase Console

1. Go to: https://console.firebase.google.com/project/algo-ai-477010/firestore
2. Click **"Create database"**
3. Follow the setup wizard
4. Choose production or test mode
5. Select location
6. Enable

## 📋 After Setup

Once Firestore is initialized:

1. **Test the login again** - The backend should now be able to:
   - Verify Firebase ID tokens
   - Create/update user records in Firestore
   - Return user data successfully

2. **Verify it's working:**
   - Go to [Firestore Console](https://console.firebase.google.com/project/algo-ai-477010/firestore)
   - You should see your database
   - After successful login, you'll see user documents created

## 🔒 Security Rules (Important!)

After creating Firestore, set up security rules:

### For Development/Testing:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### For Production:
You'll need more restrictive rules based on your data structure.

## 🎯 What This Fixes

After Firestore is initialized:
- ✅ Backend can verify Firebase ID tokens
- ✅ Backend can create user records in Firestore
- ✅ Backend can return user data
- ✅ Login will work successfully
- ✅ Registration will work successfully

## 📝 Quick Checklist

- [ ] Go to Firestore setup page
- [ ] Create database
- [ ] Choose production or test mode
- [ ] Select location (asia-south1 or asia-southeast1)
- [ ] Wait for initialization (1-2 minutes)
- [ ] Test login again
- [ ] Verify user data appears in Firestore console

## 🔗 Direct Links

- **Setup Firestore**: https://console.cloud.google.com/datastore/setup?project=algo-ai-477010
- **Firestore Console**: https://console.firebase.google.com/project/algo-ai-477010/firestore
- **Firebase Console**: https://console.firebase.google.com/project/algo-ai-477010

Once Firestore is initialized, your login should work! 🎉

