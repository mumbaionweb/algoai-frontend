# Backend API Requirements for Strategy v2 UI

## 📋 Overview

This document outlines the backend API requirements needed to support the new Strategy v2 UI page. The Strategy v2 page provides a Cursor-inspired interface for creating, editing, and managing trading strategies with AI assistance, real-time code editing, and comprehensive strategy management.

---

## 🎯 UI Components and Required APIs

### 1. Left Sidebar - Strategies List

**Component**: `LeftSidebar.tsx`

**Current Status**: ✅ **Partially Implemented**

**Required Endpoints**:

#### 1.1 Get All Strategies (Enhanced)
```http
GET /api/strategies
Authorization: Bearer <firebase_token>
Query Parameters:
  - status_filter: Optional (draft, active, paused, stopped, error)
  - limit: Optional (default: 50)
  - offset: Optional (default: 0)
  - sort_by: Optional (created_at, updated_at, name, status)
  - order: Optional (asc, desc)
```

**Response**:
```json
{
  "strategies": [
    {
      "id": "strategy_id",
      "user_id": "user_id",
      "name": "Strategy Name",
      "description": "Strategy description",
      "strategy_code": "def initialize(context):\n    pass",
      "status": "draft" | "active" | "paused" | "stopped" | "error",
      "parameters": {
        "symbol": "RELIANCE",
        "exchange": "NSE",
        "market_type": "equity"
      },
      "total_trades": 0,
      "win_rate": null,
      "total_pnl": 0.0,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10
}
```

**Enhancement Needed**:
- Add `status_filter` query parameter support
- Ensure `status` field is always present and accurate
- Add real-time status updates via SSE (see section 7)

---

### 2. Top Row - Market Type Selector

**Component**: `TopRow.tsx`

**Current Status**: ✅ **No API Required**

**Notes**:
- Market type is currently UI-only state
- Future enhancement: Store market_type in strategy parameters
- Currently supports: `equity` (others disabled for future)

---

### 3. Left Column - AI Chatbot

**Component**: `LeftColumn.tsx`

**Current Status**: ❌ **Not Implemented**

**Required Endpoints**:

#### 3.1 AI Chat - Send Message
```http
POST /api/ai/chat
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "message": "Create a moving average crossover strategy for RELIANCE",
  "conversation_id": "optional_conversation_id",
  "context": {
    "strategy_id": "optional_strategy_id",
    "market_type": "equity",
    "current_code": "optional_current_strategy_code"
  }
}
```

**Response**:
```json
{
  "response": "I'll help you create a moving average crossover strategy...",
  "conversation_id": "conv_123",
  "suggestions": [
    {
      "type": "code_snippet",
      "title": "Moving Average Crossover",
      "code": "def initialize(context):\n    context.fast_ma = 10\n    context.slow_ma = 20",
      "description": "Basic MA crossover implementation"
    }
  ],
  "metadata": {
    "tokens_used": 150,
    "model": "gpt-4",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### 3.2 AI Chat - Generate Strategy Code
```http
POST /api/ai/generate-strategy
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "requirements": "I want a strategy that buys when RSI < 30 and sells when RSI > 70",
  "market_type": "equity",
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "parameters": {
    "rsi_period": 14,
    "oversold": 30,
    "overbought": 70
  }
}
```

**Response**:
```json
{
  "strategy_code": "def initialize(context):\n    context.rsi_period = 14\n    ...",
  "explanation": "This strategy uses RSI indicator...",
  "parameters": {
    "rsi_period": 14,
    "oversold": 30,
    "overbought": 70
  },
  "metadata": {
    "complexity": "medium",
    "estimated_trades_per_day": 2,
    "risk_level": "medium"
  }
}
```

#### 3.3 AI Chat - Analyze Strategy Code
```http
POST /api/ai/analyze-strategy
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "strategy_code": "def initialize(context):\n    pass",
  "market_type": "equity"
}
```

**Response**:
```json
{
  "analysis": {
    "valid": true,
    "errors": [],
    "warnings": [
      "No risk management logic detected",
      "Missing stop-loss implementation"
    ],
    "suggestions": [
      "Add position sizing logic",
      "Implement stop-loss at 2%"
    ],
    "complexity": "low",
    "estimated_performance": "unknown"
  },
  "code_metrics": {
    "lines_of_code": 50,
    "functions": 3,
    "indicators_used": ["SMA", "RSI"],
    "risk_management": false
  }
}
```

#### 3.4 AI Chat - Get Conversation History
```http
GET /api/ai/conversations/{conversation_id}
Authorization: Bearer <firebase_token>
```

**Response**:
```json
{
  "conversation_id": "conv_123",
  "messages": [
    {
      "role": "user",
      "content": "Create a strategy",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I'll help you...",
      "timestamp": "2024-01-01T00:00:01Z"
    }
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:01Z"
}
```

**Implementation Notes**:
- Integrate with OpenAI GPT-4 or similar LLM
- Support streaming responses for better UX (SSE or WebSocket)
- Cache conversation history per user
- Rate limiting: 20 requests per minute per user
- Cost tracking per user

---

### 4. Right Column - Code Editor

**Component**: `CodeEditor.tsx`

**Current Status**: ✅ **Partially Implemented**

**Required Endpoints**:

#### 4.1 Create Strategy (Enhanced)
```http
POST /api/strategies
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "name": "My Strategy",
  "description": "Strategy description",
  "strategy_code": "def initialize(context):\n    pass",
  "parameters": {
    "symbol": "RELIANCE",
    "exchange": "NSE",
    "market_type": "equity",
    "interval": "5minute"
  }
}
```

**Response**: Same as current implementation

**Enhancement Needed**:
- Add `market_type` to parameters
- Validate `strategy_code` syntax before saving
- Return validation errors if code is invalid

#### 4.2 Update Strategy Code (Auto-save)
```http
PUT /api/strategies/{strategy_id}
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "strategy_code": "updated code here",
  "auto_save": true  // Indicates this is an auto-save, not manual save
}
```

**Response**:
```json
{
  "id": "strategy_id",
  "strategy_code": "updated code here",
  "updated_at": "2024-01-01T00:00:00Z",
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

**Enhancement Needed**:
- Support `auto_save` flag to differentiate from manual saves
- Return validation results in response
- Optimize for frequent auto-saves (debouncing on frontend)

#### 4.3 Validate Strategy Code
```http
POST /api/strategies/validate-code
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "strategy_code": "def initialize(context):\n    pass",
  "market_type": "equity"
}
```

**Response**:
```json
{
  "valid": true,
  "errors": [
    {
      "line": 5,
      "column": 10,
      "message": "SyntaxError: invalid syntax",
      "severity": "error"
    }
  ],
  "warnings": [
    {
      "line": 10,
      "column": 5,
      "message": "Unused variable 'x'",
      "severity": "warning"
    }
  ],
  "suggestions": [
    "Consider adding error handling",
    "Missing position sizing logic"
  ]
}
```

**Implementation Notes**:
- Use Python AST parser for syntax validation
- Check for required functions: `initialize`, `handle_data`
- Validate against strategy framework API
- Return line/column numbers for error highlighting

---

### 5. Right Column - Visual Builder

**Component**: `VisualBuilder.tsx`

**Current Status**: ⚠️ **Placeholder (Future Implementation)**

**Required Endpoints** (For Future):

#### 5.1 Get Strategy Components/Templates
```http
GET /api/strategy-components
Authorization: Bearer <firebase_token>
Query Parameters:
  - category: Optional (indicators, conditions, actions, risk_management)
```

**Response**:
```json
{
  "components": [
    {
      "id": "sma",
      "name": "Simple Moving Average",
      "category": "indicators",
      "icon": "chart-line",
      "parameters": [
        {
          "name": "period",
          "type": "integer",
          "default": 20,
          "min": 1,
          "max": 200
        }
      ],
      "code_template": "data['sma_{period}'] = data['close'].rolling({period}).mean()"
    }
  ]
}
```

#### 5.2 Generate Code from Visual Builder
```http
POST /api/strategies/generate-from-visual
Authorization: Bearer <firebase_token>
Content-Type: application/json

{
  "components": [
    {
      "id": "sma",
      "parameters": {"period": 20}
    },
    {
      "id": "buy_condition",
      "parameters": {"indicator": "sma", "operator": "cross_above"}
    }
  ]
}
```

**Response**:
```json
{
  "strategy_code": "generated code...",
  "components_used": ["sma", "buy_condition"]
}
```

**Priority**: Low (Future Enhancement)

---

### 6. Right Sidebar - Orders Tab

**Component**: `OrdersTab.tsx`

**Current Status**: ✅ **Partially Implemented**

**Required Endpoints**:

#### 6.1 Get Orders by Strategy (Enhanced)
```http
GET /api/orders
Authorization: Bearer <firebase_token>
Query Parameters:
  - strategy_id: Required (filter orders by strategy)
  - status_filter: Optional (PENDING, OPEN, COMPLETE, REJECTED, CANCELLED)
  - limit: Optional (default: 50)
  - offset: Optional (default: 0)
  - sort_by: Optional (created_at, updated_at)
  - order: Optional (asc, desc)
```

**Response**: Same as current implementation

**Enhancement Needed**:
- Ensure `strategy_id` filter works correctly
- Add real-time order updates via SSE (see section 7)

---

### 7. Right Sidebar - Details Tab

**Component**: `DetailsTab.tsx`

**Current Status**: ✅ **Implemented**

**Required Endpoints**:
- `GET /api/strategies/{strategy_id}` - Already exists
- `GET /api/strategies/{strategy_id}/performance` - Already exists

**Enhancement Needed**:
- Ensure performance data is up-to-date
- Add real-time performance updates via SSE

---

### 8. Bottom Row - Data Points

**Component**: `BottomRow.tsx`

**Current Status**: ✅ **Partially Implemented**

**Required Endpoints**:
- `GET /api/strategies/{strategy_id}/performance` - Already exists

**Enhancement Needed**:
- Real-time updates for status, trades, win rate, P&L
- See SSE section below

---

## 🔄 Real-Time Updates (SSE/WebSocket)

**Priority**: High

**Required Endpoints**:

### 7.1 Strategy Status Updates (SSE)
```http
GET /api/strategies/stream/status
Authorization: Bearer <firebase_token>
Query Parameters:
  - strategy_id: Optional (if not provided, stream all user's strategies)
```

**Response** (Server-Sent Events):
```
event: strategy_status_update
data: {"strategy_id": "str_123", "status": "active", "updated_at": "2024-01-01T00:00:00Z"}

event: strategy_performance_update
data: {"strategy_id": "str_123", "total_trades": 10, "win_rate": 60.5, "total_pnl": 1500.50}

event: strategy_error
data: {"strategy_id": "str_123", "error": "Connection lost", "timestamp": "2024-01-01T00:00:00Z"}
```

**Implementation Notes**:
- Use Server-Sent Events (SSE) for one-way updates
- Reconnect automatically on disconnect
- Include strategy_id in all events for filtering on frontend
- Update status, performance metrics, and errors in real-time

### 7.2 Order Updates (SSE)
```http
GET /api/orders/stream
Authorization: Bearer <firebase_token>
Query Parameters:
  - strategy_id: Optional (filter by strategy)
```

**Response** (Server-Sent Events):
```
event: order_update
data: {"order_id": "ord_123", "strategy_id": "str_123", "status": "COMPLETE", "filled_quantity": 10}

event: new_order
data: {"order_id": "ord_124", "strategy_id": "str_123", "status": "PENDING", ...}
```

---

## 🔍 Additional Requirements

### 8.1 Strategy Code Syntax Validation

**Endpoint**: `POST /api/strategies/validate-code` (see section 4.3)

**Requirements**:
- Validate Python syntax
- Check for required functions (`initialize`, `handle_data`)
- Validate against strategy framework API
- Return detailed error messages with line/column numbers
- Support for common Python linters (pylint, flake8)

### 8.2 Market Type Support

**Current**: Only `equity` supported

**Future**: Support for `commodity`, `currency`, `futures`

**Storage**: Store `market_type` in strategy `parameters` field

**Validation**: Validate strategy code against market type constraints

### 8.3 Strategy Auto-save

**Endpoint**: `PUT /api/strategies/{strategy_id}` with `auto_save: true`

**Requirements**:
- Optimize for frequent writes (consider using Redis cache + periodic DB writes)
- Return validation results even for auto-saves
- Track last manual save vs auto-save
- Conflict resolution if multiple tabs editing same strategy

### 8.4 Error Handling

**Requirements**:
- Return detailed error messages for all endpoints
- Include error codes for frontend error handling
- Validation errors should be user-friendly
- Rate limiting errors should include retry-after header

**Error Response Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Strategy code contains syntax errors",
    "details": [
      {
        "line": 5,
        "column": 10,
        "message": "SyntaxError: invalid syntax"
      }
    ],
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## 📊 API Summary

### New Endpoints Required

1. ✅ `POST /api/ai/chat` - AI chatbot conversation
2. ✅ `POST /api/ai/generate-strategy` - Generate strategy code from requirements
3. ✅ `POST /api/ai/analyze-strategy` - Analyze existing strategy code
4. ✅ `GET /api/ai/conversations/{conversation_id}` - Get conversation history
5. ✅ `POST /api/strategies/validate-code` - Validate strategy code syntax
6. ✅ `GET /api/strategies/stream/status` - SSE stream for strategy status updates
7. ✅ `GET /api/orders/stream` - SSE stream for order updates

### Enhanced Endpoints

1. ✅ `GET /api/strategies` - Add status_filter, sorting, pagination
2. ✅ `POST /api/strategies` - Add market_type validation, code validation
3. ✅ `PUT /api/strategies/{strategy_id}` - Add auto_save support, validation in response
4. ✅ `GET /api/orders` - Ensure strategy_id filter works correctly

### Existing Endpoints (No Changes)

1. ✅ `GET /api/strategies/{strategy_id}` - Already works
2. ✅ `GET /api/strategies/{strategy_id}/performance` - Already works
3. ✅ `POST /api/strategies/{strategy_id}/start` - Already works
4. ✅ `POST /api/strategies/{strategy_id}/stop` - Already works
5. ✅ `POST /api/strategies/{strategy_id}/pause` - Already works
6. ✅ `POST /api/strategies/{strategy_id}/resume` - Already works

---

## 🚀 Implementation Priority

### Phase 1 (Critical - Week 1)
1. ✅ Strategy code validation endpoint
2. ✅ Enhanced strategy create/update with validation
3. ✅ Strategy status SSE stream
4. ✅ Orders filtering by strategy_id

### Phase 2 (High Priority - Week 2)
1. ✅ AI chatbot basic endpoint (non-streaming)
2. ✅ AI generate strategy code
3. ✅ AI analyze strategy code
4. ✅ Orders SSE stream

### Phase 3 (Medium Priority - Week 3)
1. ✅ AI conversation history
2. ✅ AI streaming responses
3. ✅ Strategy auto-save optimization
4. ✅ Enhanced error handling

### Phase 4 (Low Priority - Future)
1. ⚠️ Visual builder endpoints
2. ⚠️ Market type expansion (commodity, currency, futures)
3. ⚠️ Advanced strategy analytics

---

## 📝 Notes

1. **Authentication**: All endpoints require Firebase ID token in Authorization header
2. **Rate Limiting**: AI endpoints should have stricter rate limits (20 req/min per user)
3. **Cost Tracking**: Track AI API usage per user for billing
4. **Caching**: Cache strategy validation results for 5 minutes
5. **Database**: Consider adding `last_auto_save_at` and `last_manual_save_at` fields to strategies table
6. **SSE**: Use Server-Sent Events for real-time updates (simpler than WebSocket for one-way updates)
7. **Error Codes**: Standardize error codes across all endpoints

---

## 🔗 Related Documents

- `BACKEND_REQUIREMENTS.md` - General backend requirements
- `BACKEND_MULTI_INTERVAL_SSE_REQUIREMENT.md` - SSE implementation guide
- `API_ENDPOINTS.md` - Current API documentation

---

## 📞 Questions?

For questions or clarifications, please contact the frontend team or refer to the Strategy v2 UI components in:
- `components/strategy-v2/`
- `app/(dashboard)/dashboard/strategies/v2/`

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Status**: Ready for Implementation

