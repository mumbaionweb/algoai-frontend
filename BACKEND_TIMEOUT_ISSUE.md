# Backend Timeout Issue - Action Items

## Problem
The backend `/api/auth/login` endpoint is taking **>30 seconds** to respond, causing request timeouts on the frontend.

## Current Situation
- **Frontend timeout:** 30 seconds
- **Backend URL:** `http://localhost:8080/api/auth/login` (local) / `https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login` (production)
- **Error:** `timeout of 30000ms exceeded` (ECONNABORTED)
- **Status:** Backend is reachable (health check works), but login endpoint is extremely slow

## Root Cause Analysis Needed

### 1. **Firestore Database Performance**
- [ ] Check if Firestore database `algoai` has proper indexes
- [ ] Verify Firestore connection is using the correct database name (`algoai`, not `default`)
- [ ] Check Firestore query performance in logs
- [ ] Verify Firestore client initialization is correct:
  ```python
  # Python/FastAPI
  firestore_client = firestore.Client(project='algo-ai-477010', database='algoai')
  
  # Node.js
  const db = firestore.getFirestore(app, 'algoai');
  ```

### 2. **Token Verification Performance**
- [ ] Check Firebase Admin SDK token verification time
- [ ] Verify token verification is not making redundant API calls
- [ ] Check if Firebase Admin SDK is properly initialized
- [ ] Review Firebase Admin SDK initialization code:
  ```python
  # Python
  import firebase_admin
  from firebase_admin import credentials, firestore
  
  if not firebase_admin._apps:
      cred = credentials.ApplicationDefault()
      firebase_admin.initialize_app(cred, {
          'projectId': 'algo-ai-477010',
      })
  
  db = firestore.client()
  ```

### 3. **Database Queries**
- [ ] Check if login endpoint is making multiple Firestore queries
- [ ] Verify queries are optimized (using indexes, not full table scans)
- [ ] Check if queries are sequential instead of parallel
- [ ] Review query patterns in `/api/auth/login` endpoint:
  - User lookup queries
  - Token verification queries
  - Any additional data fetching

### 4. **Network/Connection Issues**
- [ ] Check if backend can reach Firestore (network latency)
- [ ] Verify Firestore region matches backend region
- [ ] Check for connection pooling issues
- [ ] Review connection timeouts and retry logic

### 5. **Backend Code Issues**
- [ ] Check for blocking operations in login endpoint
- [ ] Verify no infinite loops or hanging operations
- [ ] Check for deadlocks or resource contention
- [ ] Review error handling (errors might be silently failing and causing delays)

## Immediate Actions

### Priority 1: Check Backend Logs
1. **Check backend logs** during login attempt:
   - Look for slow queries
   - Check for errors or warnings
   - Identify which operation is taking the longest time

2. **Add timing logs** to login endpoint:
   ```python
   import time
   
   start = time.time()
   # ... operation ...
   print(f"Operation took {time.time() - start} seconds")
   ```

### Priority 2: Verify Firestore Configuration
1. **Confirm database name** is `algoai` (not `default`)
2. **Check Firestore indexes** in Firebase Console:
   - Go to Firestore > Indexes
   - Ensure all required indexes exist
   - Create missing indexes if needed

3. **Test Firestore connection** directly:
   ```python
   # Test script
   from google.cloud import firestore
   import time
   
   db = firestore.Client(project='algo-ai-477010', database='algoai')
   start = time.time()
   doc_ref = db.collection('users').document('test')
   doc = doc_ref.get()
   print(f"Query took {time.time() - start} seconds")
   ```

### Priority 3: Optimize Login Endpoint
1. **Review login endpoint code** for:
   - Multiple sequential database calls (should be parallel if possible)
   - Unnecessary data fetching
   - Redundant token verification calls

2. **Add timeout handling** to Firestore queries:
   ```python
   # Set query timeout
   query = collection_ref.where(...).limit(1)
   docs = query.get(timeout=5)  # 5 second timeout
   ```

3. **Implement caching** for frequently accessed data:
   - Cache user data if possible
   - Cache Firebase Admin SDK initialization

## Expected Performance
- **Login endpoint should respond in < 2 seconds**
- **Firestore queries should be < 500ms each**
- **Token verification should be < 100ms**

## Testing Checklist
- [ ] Test login endpoint directly with curl/Postman
- [ ] Check response time for each operation
- [ ] Verify Firestore queries are using indexes
- [ ] Test with different user accounts
- [ ] Check if issue is consistent or intermittent
- [ ] Monitor backend CPU and memory usage

## Diagnostic Commands

### Test Backend Health
```bash
curl http://localhost:8080/health
```

### Test Login Endpoint (with timeout)
```bash
time curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id_token":"YOUR_TOKEN_HERE"}' \
  --max-time 10
```

### Check Backend Logs
- Check Cloud Run logs (if deployed)
- Check local backend console output
- Look for Firestore query logs

## Backend Code Review Checklist

### Firestore Client Initialization
- [ ] Using correct database name: `algoai`
- [ ] Using correct project ID: `algo-ai-477010`
- [ ] Client is initialized once and reused
- [ ] No connection leaks

### Login Endpoint Code
- [ ] Token verification is efficient
- [ ] User lookup is optimized
- [ ] No unnecessary database calls
- [ ] Proper error handling
- [ ] No blocking operations
- [ ] Queries use indexes

### Error Handling
- [ ] Errors are logged properly
- [ ] Timeouts are handled
- [ ] Connection errors are caught
- [ ] Proper error responses to frontend

## Contact Information
- **Frontend Timeout:** 30 seconds (configurable if needed)
- **Backend URL:** `https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login`
- **Expected Response Time:** < 2 seconds

## Next Steps
1. Backend team reviews this document
2. Backend team adds timing logs to identify bottleneck
3. Backend team fixes the identified issue
4. Test login endpoint performance
5. Update frontend timeout if needed (currently 30s)

