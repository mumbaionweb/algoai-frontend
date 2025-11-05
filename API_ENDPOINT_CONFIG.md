# API Endpoint Configuration Guide

## 📱 For Mobile App & 🌐 For Frontend Web App

### Cloud Run API Endpoint

Your backend is deployed on **Google Cloud Run** with the following configuration:

- **Project ID**: `algo-ai-477010`
- **Service Name**: `algoai-backend`
- **Region**: `asia-south1` (Mumbai)

### Finding Your Cloud Run URL

**Option 1: Using gcloud CLI**
```bash
gcloud run services describe algoai-backend \
  --region=asia-south1 \
  --format='value(status.url)'
```

**Option 2: Using GCP Console**
1. Go to: https://console.cloud.google.com/run?project=algo-ai-477010
2. Click on `algoai-backend` service
3. Copy the **Service URL**

**Expected URL Format:**
```
https://algoai-backend-xxxxx-ew.asia-south1.run.app
```

---

## 🌐 Frontend Web App Configuration

### Step 1: Create Environment Files

Create `.env.local` for local development:
```bash
# .env.local (for local development)
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Create `.env.production` for production build:
```bash
# .env.production (for production deployment)
NEXT_PUBLIC_API_URL=https://algoai-backend-xxxxx-ew.asia-south1.run.app
```

**Note**: Replace `xxxxx` with your actual Cloud Run service hash.

### Step 2: Update Vercel Environment Variables (if using Vercel)

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://algoai-backend-xxxxx-ew.asia-south1.run.app`
   - **Environment**: Production, Preview, Development

### Step 3: Update Firebase Hosting (if using Firebase Hosting)

In `firebase.json` or during build, set:
```bash
NEXT_PUBLIC_API_URL=https://algoai-backend-xxxxx-ew.asia-south1.run.app
```

---

## 📱 Mobile App Configuration

### Android (Kotlin/Java)

**File**: `app/src/main/java/com/yourpackage/config/ApiConfig.kt`
```kotlin
object ApiConfig {
    // Production Cloud Run URL
    const val BASE_URL = "https://algoai-backend-xxxxx-ew.asia-south1.run.app"
    const val API_BASE_URL = "$BASE_URL/api"
    
    // For local testing (optional)
    // const val BASE_URL = "http://10.0.2.2:8080" // Android emulator
    // const val BASE_URL = "http://YOUR_LOCAL_IP:8080" // Physical device
}
```

**Usage in Retrofit:**
```kotlin
val apiService = Retrofit.Builder()
    .baseUrl(ApiConfig.API_BASE_URL)
    .addConverterFactory(GsonConverterFactory.create())
    .build()
    .create(ApiService::class.java)
```

### iOS (Swift)

**File**: `Config.swift`
```swift
struct ApiConfig {
    static let baseURL = "https://algoai-backend-xxxxx-ew.asia-south1.run.app"
    static let apiBaseURL = "\(baseURL)/api"
    
    // For local testing (optional)
    // static let baseURL = "http://localhost:8080"
}
```

**Usage:**
```swift
let url = URL(string: "\(ApiConfig.apiBaseURL)/auth/login")!
```

### React Native

**File**: `src/config/api.ts`
```typescript
// Production
export const API_BASE_URL = 'https://algoai-backend-xxxxx-ew.asia-south1.run.app/api';

// For local development (optional)
// export const API_BASE_URL = 'http://localhost:8080/api';
```

### Flutter

**File**: `lib/config/api_config.dart`
```dart
class ApiConfig {
  // Production Cloud Run URL
  static const String baseUrl = 'https://algoai-backend-xxxxx-ew.asia-south1.run.app';
  static const String apiBaseUrl = '$baseUrl/api';
  
  // For local testing (optional)
  // static const String baseUrl = 'http://localhost:8080';
}
```

---

## 🔑 Key API Endpoints

### Authentication
- **Login**: `POST /api/auth/login`
- **Register**: `POST /api/auth/register`
- **Verify Token**: `GET /api/auth/verify`

### Backtesting
- **Run Backtest**: `POST /api/backtesting/run`
- **Get Results**: `GET /api/backtesting/results/{id}`

### Strategies
- **List Strategies**: `GET /api/strategies`
- **Create Strategy**: `POST /api/strategies`
- **Update Strategy**: `PUT /api/strategies/{id}`

### Health Check
- **Health**: `GET /health`

### API Documentation
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

---

## 🔄 Environment Switching

### Development (Local)
```bash
# Backend running on localhost
API_URL=http://localhost:8080
```

### Production (Cloud Run)
```bash
# Deployed backend on Cloud Run
API_URL=https://algoai-backend-xxxxx-ew.asia-south1.run.app
```

---

## 🧪 Testing Connectivity

### Test from Command Line
```bash
# Health check
curl https://algoai-backend-xxxxx-ew.asia-south1.run.app/health

# Expected response
{
  "status": "healthy",
  "service": "AlgoAI Backend",
  "version": "0.1.0"
}
```

### Test from Browser
Open: `https://algoai-backend-xxxxx-ew.asia-south1.run.app/docs`

---

## 🔒 Security Notes

1. **HTTPS Only**: Cloud Run provides HTTPS by default ✅
2. **CORS**: Configured in backend to allow your frontend domain
3. **Authentication**: Use Firebase ID tokens in `Authorization: Bearer <token>` header
4. **API Keys**: Zerodha keys stored securely in Secret Manager

---

## 📋 Quick Checklist

### For Frontend Web App:
- [ ] Get Cloud Run service URL
- [ ] Create `.env.production` with `NEXT_PUBLIC_API_URL`
- [ ] Create `.env.local` with `http://localhost:8080` for development
- [ ] Update Vercel/Firebase Hosting environment variables
- [ ] Test API connectivity
- [ ] Deploy frontend

### For Mobile App:
- [ ] Get Cloud Run service URL
- [ ] Update `BASE_URL` in app config
- [ ] Test authentication endpoints
- [ ] Test API connectivity
- [ ] Build and deploy mobile app

---

## 🚀 Next Steps

1. **Get your actual Cloud Run URL** (see commands above)
2. **Update configurations** in both mobile and web apps
3. **Test connectivity** from both platforms
4. **Deploy** your applications

---

## ❓ Troubleshooting

### Connection Refused
- Check if Cloud Run service is deployed
- Verify the URL is correct
- Check CORS settings in backend

### 404 Not Found
- Verify the endpoint path is correct
- Check if service is running: `gcloud run services list --region=asia-south1`

### Authentication Errors
- Verify Firebase token is being sent correctly
- Check token format: `Authorization: Bearer <token>`
- Verify backend can verify Firebase tokens

---

## 📞 Resources

- [Cloud Run Console](https://console.cloud.google.com/run?project=algo-ai-477010)
- [API Documentation](https://algoai-backend-xxxxx-ew.asia-south1.run.app/docs)
- Backend Repository: https://github.com/mumbaionweb/algoai-backend
- Frontend Repository: https://github.com/mumbaionweb/algoai-frontend

