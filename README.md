# AlgoAI Frontend

Next.js frontend for the AlgoAI algorithmic trading platform.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **TypeScript:** Yes
- **State Management:** Zustand
- **API Client:** Axios
- **Firebase:** Authentication
- **Charts:** TradingView Lightweight Charts

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Firebase credentials
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:3000
   ```

## Project Structure

- `app/` - Next.js App Router pages
- `components/` - React components
- `lib/` - Utilities and API clients
- `store/` - Zustand state management
- `types/` - TypeScript type definitions

## Backend Integration

The frontend connects to the FastAPI backend at:
- Development: `http://localhost:8080`
- Production: `https://algoai-backend-sbqvzhslha-el.a.run.app`

## Features

- ✅ Authentication (Firebase)
- ✅ Dashboard
- ✅ Strategy Management (coming soon)
- ✅ Portfolio View (coming soon)
- ✅ Order Management (coming soon)
- ✅ Backtesting (coming soon)
