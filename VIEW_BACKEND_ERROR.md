# 🔍 How to View Backend Error Details

## Current Issue

You're seeing:
```javascript
❌ Backend error details: {status: 500, statusText: '', data: {…}}
```

The `data: {…}` means there's error data, but it's collapsed in the console.

## ✅ Solution: Expand the Error Object

### Method 1: In Browser Console

1. **Open the console** (F12)
2. **Find the log:** `❌ Backend error details: {status: 500, statusText: '', data: {…}}`
3. **Click on the `{…}`** or expand the object
4. **Look for:**
   - `detail` - Usually contains the error message
   - `message` - Error message
   - `error` - Error details
   - Any other fields

### Method 2: Log Full Data

Add this temporarily to see the full error:

In the browser console, after the error occurs, type:
```javascript
// This will show the last error object
console.log('Full error data:', error.response?.data)
```

Or expand the error object in the console by clicking on it.

### Method 3: Check Network Tab

1. Open **DevTools** → **Network** tab
2. Find the failed request: `POST /api/auth/login`
3. Click on it
4. Go to **Response** tab
5. You'll see the full error response from the backend

### Method 4: Use Enhanced Logging (After Deployment)

Once the new deployment completes, you'll automatically see:
- `📤 API Request:` - Full request details
- `📥 API Response (Error):` - Full error with `response.data` expanded
- `❌ Backend 500 Error - Full Details:` - Complete error analysis

## 🎯 What to Look For

The backend error `data` object usually contains:

**Common fields:**
- `detail` - Main error message
- `message` - Error description
- `error` - Error type/code
- `traceback` - Stack trace (if backend is in debug mode)

**Example:**
```json
{
  "detail": "Firebase Admin SDK not initialized",
  "message": "Internal server error",
  "error": "FIREBASE_ADMIN_ERROR"
}
```

## 📋 Next Steps

1. **Expand the `data: {…}` object** in console to see the actual error
2. **Check Network tab** → Response tab for full error
3. **Wait for new deployment** (if not complete) to see enhanced logs
4. **Use the error message** to fix the backend issue

The error message from the backend will tell you exactly what's wrong!

