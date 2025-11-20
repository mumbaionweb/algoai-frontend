# Firestore Index Deployment Guide

## ✅ What's Already Done

1. ✅ **Code Fix**: Updated `get_user_backtests()` to use in-memory sorting (works without index)

2. ✅ **Index Definition**: Created `firestore.indexes.json` with the required index

3. ✅ **Deployment Script**: Created `scripts/create_firestore_index.sh`

## 🚀 Deployment Options

### Option 1: Use Firebase Console (Easiest - Recommended)

**Steps:**

1. Click the link from the error message:

   ```
   https://console.firebase.google.com/v1/r/project/algo-ai-477010/firestore/databases/algoai/indexes?create_composite=...
   ```

2. Or manually:

   - Go to: https://console.firebase.google.com/project/algo-ai-477010/firestore/indexes

   - Click **"Create Index"**

   - Collection: `backtests`

   - Fields:

     - `user_id` (Ascending)

     - `created_at` (Descending)

   - Click **"Create"**

**Time:** 2-3 minutes  

**Status:** Index will be created in background (usually 1-5 minutes)

---

### Option 2: Use Firebase CLI

**Prerequisites:**

```bash
# 1. Install Firebase CLI (if not installed)
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Initialize Firebase in project (if not done)
cd /Users/vishalnagadiya/algoai/algoaibackend
firebase init firestore
# Select: Use existing project → algo-ai-477010
# Select: Use default database → algoai
# Select: No for security rules (we have our own)
# Select: Yes for indexes
```

**Deploy:**

```bash
cd /Users/vishalnagadiya/algoai/algoaibackend
firebase deploy --only firestore:indexes
```

**Time:** 2-3 minutes  

**Status:** Index will be created in background

---

### Option 3: Use gcloud (After Authentication)

**Prerequisites:**

```bash
# 1. Authenticate gcloud
gcloud auth login

# 2. Set project
gcloud config set project algo-ai-477010
```

**Deploy:**

```bash
cd /Users/vishalnagadiya/algoai/algoaibackend
bash scripts/create_firestore_index.sh
```

**Time:** 2-3 minutes  

**Status:** Index will be created in background

---

### Option 4: Use REST API Directly

**Prerequisites:**

```bash
# Get access token
gcloud auth login
ACCESS_TOKEN=$(gcloud auth print-access-token)
```

**Create Index:**

```bash
curl -X POST \
  "https://firestore.googleapis.com/v1/projects/algo-ai-477010/databases/algoai/collectionGroups/backtests/indexes" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "queryScope": "COLLECTION",
    "fields": [
      {
        "fieldPath": "user_id",
        "order": "ASCENDING"
      },
      {
        "fieldPath": "created_at",
        "order": "DESCENDING"
      }
    ]
  }'
```

---

## 📋 Current Status

### ✅ Working Without Index

The code now works **without requiring an index** by:

- Fetching all backtests for the user (up to 500)

- Sorting in memory by `created_at`

- Returning top `limit` results

**This works immediately!** No index needed for basic functionality.

### ⚡ Performance with Index

Creating the index will:

- ✅ Improve query performance for large datasets

- ✅ Reduce memory usage (no need to fetch 500 records)

- ✅ Scale better as data grows

---

## 🔍 Verify Index Creation

### Check Index Status

**Via Firebase Console:**

1. Go to: https://console.firebase.google.com/project/algo-ai-477010/firestore/indexes

2. Look for index on `backtests` collection

3. Status should show: **"Enabled"** (green) when ready

**Via gcloud:**

```bash
gcloud firestore indexes list \
  --database=algoai \
  --project=algo-ai-477010
```

**Via API:**

```bash
ACCESS_TOKEN=$(gcloud auth print-access-token)
curl -X GET \
  "https://firestore.googleapis.com/v1/projects/algo-ai-477010/databases/algoai/collectionGroups/backtests/indexes" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

---

## 🎯 Recommended Approach

**For Immediate Use:**

- ✅ **No action needed** - Code works without index

- ✅ History endpoint will work (uses in-memory sorting)

**For Production Optimization:**

- ✅ **Use Option 1 (Firebase Console)** - Easiest and fastest

- ✅ Click the link from the error message

- ✅ Index will be created automatically

---

## 📝 Files Created

1. **`firestore.indexes.json`** - Index definition for Firebase CLI

2. **`scripts/create_firestore_index.sh`** - Script to create index via API

3. **`FIRESTORE_INDEX_DEPLOYMENT.md`** - This guide

---

## ⚠️ Important Notes

1. **Index Creation Time**: Usually 1-5 minutes, but can take up to 30 minutes for large collections

2. **No Downtime**: Index creation doesn't affect existing queries

3. **Automatic Fallback**: Code will use index if available, otherwise uses in-memory sorting

4. **Database Name**: Make sure you're creating index on the `algoai` database (not default)

---

## 🧪 Test After Index Creation

Once index is created, test the history endpoint:

```bash
curl -X GET \
  "https://algoai-backend-606435458040.asia-south1.run.app/api/backtesting/history?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return backtest history without errors!

