# Firebase Authentication Setup Check

## 🔴 Error: 400 Bad Request from Firebase Auth

If you're seeing `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=... 400 (Bad Request)`, check these:

---

## ✅ Step 1: Enable Email/Password Authentication

**Most common cause!**

1. Go to: https://console.firebase.google.com/project/algo-ai-477010/authentication/providers
2. Click on **"Email/Password"** provider
3. Make sure **"Email/Password"** toggle is **ON** (first toggle)
4. Click **"Save"**

---

## ✅ Step 2: Check Password Requirements

Firebase requires passwords to be **at least 6 characters long**.

- ❌ Too short: `12345` (5 chars)
- ✅ Valid: `123456` (6+ chars)

---

## ✅ Step 3: Verify Email Format

Make sure the email is valid:
- ✅ Valid: `user@example.com`
- ❌ Invalid: `notanemail`, `user@`, `@example.com`

---

## ✅ Step 4: Check API Restrictions

1. Go to: https://console.firebase.google.com/project/algo-ai-477010/settings/general
2. Scroll to **"Your apps"** section
3. Make sure your web app is properly configured
4. Check if there are any API restrictions enabled

---

## 🔍 Debug Steps

1. **Check browser console** - The improved error handling will now show the actual Firebase error code
2. **Check Firebase Console** - Verify Email/Password is enabled
3. **Test with a simple email/password** - Use a valid email and password with 6+ characters

---

## 📝 Common Firebase Error Codes

- `auth/email-already-in-use` - Email is already registered
- `auth/invalid-email` - Invalid email format
- `auth/operation-not-allowed` - **Email/Password not enabled** ⚠️
- `auth/weak-password` - Password too weak (needs 6+ chars)
- `auth/network-request-failed` - Network error

---

## ✅ Quick Fix

**Most likely fix:**
👉 Enable Email/Password in Firebase Console:
https://console.firebase.google.com/project/algo-ai-477010/authentication/providers

Click "Email/Password" → Enable first toggle → Save

---

After enabling, try registering again!

