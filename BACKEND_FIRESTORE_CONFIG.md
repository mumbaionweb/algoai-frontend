# 🔧 Backend Firestore Database Configuration

## ✅ Verified Database Name

**Firebase CLI Verification:**
```bash
$ firebase firestore:databases:list
┌─────────────────────────────────────────────┐
│ Database Name                               │
├─────────────────────────────────────────────┤
│ projects/algo-ai-477010/databases/algoai    │
└─────────────────────────────────────────────┘
```

**Your Firestore database name is: `algoai`**

## 🚨 The Problem

The backend error shows:
```
The database (default) does not exist for project algo-ai-477010
```

**Root Cause:** The backend is trying to connect to the **"default"** database, but your actual database is named **"algoai"**.

## 🔧 Backend Configuration Fix

The backend needs to be configured to use the `algoai` database. Here's what needs to be changed:

### For Python/FastAPI Backend:

**Before (incorrect):**
```python
import firebase_admin
from firebase_admin import firestore

# This tries to use "default" database
db = firestore.client()
```

**After (correct):**
```python
import firebase_admin
from firebase_admin import firestore

# Explicitly specify the database name
db = firestore.client(database='algoai')
```

### For Node.js Backend:

**Before (incorrect):**
```javascript
const admin = require('firebase-admin');
const db = admin.firestore(); // Uses "default"
```

**After (correct):**
```javascript
const admin = require('firebase-admin');
const db = admin.firestore().database('algoai');
```

### Alternative: Initialize with Database Name

```python
# Python
firebase_admin.initialize_app(options={
    'databaseURL': 'https://algo-ai-477010.firebaseio.com',
    'databaseId': 'algoai'
})

db = firestore.client(database='algoai')
```

## 📋 Steps to Fix Backend

1. **Find where Firestore is initialized in your backend code**
2. **Change from `firestore.client()` to `firestore.client(database='algoai')`**
3. **Or update Firebase Admin SDK initialization to specify database name**
4. **Redeploy the backend**
5. **Test login again**

## 🔍 How to Find Backend Code

Look for files like:
- `main.py` or `app.py` (FastAPI)
- `index.js` or `server.js` (Node.js)
- Files with `firestore.client()` or `admin.firestore()`
- Firebase Admin SDK initialization code

## ✅ After Fix

Once the backend is configured to use the `algoai` database:
- ✅ Backend can connect to Firestore
- ✅ User records can be created/updated
- ✅ Login will work successfully
- ✅ The 500 error will be resolved

## 📝 Verification

After fixing, verify the backend can connect:
```python
# Test connection
db = firestore.client(database='algoai')
users_ref = db.collection('users')
print(f"Connected to database: algoai")
```

## 🔗 Related Files

- Frontend is working correctly ✅
- Issue is in backend Firestore configuration ❌
- Database exists: `algoai` ✅
- Backend needs to use: `algoai` instead of `default` ❌

