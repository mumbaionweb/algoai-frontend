# Backend API Requirements Document

## 📋 Overview

This document outlines the backend API requirements for the AlgoAI Frontend application. It covers existing endpoints, missing data requirements, and enhancements needed to support the frontend features.

---

## ✅ Currently Working Endpoints

The following endpoints are already implemented and working:

### 1. Authentication
- `POST /api/auth/login` - User login with Firebase token
- `GET /api/auth/verify-token` - Quick token verification
- `GET /api/auth/me` - Get current user info

### 2. Broker Management
- `GET /api/brokers` - List available brokers
- `GET /api/brokers/credentials` - Get user's broker credentials
- `POST /api/brokers/credentials` - Create broker credentials
- `PUT /api/brokers/credentials/{id}` - Update broker credentials
- `DELETE /api/brokers/credentials/{id}` - Delete broker credentials
- `GET /api/zerodha/oauth/initiate` - Initiate Zerodha OAuth
- `GET /api/zerodha/oauth/callback` - OAuth callback handler
- `POST /api/zerodha/oauth/refresh` - Refresh Zerodha token
- `GET /api/zerodha/oauth/status` - Get OAuth status
- `GET /api/zerodha/profile` - Get Zerodha user profile

### 3. Portfolio
- `GET /api/portfolio` - Get full portfolio summary
- `GET /api/portfolio/positions` - Get current positions
- `GET /api/portfolio/holdings` - Get holdings
- `GET /api/portfolio/pnl` - Get P&L summary
- `GET /api/portfolio/margins` - Get margin information

### 4. Backtesting
- `POST /api/backtesting/run` - Run a backtest
- `GET /api/backtesting/history` - Get backtest history
- `GET /api/backtesting/{id}` - Get specific backtest details

### 5. Strategies
- `GET /api/strategies` - List strategies
- `GET /api/strategies/{id}` - Get strategy details
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/{id}` - Update strategy
- `DELETE /api/strategies/{id}` - Delete strategy
- `POST /api/strategies/{id}/start` - Start strategy
- `POST /api/strategies/{id}/stop` - Stop strategy
- `POST /api/strategies/{id}/pause` - Pause strategy
- `POST /api/strategies/{id}/resume` - Resume strategy
- `GET /api/strategies/{id}/performance` - Get strategy performance

---

## 🚀 New Requirements

### 1. Historical Price Data for Timeseries Chart

**Priority: High**

The frontend now displays a timeseries chart in the "Data Verification" section, but it's currently using sample data. We need real historical price data from the backend.

#### Endpoint Specification

**Endpoint:** `GET /api/backtesting/{backtest_id}/data`

**Description:** Returns historical OHLCV (Open, High, Low, Close, Volume) data used in the backtest.

**Authentication:** Required (Bearer token)

**Path Parameters:**
- `backtest_id` (required): The ID of the backtest to retrieve data for

**Query Parameters:**
- `limit` (optional, default: 1000, max: 5000): Maximum number of data points to return
- `format` (optional, default: "json"): Response format - either "json" or "csv"

**Request Examples:**

```http
GET /api/backtesting/abc123/data
Authorization: Bearer <firebase_token>
```

```http
GET /api/backtesting/abc123/data?limit=500
Authorization: Bearer <firebase_token>
```

```http
GET /api/backtesting/abc123/data?limit=2000&format=json
Authorization: Bearer <firebase_token>
```

**Response Format (JSON):**

```json
{
  "backtest_id": "abc123",
  "symbol": "LTF",
  "exchange": "NSE",
  "interval": "day",
  "from_date": "2025-05-08",
  "to_date": "2025-11-08",
  "data_points": [
    {
      "time": "2025-05-08T00:00:00Z",
      "open": 1234.50,
      "high": 1250.75,
      "low": 1230.25,
      "close": 1245.00,
      "volume": 1000000
    },
    {
      "time": "2025-05-09T00:00:00Z",
      "open": 1245.00,
      "high": 1260.50,
      "low": 1240.00,
      "close": 1255.25,
      "volume": 1200000
    }
    // ... more data points up to the limit
  ],
  "total_points": 127,
  "returned_points": 127
}
```

**Response Format (CSV):**

When `format=csv`, the response should be a CSV file with the following structure:

```csv
time,open,high,low,close,volume
2025-05-08T00:00:00Z,1234.50,1250.75,1230.25,1245.00,1000000
2025-05-09T00:00:00Z,1245.00,1260.50,1240.00,1255.25,1200000
...
```

**Response Fields:**

- `backtest_id` (string): The backtest ID
- `symbol` (string): Trading symbol (e.g., "LTF", "RELIANCE")
- `exchange` (string): Exchange name (e.g., "NSE", "BSE")
- `interval` (string): Data interval used (e.g., "day", "5minute", "60minute")
- `from_date` (string): Start date in ISO format (YYYY-MM-DD)
- `to_date` (string): End date in ISO format (YYYY-MM-DD)
- `data_points` (array): Array of OHLCV data points
  - `time` (string): Timestamp in ISO 8601 format
  - `open` (number): Opening price
  - `high` (number): Highest price
  - `low` (number): Lowest price
  - `close` (number): Closing price
  - `volume` (number): Trading volume
- `total_points` (number): Total number of data points available for this backtest
- `returned_points` (number): Number of data points returned in this response (may be less than total_points if limit is applied)

**Error Responses:**

```json
{
  "detail": "Backtest not found"
}
```

```json
{
  "detail": "Limit exceeds maximum allowed (5000)"
}
```

```json
{
  "detail": "Invalid format. Must be 'json' or 'csv'"
}
```

**Implementation Notes:**

1. **Data Ordering:** Data points should be returned in chronological order (oldest first)
2. **Limit Handling:** If `limit` exceeds `total_points`, return all available points
3. **Performance:** Consider pagination for very large datasets (future enhancement)
4. **Caching:** Historical data can be cached since it doesn't change after backtest completion
5. **Authorization:** Ensure the user can only access their own backtest data

**Frontend Usage:**

The frontend will use this endpoint to:
- Display real price trends in the Data Verification chart
- Show actual historical data instead of sample data
- Allow users to visualize the data used in their backtest

---

### 2. Backtest History Index Fix

**Priority: Medium**

The backtest history endpoint currently returns a 500 error due to a missing Firestore index.

**Error Message:**
```
Failed to get backtest history: 400 The query requires an index. 
You can create it here: https://console.firebase.google.com/v1/r/project/algo-ai-477010/firestore/databases/algoai/indexes?create_composite=...
```

**Action Required:**
1. Create the composite index in Firestore as suggested in the error message
2. Or optimize the query to not require the index
3. Ensure the index is created for the `backtests` collection with fields:
   - `user_id` (Ascending)
   - `created_at` (Descending)

---

### 3. Backtest Response Enhancement

**Priority: Medium**

The current backtest response is good, but we could enhance it with:

#### 3.1. Include Interval in Response

Add the `interval` field to the backtest response so the frontend can display which interval was used:

```json
{
  "backtest_id": "abc123",
  "symbol": "LTF",
  "exchange": "NSE",
  "interval": "day",  // NEW: Add this field
  "from_date": "2025-05-08",
  "to_date": "2025-11-08",
  // ... rest of fields
}
```

#### 3.2. Include Interval in History

Add `interval` to the backtest history items:

```json
{
  "backtests": [
    {
      "id": "abc123",
      "backtest_id": "abc123",
      "symbol": "LTF",
      "exchange": "NSE",
      "interval": "day",  // NEW: Add this field
      "from_date": "2025-05-08",
      "to_date": "2025-11-08",
      // ... rest of fields
    }
  ]
}
```

---

### 4. Error Response Standardization

**Priority: Low**

Ensure all error responses follow a consistent format:

```json
{
  "detail": "Human-readable error message",
  "message": "Technical error message (optional)",
  "error_code": "ERROR_CODE_STRING (optional)",
  "timestamp": "2025-11-08T18:34:41Z (optional)"
}
```

**Current Status:** Most endpoints already use `detail` field, which is good. Just ensure consistency across all endpoints.

---

## 📊 Data Format Specifications

### Date/Time Format
- Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ` or `YYYY-MM-DD`
- Timezone: UTC preferred, or include timezone offset

### Price Format
- Use decimal numbers (float/double)
- Precision: 2 decimal places for prices
- Example: `1234.50`

### Interval Format
- Supported values: `day`, `60minute`, `30minute`, `15minute`, `5minute`, `3minute`, `minute`
- Backend should accept flexible formats and normalize:
  - `5min`, `5minute`, `5 min` → `5minute`
  - `hour`, `1hour`, `hourly` → `60minute`
  - `day`, `daily`, `1day` → `day`

---

## 🔐 Authentication Requirements

All endpoints (except public ones) require:

**Header:**
```
Authorization: Bearer <firebase_id_token>
```

**Device Tracking:**
```
X-Device-ID: <device_id>
```

The frontend automatically includes these headers in all requests.

---

## 📝 API Response Examples

### Successful Backtest Response (Current)
```json
{
  "backtest_id": "abc123",
  "symbol": "LTF",
  "exchange": "NSE",
  "from_date": "2025-05-08",
  "to_date": "2025-11-08",
  "initial_cash": 100000.0,
  "final_value": 100060.0,
  "total_return": 60.0,
  "total_return_pct": 0.06,
  "total_trades": 1,
  "winning_trades": 1,
  "losing_trades": 0,
  "win_rate": 100.0,
  "total_pnl": 60.0,
  "sharpe_ratio": 0.5,
  "max_drawdown": -10.0,
  "max_drawdown_pct": -0.01,
  "system_quality_number": 1.2,
  "average_return": 0.0001,
  "annual_return": 0.12,
  "data_bars_count": 127,
  "transactions": [
    {
      "date": "2025-10-15T00:00:00Z",
      "symbol": "LTF",
      "exchange": "NSE",
      "type": "BUY",
      "quantity": 10,
      "entry_price": 1000.0,
      "exit_price": 1006.0,
      "pnl": 60.0,
      "pnl_comm": 59.4,
      "status": "EXECUTED"
    }
  ]
}
```

### Enhanced Backtest Response (Recommended)
```json
{
  "backtest_id": "abc123",
  "symbol": "LTF",
  "exchange": "NSE",
  "interval": "day",  // NEW
  "from_date": "2025-05-08",
  "to_date": "2025-11-08",
  // ... all existing fields ...
  "data_bars_count": 127,
  "historical_data_sample": [  // NEW: For chart visualization
    {
      "time": "2025-05-08T00:00:00Z",
      "close": 1000.0
    },
    {
      "time": "2025-05-09T00:00:00Z",
      "close": 1005.5
    }
    // ... up to 200-500 data points
  ],
  "transactions": [...]
}
```

---

## 🎯 Implementation Priority

1. **High Priority:**
   - ✅ **Historical price data endpoint:** `GET /api/backtesting/{backtest_id}/data`
     - Returns OHLCV data with query parameters: `limit` (default: 1000, max: 5000) and `format` (default: "json")
     - Response includes: backtest_id, symbol, exchange, interval, from_date, to_date, data_points array, total_points, returned_points
   - Fix Firestore index for backtest history

2. **Medium Priority:**
   - Add `interval` field to backtest response
   - Add `interval` field to backtest history

3. **Low Priority:**
   - Standardize error response format
   - Add more detailed error codes

---

## 📞 Questions or Clarifications

If you have any questions about these requirements, please reach out to the frontend team. We're happy to discuss implementation details, data formats, or any concerns.

---

## 📚 Additional Notes

### Current Backend URL
- Production: `https://algoai-backend-606435458040.asia-south1.run.app`
- The frontend uses this URL from the `NEXT_PUBLIC_API_URL` environment variable

### Testing
- All endpoints should be tested with proper authentication tokens
- Device ID tracking is implemented on the frontend
- CORS should be configured to allow requests from the frontend domain

### Performance Considerations
- For historical data, consider pagination if returning large datasets
- Cache historical data when possible
- Limit default response size to reasonable amounts (e.g., 1000 data points)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-08  
**Status:** Active Requirements

