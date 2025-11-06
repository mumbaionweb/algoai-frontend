# 🚨 URGENT: Backend Database Configuration Fix

## Critical Issue
**Production is broken** - Backend is trying to use wrong Firestore database name.

## Error Message
```
404 The database (default) does not exist for project algo-ai-477010
```

## Root Cause
The backend code is using `firestore.client()` without specifying the database name, so it defaults to `"default"` which doesn't exist. The actual database name is `"algoai"`.

## Immediate Fix Required

### For Python/FastAPI Backend:

**Current Code (WRONG):**
```python
from google.cloud import firestore

# This uses "default" database
db = firestore.client()
```

**Fixed Code (CORRECT):**
```python
from google.cloud import firestore

# This uses "algoai" database
db = firestore.Client(project='algo-ai-477010', database='algoai')
```

**OR if using Firebase Admin SDK:**
```python
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'algo-ai-477010',
    })

# This uses "algoai" database
db = firestore.client(database='algoai')
```

### For Node.js Backend:

**Current Code (WRONG):**
```javascript
const admin = require('firebase-admin');
const db = admin.firestore();
```

**Fixed Code (CORRECT):**
```javascript
const admin = require('firebase-admin');
const db = admin.firestore().database('algoai');
```

**OR:**
```javascript
const admin = require('firebase-admin');
const db = admin.firestore();
// But when getting database reference:
const dbRef = db.database('algoai');
```

## Verification Steps

1. **Verify database exists:**
   ```bash
   firebase firestore:databases:list --project algo-ai-477010
   ```
   Should show database named `algoai`.

2. **Test the fix locally:**
   - Update backend code to use `database='algoai'`
   - Test login endpoint
   - Verify it connects to the correct database

3. **Deploy to production:**
   - Deploy the fixed backend code
   - Test production login endpoint
   - Verify error is resolved

## Files to Check in Backend

Search for these patterns in your backend codebase:
- `firestore.client()` - should be `firestore.Client(database='algoai')`
- `firestore.Client()` - should include `database='algoai'`
- `admin.firestore()` - should specify database name
- Any Firestore initialization code

## Impact
- ✅ **Production:** Currently broken (500 error)
- ✅ **Users:** Cannot login
- ✅ **Status:** CRITICAL - needs immediate fix

## Expected After Fix
- Login endpoint should return 200 OK
- Users can login successfully
- No more "database (default) does not exist" errors

## Related Documentation
- See `BACKEND_FIRESTORE_CONFIG.md` for detailed configuration guide
- See `BACKEND_TIMEOUT_ISSUE.md` for performance optimization (separate issue)

## Quick Test Command
```bash
curl -X POST https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id_token":"TEST_TOKEN"}' \
  -v
```

Should return 401 (invalid token) or 200 (success), NOT 500 (database error).

