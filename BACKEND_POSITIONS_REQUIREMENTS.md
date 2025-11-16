# Backend Requirements: Positions Data for Backtest Results

## 📋 Overview

This document specifies the requirements for adding **positions data** to the backtest response. Currently, the frontend calculates positions by grouping transactions by `trade_id`, but it would be more efficient and accurate for the backend to provide this data directly.

---

## 🎯 Purpose

**Positions** represent grouped transactions that belong to the same trade. A position can have:
- **One entry transaction** (opening the position)
- **Multiple exit transactions** (partial or full closures)

The backend should calculate and return positions in the `BacktestResponse` so the frontend can display them directly without client-side processing.

---

## 📊 Position Calculation Logic

### Step 1: Group Transactions by `trade_id`

Group all transactions from the `transactions` array by their `trade_id` field:
- Transactions with the same `trade_id` belong to the same position
- Transactions without a `trade_id` should be grouped under a special identifier (e.g., `"unlinked"` or use a unique identifier)

### Step 2: Identify Entry and Exit Transactions

For each group of transactions:

1. **Entry Transaction:**
   - Find transaction where `status === "OPENED"` OR
   - Find transaction where `type === entry_action` AND `status !== "CLOSED"`
   - If multiple match, use the first one (oldest by `entry_date`)

2. **Exit Transactions:**
   - All transactions where `status === "CLOSED"` OR
   - All transactions where `type === exit_action` AND `status !== "OPENED"`

### Step 3: Calculate Position Metrics

For each position:

1. **Entry Information:**
   - `entry_date`: From entry transaction's `entry_date`
   - `entry_price`: From entry transaction's `entry_price`
   - `total_quantity`: From entry transaction's `quantity` (NOT sum of all transactions)
   - `entry_action`: From entry transaction's `entry_action` (or `type` if `entry_action` missing)
   - `exit_action`: From entry transaction's `exit_action` (or opposite of `entry_action` if missing)

2. **Position Type:**
   - `position_type`: From entry transaction's `position_type` (default: `"LONG"` if missing)

3. **Aggregated Totals (sum across ALL transactions in the position):**
   - `total_pnl`: Sum of all `pnl` values
   - `total_pnl_comm`: Sum of all `pnl_comm` values
   - `total_brokerage`: Sum of all `brokerage` values
   - `total_platform_fees`: Sum of all `platform_fees` values
   - `total_transaction_amount`: Sum of all `transaction_amount` values
   - `total_amount`: Sum of all `total_amount` values

4. **Closure Status:**
   - `total_closed_quantity`: Sum of quantities from all exit transactions
   - `is_closed`: `true` if `total_quantity === total_closed_quantity`, else `false`
   - `remaining_quantity`: `max(0, total_quantity - total_closed_quantity)`

5. **Symbol and Exchange:**
   - `symbol`: From first transaction's `symbol`
   - `exchange`: From first transaction's `exchange`

6. **Transactions Array:**
   - Include all transactions belonging to this position (sorted by date - see sorting rules below)

---

## 📐 Data Structure

### Position Object Schema

```python
{
    "trade_id": str,                    # Required: Unique identifier for this position/trade
    "position_type": str,                # Required: "LONG" or "SHORT"
    "entry_action": str,                 # Required: "BUY" or "SELL"
    "exit_action": str,                  # Required: "BUY" or "SELL"
    "entry_date": str,                   # Required: ISO 8601 timestamp (e.g., "2025-10-15T09:15:00Z")
    "entry_price": float,                # Required: Entry price per share
    "total_quantity": int,               # Required: Entry quantity (from entry transaction ONLY)
    "total_pnl": float,                 # Required: Total P&L (before fees) - sum of all transactions
    "total_pnl_comm": float,            # Required: Total P&L (after fees) - sum of all transactions
    "total_brokerage": float,           # Required: Total brokerage - sum of all transactions
    "total_platform_fees": float,       # Required: Total platform fees - sum of all transactions
    "total_transaction_amount": float,   # Required: Total transaction amount - sum of all transactions
    "total_amount": float,              # Required: Total amount (transaction + fees) - sum of all transactions
    "is_closed": bool,                  # Required: True if position is fully closed
    "remaining_quantity": int,          # Required: Remaining open quantity (0 if fully closed)
    "symbol": str,                      # Optional: Trading symbol
    "exchange": str,                    # Optional: Exchange name
    "transactions": [Transaction]       # Required: Array of all transactions in this position
}
```

### Updated BacktestResponse Schema

Add `positions` field to the existing `BacktestResponse`:

```python
{
    # ... existing fields ...
    "transactions": [Transaction],       # Existing: Individual transactions
    "positions": [Position],             # NEW: Grouped positions
    # ... other fields ...
}
```

---

## 🔄 Sorting Requirements

### Positions Array Sorting

Sort positions by `entry_date` in **ascending order** (oldest first):
```python
positions.sort(key=lambda p: p.entry_date)
```

### Transactions Within Position

Sort transactions within each position by:
1. **Primary sort:** `exit_date` (or `entry_date` if `exit_date` missing) - ascending (oldest first)
2. **Secondary sort:** `entry_date` - ascending (oldest first)

```python
# Pseudo-code
position.transactions.sort(key=lambda t: (
    t.exit_date or t.entry_date or "",
    t.entry_date or ""
))
```

---

## 🎯 Business Logic Rules

### Rule 1: Entry Quantity
- **CRITICAL:** `total_quantity` must be the quantity from the **entry transaction ONLY**
- **DO NOT** sum quantities from all transactions
- Example: Entry = 100 shares, Exit 1 = 50 shares, Exit 2 = 50 shares
  - `total_quantity` = 100 (from entry)
  - `total_closed_quantity` = 100 (50 + 50)
  - `is_closed` = True

### Rule 2: Partial Closures
- A position can have multiple exit transactions
- `is_closed` = False if `total_closed_quantity < total_quantity`
- `remaining_quantity` = `total_quantity - total_closed_quantity`

### Rule 3: Short Selling
- For SHORT positions:
  - `position_type` = "SHORT"
  - `entry_action` = "SELL" (selling to open)
  - `exit_action` = "BUY" (buying to close)
- All calculations remain the same (sum of P&L, fees, etc.)

### Rule 4: Missing trade_id
- If a transaction has no `trade_id`, assign it to a unique position
- Use a generated identifier (e.g., `"unlinked_{transaction_index}"` or `"orphan_{uuid}"`)
- **DO NOT** group all unlinked transactions into a single position

### Rule 5: Aggregated Totals
- All totals (`total_pnl`, `total_brokerage`, etc.) are sums across **ALL transactions** in the position
- This includes both entry and exit transactions

---

## 📝 Example Response

### Example 1: Simple LONG Position (Fully Closed)

```json
{
  "backtest_id": "bt_1234567890.123",
  "total_trades": 1,
  "transactions": [
    {
      "trade_id": "trade_001",
      "type": "BUY",
      "status": "OPENED",
      "entry_date": "2025-10-15T09:15:00Z",
      "entry_price": 1000.0,
      "quantity": 10,
      "position_type": "LONG",
      "entry_action": "BUY",
      "exit_action": "SELL",
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "pnl": 0,
      "pnl_comm": 0,
      "brokerage": 0,
      "platform_fees": 0,
      "transaction_amount": 10000.0,
      "total_amount": 10000.0
    },
    {
      "trade_id": "trade_001",
      "type": "SELL",
      "status": "CLOSED",
      "entry_date": "2025-10-15T09:15:00Z",
      "exit_date": "2025-10-15T15:30:00Z",
      "entry_price": 1000.0,
      "exit_price": 1050.0,
      "quantity": 10,
      "position_type": "LONG",
      "entry_action": "BUY",
      "exit_action": "SELL",
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "pnl": 500.0,
      "pnl_comm": 499.0,
      "brokerage": 1.0,
      "platform_fees": 0,
      "transaction_amount": 10500.0,
      "total_amount": 10501.0
    }
  ],
  "positions": [
    {
      "trade_id": "trade_001",
      "position_type": "LONG",
      "entry_action": "BUY",
      "exit_action": "SELL",
      "entry_date": "2025-10-15T09:15:00Z",
      "entry_price": 1000.0,
      "total_quantity": 10,
      "total_pnl": 500.0,
      "total_pnl_comm": 499.0,
      "total_brokerage": 1.0,
      "total_platform_fees": 0.0,
      "total_transaction_amount": 20500.0,
      "total_amount": 20501.0,
      "is_closed": true,
      "remaining_quantity": 0,
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "transactions": [
        {
          "trade_id": "trade_001",
          "type": "BUY",
          "status": "OPENED",
          "entry_date": "2025-10-15T09:15:00Z",
          "entry_price": 1000.0,
          "quantity": 10,
          "position_type": "LONG",
          "entry_action": "BUY",
          "exit_action": "SELL",
          "symbol": "RELIANCE",
          "exchange": "NSE",
          "pnl": 0,
          "pnl_comm": 0,
          "brokerage": 0,
          "platform_fees": 0,
          "transaction_amount": 10000.0,
          "total_amount": 10000.0
        },
        {
          "trade_id": "trade_001",
          "type": "SELL",
          "status": "CLOSED",
          "entry_date": "2025-10-15T09:15:00Z",
          "exit_date": "2025-10-15T15:30:00Z",
          "entry_price": 1000.0,
          "exit_price": 1050.0,
          "quantity": 10,
          "position_type": "LONG",
          "entry_action": "BUY",
          "exit_action": "SELL",
          "symbol": "RELIANCE",
          "exchange": "NSE",
          "pnl": 500.0,
          "pnl_comm": 499.0,
          "brokerage": 1.0,
          "platform_fees": 0,
          "transaction_amount": 10500.0,
          "total_amount": 10501.0
        }
      ]
    }
  ]
}
```

### Example 2: Partial Closure (LONG Position)

```json
{
  "positions": [
    {
      "trade_id": "trade_002",
      "position_type": "LONG",
      "entry_action": "BUY",
      "exit_action": "SELL",
      "entry_date": "2025-10-16T09:15:00Z",
      "entry_price": 2000.0,
      "total_quantity": 100,  // From entry transaction ONLY
      "total_pnl": 1500.0,    // Sum of P&L from all transactions
      "total_pnl_comm": 1497.0,
      "total_brokerage": 3.0,
      "total_platform_fees": 0.0,
      "total_transaction_amount": 405000.0,
      "total_amount": 405003.0,
      "is_closed": false,     // Not fully closed
      "remaining_quantity": 50,  // 100 - 50 (only one exit so far)
      "symbol": "TCS",
      "exchange": "NSE",
      "transactions": [
        {
          "trade_id": "trade_002",
          "type": "BUY",
          "status": "OPENED",
          "entry_date": "2025-10-16T09:15:00Z",
          "entry_price": 2000.0,
          "quantity": 100,
          "pnl": 0,
          "transaction_amount": 200000.0
        },
        {
          "trade_id": "trade_002",
          "type": "SELL",
          "status": "CLOSED",
          "exit_date": "2025-10-16T15:30:00Z",
          "exit_price": 2030.0,
          "quantity": 50,  // Partial closure
          "pnl": 1500.0,
          "transaction_amount": 101500.0
        }
      ]
    }
  ]
}
```

### Example 3: SHORT Position

```json
{
  "positions": [
    {
      "trade_id": "trade_003",
      "position_type": "SHORT",
      "entry_action": "SELL",  // Selling to open short
      "exit_action": "BUY",    // Buying to close short
      "entry_date": "2025-10-17T09:15:00Z",
      "entry_price": 1500.0,
      "total_quantity": 20,
      "total_pnl": -200.0,  // Loss (price went up)
      "total_pnl_comm": -201.0,
      "total_brokerage": 1.0,
      "total_platform_fees": 0.0,
      "total_transaction_amount": 30200.0,
      "total_amount": 30201.0,
      "is_closed": true,
      "remaining_quantity": 0,
      "symbol": "INFY",
      "exchange": "NSE",
      "transactions": [
        {
          "trade_id": "trade_003",
          "type": "SELL",
          "status": "OPENED",
          "entry_date": "2025-10-17T09:15:00Z",
          "entry_price": 1500.0,
          "quantity": 20,
          "position_type": "SHORT",
          "entry_action": "SELL",
          "exit_action": "BUY",
          "pnl": 0,
          "transaction_amount": 30000.0
        },
        {
          "trade_id": "trade_003",
          "type": "BUY",
          "status": "CLOSED",
          "exit_date": "2025-10-17T15:30:00Z",
          "exit_price": 1510.0,
          "quantity": 20,
          "position_type": "SHORT",
          "entry_action": "SELL",
          "exit_action": "BUY",
          "pnl": -200.0,  // Loss: (1500 - 1510) * 20
          "transaction_amount": 30200.0
        }
      ]
    }
  ]
}
```

---

## ⚠️ Edge Cases & Validation

### Edge Case 1: Missing Entry Transaction
- If no entry transaction found, use the first transaction in the group
- Log a warning but don't fail

### Edge Case 2: All Transactions Are Exits
- This shouldn't happen in normal flow, but handle gracefully
- Use the first transaction as entry (even if it's marked as exit)
- Log a warning

### Edge Case 3: Multiple Entry Transactions
- Use the first entry transaction (oldest by `entry_date`)
- Log a warning if multiple entries found

### Edge Case 4: Negative Remaining Quantity
- Should not happen, but use `max(0, remaining_quantity)` to prevent negative values

### Edge Case 5: Missing Required Fields
- If `entry_date` is missing, use `date` field from transaction
- If `entry_price` is missing, use 0.0 (log warning)
- If `position_type` is missing, default to "LONG"
- If `entry_action`/`exit_action` missing, infer from `type` and `position_type`

---

## 🔌 API Integration

### Endpoint: `POST /api/backtesting/run` (Synchronous)
- Add `positions` array to response
- Calculate positions from `transactions` array before returning

### Endpoint: `GET /api/backtesting/jobs/{job_id}` (Async Jobs)
- When job status is `"completed"`, include `positions` in `result` object
- Calculate positions from `result.transactions` before returning

### Endpoint: `GET /api/backtesting/{backtest_id}` (Get Backtest Result)
- Include `positions` array in response
- Calculate positions from `transactions` array

---

## ✅ Validation Checklist

Before returning positions, ensure:

- [ ] All positions have a valid `trade_id`
- [ ] `total_quantity` equals entry transaction's quantity (not sum of all)
- [ ] `is_closed` is correctly calculated (`total_quantity === total_closed_quantity`)
- [ ] `remaining_quantity` is non-negative
- [ ] All aggregated totals are sums of corresponding transaction fields
- [ ] Positions are sorted by `entry_date` (ascending)
- [ ] Transactions within each position are sorted by date (ascending)
- [ ] Each transaction appears in exactly one position
- [ ] All transactions from the `transactions` array are included in positions

---

## 📊 Performance Considerations

- Calculate positions **once** after backtest completes
- Store positions in the same response as transactions (no separate API call needed)
- For large backtests (1000+ transactions), grouping should be efficient (O(n) with hash map)

---

## 🔄 Backward Compatibility

- `positions` field is **optional** in `BacktestResponse`
- Frontend will fall back to client-side calculation if `positions` is missing
- This allows gradual rollout without breaking existing functionality

---

## 📞 Questions or Clarifications

If you need clarification on any requirement, please refer to:
1. Frontend implementation: `app/(dashboard)/dashboard/backtesting/page.tsx` → `buildPositionView()` function
2. TypeScript interface: `types/index.ts` → `BacktestPosition` interface
3. This document

---

**Last Updated:** 2025-01-XX  
**Status:** Active Requirements  
**Priority:** Medium (Enhancement, not critical)

