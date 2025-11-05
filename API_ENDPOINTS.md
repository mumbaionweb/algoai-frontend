# API Endpoints - AlgoAI Backend

## 🌐 Base URL

**Production (Cloud Run):**
```
https://algoai-backend-606435458040.asia-south1.run.app
```

**Development (Local):**
```
http://localhost:8080
```

---

## 🔑 Authentication Endpoints

### Login
```http
POST https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login
Content-Type: application/json

{
  "id_token": "firebase_id_token_here"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_uid",
    "email": "user@example.com",
    "name": "User Name",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  },
  "token": "jwt_token_here"
}
```

### Register
```http
POST https://algoai-backend-606435458040.asia-south1.run.app/api/auth/register
Content-Type: application/json

{
  "id_token": "firebase_id_token_here",
  "name": "User Name"
}
```

**Response:**
```json
{
  "uid": "user_uid",
  "email": "user@example.com",
  "name": "User Name"
}
```

### Verify Token
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/auth/verify
Authorization: Bearer firebase_id_token_here
```

---

## 📊 Backtesting Endpoints

### Run Backtest
```http
POST https://algoai-backend-606435458040.asia-south1.run.app/api/backtesting/run
Authorization: Bearer firebase_id_token_here
Content-Type: application/json

{
  "strategy_id": "strategy_id",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 100000,
  "symbols": ["RELIANCE", "TCS"]
}
```

### Get Backtest Results
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/backtesting/results/{result_id}
Authorization: Bearer firebase_id_token_here
```

### List Backtest Results
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/backtesting/results
Authorization: Bearer firebase_id_token_here
```

---

## 📈 Strategy Endpoints

### List Strategies
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/strategies
Authorization: Bearer firebase_id_token_here
```

### Create Strategy
```http
POST https://algoai-backend-606435458040.asia-south1.run.app/api/strategies
Authorization: Bearer firebase_id_token_here
Content-Type: application/json

{
  "name": "Strategy Name",
  "description": "Strategy description",
  "strategy_type": "moving_average",
  "parameters": {
    "fast_period": 10,
    "slow_period": 20
  }
}
```

### Get Strategy
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/strategies/{strategy_id}
Authorization: Bearer firebase_id_token_here
```

### Update Strategy
```http
PUT https://algoai-backend-606435458040.asia-south1.run.app/api/strategies/{strategy_id}
Authorization: Bearer firebase_id_token_here
Content-Type: application/json

{
  "name": "Updated Strategy Name",
  "parameters": {
    "fast_period": 15,
    "slow_period": 30
  }
}
```

### Delete Strategy
```http
DELETE https://algoai-backend-606435458040.asia-south1.run.app/api/strategies/{strategy_id}
Authorization: Bearer firebase_id_token_here
```

---

## 💼 Portfolio Endpoints

### Get Portfolio
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/portfolio
Authorization: Bearer firebase_id_token_here
```

### Get Portfolio Holdings
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/portfolio/holdings
Authorization: Bearer firebase_id_token_here
```

### Get Portfolio Performance
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/portfolio/performance
Authorization: Bearer firebase_id_token_here
```

---

## 📋 Order Endpoints

### Create Order
```http
POST https://algoai-backend-606435458040.asia-south1.run.app/api/orders
Authorization: Bearer firebase_id_token_here
Content-Type: application/json

{
  "symbol": "RELIANCE",
  "quantity": 10,
  "order_type": "MARKET",
  "transaction_type": "BUY",
  "strategy_id": "strategy_id"
}
```

### List Orders
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/orders
Authorization: Bearer firebase_id_token_here
```

### Get Order
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/orders/{order_id}
Authorization: Bearer firebase_id_token_here
```

### Cancel Order
```http
DELETE https://algoai-backend-606435458040.asia-south1.run.app/api/orders/{order_id}
Authorization: Bearer firebase_id_token_here
```

---

## 📊 Historical Data Endpoints

### Get Historical Data
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/historical-data
Authorization: Bearer firebase_id_token_here
?symbol=RELIANCE&start_date=2024-01-01&end_date=2024-12-31&interval=1day
```

---

## 📚 Strategy Templates Endpoints

### List Templates
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/strategy-templates
Authorization: Bearer firebase_id_token_here
```

### Get Template
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/api/strategy-templates/{template_id}
Authorization: Bearer firebase_id_token_here
```

---

## 🏥 Health & Info Endpoints

### Health Check
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "AlgoAI Backend",
  "version": "0.1.0"
}
```

### Root Endpoint
```http
GET https://algoai-backend-606435458040.asia-south1.run.app/
```

**Response:**
```json
{
  "message": "Welcome to AlgoAI Backend",
  "version": "0.1.0",
  "status": "running"
}
```

---

## 📖 API Documentation

### Swagger UI (Interactive Docs)
```
https://algoai-backend-606435458040.asia-south1.run.app/docs
```

### ReDoc (Alternative Docs)
```
https://algoai-backend-606435458040.asia-south1.run.app/redoc
```

---

## 🔐 Authentication

All protected endpoints require a Firebase ID token in the Authorization header:

```http
Authorization: Bearer <firebase_id_token>
```

**How to get Firebase ID token:**
- **Frontend**: After Firebase login, call `user.getIdToken()`
- **Mobile**: After Firebase Auth, get the ID token from the user object

---

## 📱 Quick Reference for Mobile App

### Android/Kotlin
```kotlin
object ApiConfig {
    const val BASE_URL = "https://algoai-backend-606435458040.asia-south1.run.app"
    const val API_BASE_URL = "$BASE_URL/api"
}
```

### iOS/Swift
```swift
struct ApiConfig {
    static let baseURL = "https://algoai-backend-606435458040.asia-south1.run.app"
    static let apiBaseURL = "\(baseURL)/api"
}
```

### React Native
```typescript
export const API_BASE_URL = 'https://algoai-backend-606435458040.asia-south1.run.app/api';
```

### Flutter
```dart
class ApiConfig {
  static const String baseUrl = 'https://algoai-backend-606435458040.asia-south1.run.app';
  static const String apiBaseUrl = '$baseUrl/api';
}
```

---

## 🌐 Quick Reference for Frontend Web App

Update `.env.production`:
```bash
NEXT_PUBLIC_API_URL=https://algoai-backend-606435458040.asia-south1.run.app
```

The API client will automatically use this URL for all requests.

---

## 🧪 Testing Endpoints

### Test Health Check
```bash
curl https://algoai-backend-606435458040.asia-south1.run.app/health
```

### Test Authentication (with token)
```bash
curl -X POST https://algoai-backend-606435458040.asia-south1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id_token":"your_firebase_token"}'
```

---

## 📝 Notes

1. **HTTPS**: All endpoints use HTTPS (Cloud Run default)
2. **CORS**: Configured to allow requests from your frontend domain
3. **Timeout**: 300 seconds (5 minutes) for long-running requests
4. **Rate Limiting**: No rate limiting configured (can be added if needed)
5. **Authentication**: Firebase ID tokens are required for protected endpoints

---

## 🔗 Resources

- **API Docs**: https://algoai-backend-606435458040.asia-south1.run.app/docs
- **Health Check**: https://algoai-backend-606435458040.asia-south1.run.app/health
- **Backend Repo**: https://github.com/mumbaionweb/algoai-backend
- **Frontend Repo**: https://github.com/mumbaionweb/algoai-frontend

