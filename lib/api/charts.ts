import { apiClient } from './client';

export interface OHLCDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartDataResponse {
  symbol: string;
  exchange: string;
  data: OHLCDataPoint[];
  interval?: string;
}

/**
 * Get live market OHLC data
 * @param symbol Symbol (e.g., 'RELIANCE')
 * @param exchange Exchange (e.g., 'NSE')
 * @param interval Interval (e.g., 'day', 'minute', '5minute')
 * @param fromDate Start date (YYYY-MM-DD)
 * @param toDate End date (YYYY-MM-DD)
 * @returns OHLC data points
 */
export async function getLiveMarketData(
  symbol: string,
  exchange: string = 'NSE',
  interval: string = 'day',
  fromDate?: string,
  toDate?: string
): Promise<OHLCDataPoint[]> {
  try {
    const params = new URLSearchParams();
    params.append('symbol', symbol);
    params.append('exchange', exchange);
    params.append('interval', interval);
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const response = await apiClient.get<Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }>>(`/api/market-data/ohlc?${params.toString()}`);
    
    // Convert response to OHLCDataPoint format
    return response.data.map((point) => ({
      date: point.date,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
    }));
  } catch (error) {
    console.error('[CHARTS] Error fetching live market data:', error);
    throw error;
  }
}

/**
 * Get historical data for charts
 * @param symbol Symbol
 * @param exchange Exchange
 * @param fromDate Start date (YYYY-MM-DD)
 * @param toDate End date (YYYY-MM-DD)
 * @param interval Interval (default: 'day')
 * @returns Historical data
 */
export async function getHistoricalData(
  symbol: string,
  exchange: string = 'NSE',
  fromDate: string,
  toDate: string,
  interval: string = 'day'
): Promise<OHLCDataPoint[]> {
  try {
    const response = await apiClient.post<{ data: any }>('/api/historical-data/fetch', {
      symbol,
      exchange,
      from_date: fromDate,
      to_date: toDate,
      interval,
    });

    // Convert response data to OHLCDataPoint format
    // The response.data structure may vary, so we need to handle it
    if (Array.isArray(response.data.data)) {
      return response.data.data.map((point: any) => ({
        date: point.date || point.timestamp || point.time,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
      }));
    }

    // If data is in a different format, try to extract it
    const data = response.data.data;
    if (data && typeof data === 'object') {
      // Handle different response formats
      return [];
    }

    return [];
  } catch (error) {
    console.error('[CHARTS] Error fetching historical data:', error);
    throw error;
  }
}

/**
 * Get backtest data for charts
 * @param strategyId Strategy ID
 * @param backtestId Optional backtest ID or job ID (if not provided, gets latest)
 * @returns Backtest OHLC data
 */
export async function getBacktestData(
  strategyId: string,
  backtestId?: string
): Promise<OHLCDataPoint[]> {
  try {
    let jobId: string | undefined;

    // First, get the backtest job
    if (backtestId) {
      jobId = backtestId;
    } else {
      // Get latest backtest job for strategy
      const response = await apiClient.get(`/api/backtesting/jobs?strategy_id=${strategyId}&limit=1`);
      const jobs = response.data.jobs || [];
      if (jobs.length > 0) {
        jobId = jobs[0].job_id || jobs[0].id;
      }
    }

    if (!jobId) {
      return [];
    }

    // Fetch historical data from backtest
    try {
      const histResponse = await apiClient.get<Array<{
        date?: string;
        timestamp?: string;
        time?: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume?: number;
      }>>(`/api/backtesting/jobs/${jobId}/historical-data?limit=1000&format=json`);
      
      if (histResponse.data && Array.isArray(histResponse.data)) {
        return histResponse.data.map((point: any) => ({
          date: point.date || point.timestamp || point.time || new Date().toISOString(),
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume,
        }));
      }
    } catch (err) {
      console.warn('[CHARTS] Could not fetch backtest historical data:', err);
    }

    return [];
  } catch (error) {
    console.error('[CHARTS] Error fetching backtest data:', error);
    throw error;
  }
}

/**
 * Get mock run data (simulated live data)
 * @param symbol Symbol
 * @param exchange Exchange
 * @returns Mock OHLC data
 */
export async function getMockRunData(
  symbol: string,
  exchange: string = 'NSE'
): Promise<OHLCDataPoint[]> {
  try {
    // Mock run data is similar to live data but may use different source
    // For now, use the same endpoint as live data
    // TODO: Implement dedicated mock run endpoint if needed
    return getLiveMarketData(symbol, exchange, 'day');
  } catch (error) {
    console.error('[CHARTS] Error fetching mock run data:', error);
    throw error;
  }
}

