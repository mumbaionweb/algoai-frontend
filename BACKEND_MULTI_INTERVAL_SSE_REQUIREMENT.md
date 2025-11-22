# Backend Requirement: Multi-Interval SSE Support for Running Jobs

## 📋 Overview

**Priority:** High  
**Status:** Pending Implementation  
**Requested By:** Frontend Team  
**Date:** 2025-01-22

---

## 🎯 Problem Statement

Currently, the multi-interval SSE endpoint (`/api/sse/backtest/{id}/data/multi`) **only works for completed backtests** (when `id` starts with `bt_`). For running jobs, the frontend must use REST API polling for each interval separately, which is:

1. **Less efficient**: Multiple HTTP requests instead of a single SSE stream
2. **Slower**: Polling every 5 seconds vs. real-time streaming
3. **Poor UX**: Users must wait for entire dataset to be fetched before seeing visualizations
4. **Resource intensive**: Multiple concurrent requests for the same job

**Use Case:**
- Users analyze multiple intervals (e.g., `day`, `minute`, `3minute`) with large datasets
- Users want to see visualizations **progressively** as data becomes available
- Waiting for the entire dataset to be fetched at once is not acceptable

---

## ✅ Current Behavior

### Completed Backtests (Works ✅)
- **Endpoint:** `/api/sse/backtest/{backtest_id}/data/multi`
- **ID Format:** `bt_1234567890.123` (starts with `bt_`)
- **Data Source:** BigQuery (all data already stored)
- **Behavior:** Streams all intervals efficiently in sequence

### Running Jobs (Doesn't Work ❌)
- **Endpoint:** `/api/sse/backtest/{job_id}/data/multi`
- **ID Format:** `fWroZTP6KfwS3ZjTEFa3` (does not start with `bt_`)
- **Current Behavior:** Returns `400 Bad Request` or not implemented
- **Frontend Workaround:** Uses REST API polling (`GET /api/backtesting/{job_id}/data?interval={interval}`) for each interval separately

---

## 🎯 Requested Enhancement

**Enable multi-interval SSE for running jobs** so that:

1. The endpoint `/api/sse/backtest/{job_id}/data/multi` works for `job_id` (not just `backtest_id`)
2. Data is streamed **progressively** as it becomes available from the broker API
3. Users can see visualizations **in real-time** without waiting for the entire dataset
4. The frontend can use a single SSE connection instead of multiple REST API calls

---

## 📐 Technical Specification

### Endpoint

**URL:** `/api/sse/backtest/{id}/data/multi`

**Path Parameters:**
- `id` (required): Either:
  - `backtest_id` (starts with `bt_`) - for completed backtests (existing behavior)
  - `job_id` (does not start with `bt_`) - for running jobs (new behavior)

**Query Parameters:**
- `intervals` (required): Comma-separated list of intervals (e.g., `day,minute,3minute`)
- `limit` (optional, default: 1000, max: 50000): Maximum number of data points per interval
- `chunk_size` (optional, default: 500): Number of data points per chunk
- `token` (required): Firebase authentication token

**Request Example:**
```http
GET /api/sse/backtest/fWroZTP6KfwS3ZjTEFa3/data/multi?intervals=day,minute,3minute&limit=10000&chunk_size=500&token=eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...
Accept: text/event-stream
```

---

## 📤 SSE Event Format

### Event Types

The endpoint should emit the same event types as the existing multi-interval SSE endpoint:

1. **`interval_start`** - When starting to stream an interval
2. **`data_chunk`** - When sending a chunk of data for an interval
3. **`interval_complete`** - When an interval is fully streamed
4. **`all_complete`** - When all intervals are complete
5. **`error`** - On errors

### Event: `interval_start`

**Triggered:** When starting to stream data for a specific interval

**Event Data:**
```json
{
  "interval": "day",
  "interval_index": 0,
  "total_intervals": 3,
  "total_points": 103,
  "total_chunks": 1,
  "chunk_size": 500,
  "backtest_id": null,
  "job_id": "fWroZTP6KfwS3ZjTEFa3",
  "symbol": "LTF",
  "exchange": "NSE",
  "is_partial": true,
  "current_bar": null,
  "job_status": "running"
}
```

**Fields:**
- `interval`: The interval being streamed (e.g., `day`, `minute`, `3minute`)
- `interval_index`: Zero-based index of the interval (0, 1, 2, ...)
- `total_intervals`: Total number of intervals to stream
- `total_points`: Total number of data points for this interval
- `total_chunks`: Estimated number of chunks (for progress tracking)
- `chunk_size`: Number of data points per chunk
- `backtest_id`: `null` for running jobs, `bt_...` for completed backtests
- `job_id`: The job ID (only present for running jobs)
- `symbol`: Trading symbol
- `exchange`: Exchange name
- `is_partial`: `true` for running jobs (data may be incomplete), `false` for completed backtests
- `current_bar`: Current bar being processed (for running jobs, may be `null`)
- `job_status`: Job status (`running`, `queued`, `paused`, `completed`, etc.)

### Event: `data_chunk`

**Triggered:** When sending a chunk of data for an interval

**Event Data:**
```json
{
  "interval": "day",
  "data_points": [
    {
      "time": "2025-04-01T00:00:00Z",
      "open": 1234.50,
      "high": 1250.75,
      "low": 1230.25,
      "close": 1245.00,
      "volume": 1000000
    },
    // ... more data points
  ],
  "points_sent": 103,
  "total_points": 103,
  "chunk_index": 0,
  "is_last_chunk": true,
  "is_partial": true,
  "current_bar": 50,
  "job_status": "running",
  "progress": {
    "total_intervals": 3,
    "completed_intervals": [],
    "current_interval": "day",
    "overall_progress": {
      "day": {
        "total_points": 103,
        "total_chunks": 1,
        "chunks_sent": 0,
        "points_sent": 0
      },
      "minute": {
        "total_points": 5000,
        "total_chunks": 10,
        "chunks_sent": 0,
        "points_sent": 0
      },
      "3minute": {
        "total_points": 1667,
        "total_chunks": 4,
        "chunks_sent": 0,
        "points_sent": 0
      }
    }
  }
}
```

**Fields:**
- `interval`: The interval this chunk belongs to
- `data_points`: Array of OHLCV data points
- `points_sent`: Number of points sent so far for this interval
- `total_points`: Total number of points for this interval
- `chunk_index`: Zero-based index of this chunk
- `is_last_chunk`: `true` if this is the last chunk for this interval
- `is_partial`: `true` for running jobs (data may be incomplete)
- `current_bar`: Current bar being processed (for running jobs)
- `job_status`: Current job status
- `progress`: Overall progress across all intervals

### Event: `interval_complete`

**Triggered:** When an interval is fully streamed

**Event Data:**
```json
{
  "interval": "day",
  "total_points": 103,
  "points_sent": 103,
  "backtest_id": null,
  "job_id": "fWroZTP6KfwS3ZjTEFa3",
  "is_partial": false,
  "job_status": "running"
}
```

### Event: `all_complete`

**Triggered:** When all intervals are fully streamed

**Event Data:**
```json
{
  "intervals": ["day", "minute", "3minute"],
  "completed_intervals": ["day", "minute", "3minute"],
  "total_points": {
    "day": 103,
    "minute": 5000,
    "3minute": 1667
  },
  "backtest_id": null,
  "job_id": "fWroZTP6KfwS3ZjTEFa3",
  "job_status": "running"
}
```

### Event: `error`

**Triggered:** On errors

**Event Data:**
```json
{
  "error": "connection_error" | "data_error" | "job_not_found" | "interval_not_found",
  "message": "Human-readable error message",
  "interval": "day",  // Optional: which interval failed
  "job_id": "fWroZTP6KfwS3ZjTEFa3"  // Optional
}
```

---

## 🔄 Implementation Flow

### For Running Jobs (`job_id`)

1. **Validate Request:**
   - Check if `job_id` exists and is accessible by the user
   - Verify job status (should be `running`, `queued`, or `paused`)
   - Validate requested intervals match job configuration

2. **Fetch Job Configuration:**
   - Get job details: `symbol`, `exchange`, `from_date`, `to_date`, `intervals`
   - Determine total data points expected for each interval

3. **Stream Data Progressively:**
   - For each interval in sequence:
     - Emit `interval_start` event
     - Fetch data from broker API (or cache if available)
     - Stream data in chunks via `data_chunk` events
     - Emit `interval_complete` when done
   - Emit `all_complete` when all intervals are done

4. **Handle Partial Data:**
   - For running jobs, data may be incomplete
   - Set `is_partial: true` in events
   - Include `current_bar` if available
   - Update `job_status` as job progresses

5. **Error Handling:**
   - If broker API fails for an interval, emit `error` event but continue with other intervals
   - If job is cancelled/failed, emit `error` event and close connection
   - Handle network errors gracefully

### For Completed Backtests (`backtest_id`)

**Existing behavior should remain unchanged:**
- Query BigQuery for all intervals
- Stream data efficiently
- Set `is_partial: false`

---

## 🎨 Progressive Loading Strategy

### Option 1: Sequential Interval Streaming (Recommended)

Stream intervals **one at a time**:
1. Stream `day` interval completely
2. Then stream `minute` interval completely
3. Then stream `3minute` interval completely

**Benefits:**
- Simpler implementation
- Frontend can show charts progressively
- Lower memory usage

**Event Sequence:**
```
interval_start (day) → data_chunk (day) → interval_complete (day)
→ interval_start (minute) → data_chunk (minute) → interval_complete (minute)
→ interval_start (3minute) → data_chunk (3minute) → interval_complete (3minute)
→ all_complete
```

### Option 2: Parallel Interval Streaming (Advanced)

Stream intervals **in parallel** (interleave chunks):
- Stream chunks from different intervals as data becomes available

**Benefits:**
- Faster overall streaming
- Better for very large datasets

**Challenges:**
- More complex implementation
- Requires coordination between multiple data fetches

**Recommendation:** Start with Option 1 (Sequential), add Option 2 later if needed.

---

## 🔍 Data Fetching Strategy

### For Running Jobs

**Option A: Fetch from Broker API (Real-time)**
- Fetch data directly from broker API (Zerodha, etc.)
- Stream as data is fetched
- **Pros:** Always up-to-date, works for any job
- **Cons:** Slower, rate limits, network dependent

**Option B: Use Cached/Stored Data**
- If job has already fetched some data, use cached version
- Stream cached data first, then fetch remaining from broker
- **Pros:** Faster for already-fetched data
- **Cons:** Requires caching mechanism

**Option C: Hybrid Approach (Recommended)**
- Use cached data if available
- Fetch remaining data from broker API
- Stream progressively as data becomes available

### For Completed Backtests

**Existing behavior:**
- Query BigQuery (fast, all data available)
- Stream efficiently

---

## 📊 Example Request/Response Flow

### Request
```http
GET /api/sse/backtest/fWroZTP6KfwS3ZjTEFa3/data/multi?intervals=day,minute,3minute&limit=10000&chunk_size=500&token=eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...
Accept: text/event-stream
```

### SSE Stream Response
```
event: interval_start
data: {"interval":"day","interval_index":0,"total_intervals":3,"total_points":103,"total_chunks":1,"chunk_size":500,"backtest_id":null,"job_id":"fWroZTP6KfwS3ZjTEFa3","symbol":"LTF","exchange":"NSE","is_partial":true,"current_bar":null,"job_status":"running"}

event: data_chunk
data: {"interval":"day","data_points":[...],"points_sent":103,"total_points":103,"chunk_index":0,"is_last_chunk":true,"is_partial":true,"current_bar":50,"job_status":"running","progress":{...}}

event: interval_complete
data: {"interval":"day","total_points":103,"points_sent":103,"backtest_id":null,"job_id":"fWroZTP6KfwS3ZjTEFa3","is_partial":false,"job_status":"running"}

event: interval_start
data: {"interval":"minute","interval_index":1,"total_intervals":3,"total_points":5000,"total_chunks":10,"chunk_size":500,"backtest_id":null,"job_id":"fWroZTP6KfwS3ZjTEFa3","symbol":"LTF","exchange":"NSE","is_partial":true,"current_bar":null,"job_status":"running"}

event: data_chunk
data: {"interval":"minute","data_points":[...],"points_sent":500,"total_points":5000,"chunk_index":0,"is_last_chunk":false,"is_partial":true,"current_bar":100,"job_status":"running","progress":{...}}

event: data_chunk
data: {"interval":"minute","data_points":[...],"points_sent":1000,"total_points":5000,"chunk_index":1,"is_last_chunk":false,"is_partial":true,"current_bar":200,"job_status":"running","progress":{...}}

... (more chunks)

event: interval_complete
data: {"interval":"minute","total_points":5000,"points_sent":5000,"backtest_id":null,"job_id":"fWroZTP6KfwS3ZjTEFa3","is_partial":false,"job_status":"running"}

event: interval_start
data: {"interval":"3minute","interval_index":2,"total_intervals":3,"total_points":1667,"total_chunks":4,"chunk_size":500,"backtest_id":null,"job_id":"fWroZTP6KfwS3ZjTEFa3","symbol":"LTF","exchange":"NSE","is_partial":true,"current_bar":null,"job_status":"running"}

... (stream 3minute interval)

event: all_complete
data: {"intervals":["day","minute","3minute"],"completed_intervals":["day","minute","3minute"],"total_points":{"day":103,"minute":5000,"3minute":1667},"backtest_id":null,"job_id":"fWroZTP6KfwS3ZjTEFa3","job_status":"running"}
```

---

## ✅ Benefits

1. **Better UX:**
   - Users see visualizations **progressively** as data becomes available
   - No need to wait for entire dataset to be fetched

2. **More Efficient:**
   - Single SSE connection instead of multiple REST API calls
   - Real-time streaming instead of polling every 5 seconds
   - Lower server load

3. **Scalability:**
   - Works well with large datasets across multiple intervals
   - Frontend can start rendering charts as soon as first interval data arrives

4. **Consistency:**
   - Same API pattern for both running jobs and completed backtests
   - Frontend code becomes simpler

---

## 🚨 Error Handling

### Job Not Found
```json
{
  "error": "job_not_found",
  "message": "Job fWroZTP6KfwS3ZjTEFa3 not found or not accessible"
}
```

### Invalid Interval
```json
{
  "error": "interval_not_found",
  "message": "Interval 'hour' not found in job configuration",
  "interval": "hour"
}
```

### Broker API Error
```json
{
  "error": "data_error",
  "message": "Failed to fetch data for interval 'minute' from broker API",
  "interval": "minute"
}
```

### Job Cancelled/Failed
```json
{
  "error": "job_error",
  "message": "Job fWroZTP6KfwS3ZjTEFa3 was cancelled",
  "job_id": "fWroZTP6KfwS3ZjTEFa3"
}
```

**Note:** For non-critical errors (e.g., one interval fails), continue streaming other intervals and emit error event for the failed interval only.

---

## 🔒 Security & Authentication

1. **Authentication:**
   - Require Firebase token in query parameter or Authorization header
   - Verify token and user identity

2. **Authorization:**
   - Verify user has access to the job/backtest
   - Check job ownership

3. **Rate Limiting:**
   - Consider rate limits for broker API calls
   - Implement connection limits per user

---

## 📝 Implementation Notes

1. **Backward Compatibility:**
   - Existing behavior for `backtest_id` should remain unchanged
   - Only add new behavior for `job_id`

2. **Performance:**
   - Use async/await for broker API calls
   - Stream data as it becomes available (don't wait for all data)
   - Consider caching frequently accessed data

3. **Memory Management:**
   - Stream data in chunks (don't load entire dataset in memory)
   - Close connections properly on errors or completion

4. **Testing:**
   - Test with running jobs (various statuses)
   - Test with completed backtests (existing behavior)
   - Test error scenarios
   - Test with large datasets

---

## 🔄 Migration Path

1. **Phase 1:** Implement basic multi-interval SSE for running jobs (sequential streaming)
2. **Phase 2:** Add caching for better performance
3. **Phase 3:** (Optional) Add parallel streaming for very large datasets

---

## 📞 Questions & Clarifications

If you need clarification on any aspect of this requirement, please contact the frontend team.

**Key Questions to Consider:**
1. Should we fetch data from broker API or use cached data?
2. Should intervals be streamed sequentially or in parallel?
3. How should we handle rate limits from broker API?
4. Should we support resuming interrupted streams?

---

## 📚 Related Documentation

- `BACKEND_REQUIREMENTS.md` - General backend requirements
- `FRONTEND_API_UPDATES_SUMMARY.md` - Recent API changes
- `lib/services/historicalDataSSE.ts` - Frontend SSE client implementation
- `hooks/useHistoricalDataSSE.ts` - Frontend React hook

---

## ✅ Acceptance Criteria

- [ ] Multi-interval SSE endpoint works with `job_id` (not just `backtest_id`)
- [ ] Data is streamed progressively as it becomes available
- [ ] All event types (`interval_start`, `data_chunk`, `interval_complete`, `all_complete`, `error`) work correctly
- [ ] `is_partial` flag correctly indicates partial data for running jobs
- [ ] `current_bar` and `job_status` are included in events for running jobs
- [ ] Error handling works correctly (job not found, invalid interval, broker API errors)
- [ ] Backward compatibility maintained (existing `backtest_id` behavior unchanged)
- [ ] Performance is acceptable (streaming starts within 1-2 seconds)
- [ ] Works with large datasets (10,000+ data points per interval)
- [ ] Security and authentication work correctly

---

**End of Document**

