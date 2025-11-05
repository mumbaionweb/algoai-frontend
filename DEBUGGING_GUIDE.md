# 🔍 Debugging Guide - Enhanced Logging

## Overview

We've added comprehensive debugging checkpoints throughout the API client and login flow to help diagnose issues.

## 📊 Debugging Checkpoints

### 1. **API Request Logging** (`lib/api/client.ts`)

Every API request now logs:
- ✅ **Method**: GET, POST, etc.
- ✅ **Full URL**: Complete endpoint URL
- ✅ **Base URL**: Backend base URL
- ✅ **Headers**: Content-Type, Authorization (masked)
- ✅ **Payload**: Request data (formatted JSON)
- ✅ **Token Info**: Whether token exists and its length

**Example Output:**
```javascript
📤 API Request: {
  method: 'POST',
  url: 'https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login',
  baseURL: 'https://algoai-backend-606435458040.asia-south1.run.app',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ***'
  },
  data: '{\n  "id_token": "eyJhbGc..."\n}',
  hasToken: true,
  tokenLength: 924
}
```

### 2. **API Response Logging**

**Success Response:**
```javascript
📥 API Response (Success): {
  status: 200,
  statusText: 'OK',
  url: 'https://...',
  data: {...},
  headers: {...}
}
```

**Error Response:**
```javascript
📥 API Response (Error): {
  request: {
    method: 'POST',
    url: 'https://...',
    baseURL: 'https://...',
    data: {...},
    headers: {...}
  },
  response: {
    status: 500,
    statusText: 'Internal Server Error',
    data: {...},
    headers: {...}
  },
  network: {
    code: 'ERR_BAD_RESPONSE',
    message: 'Request failed with status code 500'
  }
}
```

### 3. **500 Error Special Handling**

When a 500 error occurs, you'll see:
```javascript
❌ Backend 500 Error - Full Details: {
  status: 500,
  statusText: 'Internal Server Error',
  responseData: {...},        // Full error response from backend
  responseHeaders: {...},
  requestUrl: 'https://...',
  requestMethod: 'POST',
  requestData: {...},          // What was sent
  requestHeaders: {...},
  timestamp: '2024-...'
}
```

### 4. **Login Flow Debugging** (`app/(auth)/login/page.tsx`)

**Step-by-step logging:**

```
🔐 Step 1: Signing in with Firebase... { email: '...' }
✅ Step 1: Firebase sign-in successful { uid: '...' }

🔐 Step 2: Getting ID token...
✅ Step 2: ID token obtained { tokenLength: 924 }

🔐 Step 3: Preparing backend request...
📋 Step 3.1: Request details: {
  endpoint: '/api/auth/login',
  baseURL: 'https://...',
  fullUrl: 'https://.../api/auth/login',
  tokenLength: 924,
  tokenPreview: 'eyJhbGciOiJSUzI1Ni...',
  payload: { id_token: 'eyJhbGc...[REDACTED]...' }
}

📤 Step 3.2: Sending token to backend...
✅ Step 3.3: Backend response received: { ... }
```

### 5. **Enhanced Error Analysis**

For 500 errors, you'll see:
```javascript
🔍 Step 3 Debug - 500 Error Analysis: {
  backendUrl: 'https://...',
  requestPayload: { id_token: '...' },
  responseData: {...},
  possibleCauses: [
    'Backend server error - check backend logs',
    'Firebase Admin SDK not initialized',
    'Database connection issue',
    'Token verification failing',
    'Missing environment variables on backend'
  ]
}
```

## 🏥 Backend Health Check Utility

We've added a health check utility (`lib/api/healthCheck.ts`) that you can use to test backend connectivity:

```typescript
import { checkBackendHealth, checkAuthEndpoint } from '@/lib/api/healthCheck';

// Check if backend is reachable
const health = await checkBackendHealth();
console.log(health);

// Check if auth endpoint exists
const authCheck = await checkAuthEndpoint();
console.log(authCheck);
```

## 📋 What to Look For

### When Testing Login:

1. **Check Request Logs:**
   - ✅ Is the correct backend URL being used?
   - ✅ Is the token being sent in the payload?
   - ✅ Are headers correct?

2. **Check Response Logs:**
   - ✅ What status code is returned?
   - ✅ What's in the response data?
   - ✅ Are there any error messages from backend?

3. **For 500 Errors:**
   - ✅ Check `responseData` for backend error message
   - ✅ Review `possibleCauses` list
   - ✅ Verify backend logs match the error

## 🔧 Using the Debug Information

### Example: Diagnosing a 500 Error

1. **Look at the request:**
   ```javascript
   📤 API Request: {
     method: 'POST',
     url: 'https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login',
     data: { id_token: '...' }
   }
   ```
   ✅ Request looks correct

2. **Look at the response:**
   ```javascript
   ❌ Backend 500 Error - Full Details: {
     responseData: {
       detail: "Firebase Admin SDK not initialized"
     }
   }
   ```
   ❌ **Issue found:** Backend needs Firebase Admin SDK setup

3. **Take action:**
   - Check backend code
   - Verify Firebase Admin SDK initialization
   - Check backend environment variables

## 📝 Console Output Summary

When you test login now, you'll see:
1. ✅ Step 1-2: Firebase authentication logs
2. 📤 Step 3: API request details
3. 📥 Step 3: API response (success or error)
4. 🔍 If error: Detailed error analysis

All logs are prefixed with emojis for easy identification:
- 🔐 = Authentication step
- ✅ = Success
- ❌ = Error
- 📤 = Request
- 📥 = Response
- 🔍 = Debug analysis
- ⚠️ = Warning

## 🎯 Next Steps

After the deployment completes:
1. Test login again
2. Check the console for all the new debug logs
3. Look at the `responseData` field in 500 errors
4. Use that information to fix the backend issue

The enhanced logging will help pinpoint exactly where and why the backend is failing!

