'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  UTCTimestamp,
  CandlestickSeries,
  HistogramSeries
} from 'lightweight-charts';
import type { Strategy } from '@/types';
import { getLiveMarketData, getMockRunData, getBacktestData, type OHLCDataPoint } from '@/lib/api/charts';
import { updateStrategy } from '@/lib/api/strategies';
import { apiClient } from '@/lib/api/client';

interface ChartsProps {
  currentStrategy: Strategy | null;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
  onStrategyUpdate?: () => void;
}

type ChartDataType = 'live' | 'mock' | 'backtest';

interface ChartDebugInfo {
  strategyId: string | null;
  chartType: ChartDataType;
  dataPoints: number;
  dataSource: string;
  symbol?: string;
  exchange?: string;
  backtestJobs?: number;
  lastUpdated?: string;
  errors?: string[];
}

export default function Charts({ currentStrategy, marketType = 'equity', onStrategyUpdate }: ChartsProps) {
  const [chartType, setChartType] = useState<ChartDataType>('live');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<ChartDebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [backtestJobsCount, setBacktestJobsCount] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastStrategyIdRef = useRef<string | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series using addSeries with series definition
    // In lightweight-charts v5, we use addSeries with the series definition constant
    const candlestickSeriesInstance = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Create volume histogram series
    const volumeSeriesInstance = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeriesInstance;
    volumeSeriesRef.current = volumeSeriesInstance;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Load chart config when strategy changes
  useEffect(() => {
    if (!currentStrategy?.id) {
      console.log('[CHARTS] No strategy selected');
      setDebugInfo(null);
      return;
    }

    const strategyId = currentStrategy.id;
    console.log('[CHARTS] Strategy changed:', {
      strategyId,
      previousStrategyId: lastStrategyIdRef.current,
      hasParameters: !!currentStrategy.parameters,
      hasChartConfig: !!currentStrategy.parameters?.chart_config,
      chartConfig: currentStrategy.parameters?.chart_config
    });

    // Load saved chart type from strategy config
    if (currentStrategy.parameters?.chart_config?.chartType) {
      const savedChartType = currentStrategy.parameters.chart_config.chartType as ChartDataType;
      console.log('[CHARTS] Loading saved chart type from strategy:', savedChartType);
      setChartType(savedChartType);
    } else {
      // Default to 'live' if no saved config
      console.log('[CHARTS] No saved chart config, using default: live');
      setChartType('live');
    }

    lastStrategyIdRef.current = strategyId;

    // Fetch backtest jobs count for debugging
    fetchBacktestJobsCount(strategyId);
  }, [currentStrategy?.id]);

  // Load chart data based on type
  useEffect(() => {
    if (!currentStrategy?.id || !chartRef.current || !candlestickSeriesRef.current) {
      console.log('[CHARTS] Skipping load - missing requirements:', {
        hasStrategyId: !!currentStrategy?.id,
        hasChartRef: !!chartRef.current,
        hasCandlestickSeries: !!candlestickSeriesRef.current
      });
      return;
    }

    console.log('[CHARTS] Loading chart data:', {
      strategyId: currentStrategy.id,
      chartType,
      marketType
    });

    loadChartData(chartType);
  }, [chartType, currentStrategy?.id, marketType]);

  // Save chart configuration when chart type changes
  const saveChartConfig = useCallback(async (newChartType: ChartDataType) => {
    if (!currentStrategy?.id) return;

    try {
      const currentParams = currentStrategy.parameters || {};
      const chartConfig = {
        ...currentParams.chart_config,
        chartType: newChartType,
        lastUpdated: new Date().toISOString()
      };

      console.log('[CHARTS] Saving chart configuration:', {
        strategyId: currentStrategy.id,
        chartType: newChartType,
        chartConfig
      });

      await updateStrategy(
        currentStrategy.id,
        {
          parameters: {
            ...currentParams,
            chart_config: chartConfig
          }
        },
        true // auto_save
      );

      console.log('[CHARTS] Chart configuration saved successfully');
      
      // Refresh strategy to get updated config
      if (onStrategyUpdate) {
        onStrategyUpdate();
      }
    } catch (err: any) {
      console.error('[CHARTS] Failed to save chart configuration:', err);
    }
  }, [currentStrategy?.id, onStrategyUpdate]);

  // Fetch backtest jobs count for debugging
  const fetchBacktestJobsCount = async (strategyId: string) => {
    try {
      console.log('[CHARTS] Fetching backtest jobs for strategy:', strategyId);
      const response = await apiClient.get(`/api/backtesting/jobs?strategy_id=${strategyId}&limit=10`);
      const jobs = response.data.jobs || [];
      setBacktestJobsCount(jobs.length);
      console.log('[CHARTS] Found backtest jobs:', {
        strategyId,
        count: jobs.length,
        jobs: jobs.map((j: any) => ({
          job_id: j.job_id || j.id,
          status: j.status,
          created_at: j.created_at
        }))
      });
    } catch (err: any) {
      console.error('[CHARTS] Error fetching backtest jobs:', err);
      setBacktestJobsCount(null);
    }
  };

  const loadChartData = async (type: ChartDataType) => {
    if (!currentStrategy?.id) {
      console.warn('[CHARTS] Cannot load chart data - no strategy ID');
      return;
    }

    const strategyId = currentStrategy.id;
    console.log('[CHARTS] ========================================');
    console.log('[CHARTS] Loading chart data:', {
      strategyId,
      chartType: type,
      marketType,
      timestamp: new Date().toISOString()
    });

    setLoading(true);
    setError(null);
    setDebugInfo({
      strategyId,
      chartType: type,
      dataPoints: 0,
      dataSource: 'loading...',
      symbol: currentStrategy.parameters?.symbol,
      exchange: currentStrategy.parameters?.exchange,
      backtestJobs: backtestJobsCount || undefined,
      lastUpdated: new Date().toISOString()
    });

    try {
      let data: OHLCDataPoint[] = [];
      let dataSource = '';

      switch (type) {
        case 'live':
          console.log('[CHARTS] Fetching LIVE market data...');
          data = await fetchLiveMarketData();
          dataSource = 'Live Market Data API';
          break;
        case 'mock':
          console.log('[CHARTS] Fetching MOCK run data...');
          data = await fetchMockRunData();
          dataSource = 'Mock Run Data API';
          break;
        case 'backtest':
          console.log('[CHARTS] Fetching BACKTEST data...');
          data = await fetchBacktestData();
          dataSource = 'Backtest Historical Data API';
          break;
      }

      console.log('[CHARTS] Data fetched:', {
        strategyId,
        chartType: type,
        dataPoints: data.length,
        dataSource,
        firstDataPoint: data[0] ? {
          date: data[0].date,
          open: data[0].open,
          close: data[0].close
        } : null,
        lastDataPoint: data[data.length - 1] ? {
          date: data[data.length - 1].date,
          open: data[data.length - 1].open,
          close: data[data.length - 1].close
        } : null
      });

      if (data.length > 0 && candlestickSeriesRef.current && volumeSeriesRef.current) {
        // Convert OHLCDataPoint to TradingView format
        const candlestickData: CandlestickData[] = data.map((point) => {
          // Parse date string to timestamp
          let timestamp: number;
          if (typeof point.date === 'string') {
            timestamp = new Date(point.date).getTime() / 1000;
          } else {
            timestamp = point.date as number / 1000;
          }

          return {
            time: timestamp as UTCTimestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
          };
        });

        const volumeData = data
          .filter((point) => point.volume !== undefined)
          .map((point) => {
            let timestamp: number;
            if (typeof point.date === 'string') {
              timestamp = new Date(point.date).getTime() / 1000;
            } else {
              timestamp = point.date as number / 1000;
            }

            return {
              time: timestamp as UTCTimestamp,
              value: point.volume!,
              color: point.close >= point.open ? '#26a69a80' : '#ef535080',
            };
          });

        console.log('[CHARTS] Setting chart data:', {
          strategyId,
          candlestickDataPoints: candlestickData.length,
          volumeDataPoints: volumeData.length,
          timeRange: {
            start: candlestickData[0]?.time,
            end: candlestickData[candlestickData.length - 1]?.time
          }
        });

        candlestickSeriesRef.current.setData(candlestickData);
        if (volumeData.length > 0) {
          volumeSeriesRef.current.setData(volumeData);
        }

        // Fit content
        chartRef.current?.timeScale().fitContent();

        // Update debug info
        setDebugInfo({
          strategyId,
          chartType: type,
          dataPoints: data.length,
          dataSource,
          symbol: currentStrategy.parameters?.symbol,
          exchange: currentStrategy.parameters?.exchange,
          backtestJobs: backtestJobsCount || undefined,
          lastUpdated: new Date().toISOString()
        });

        console.log('[CHARTS] Chart data loaded successfully:', {
          strategyId,
          chartType: type,
          dataPoints: data.length,
          dataSource
        });
      } else {
        console.warn('[CHARTS] No data or chart series not ready:', {
          strategyId,
          dataLength: data.length,
          hasCandlestickSeries: !!candlestickSeriesRef.current,
          hasVolumeSeries: !!volumeSeriesRef.current
        });
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to load chart data';
      const statusCode = err.response?.status;
      const isOAuthError = errorDetail.includes('Access token') || errorDetail.includes('OAuth') || errorDetail.includes('broker account');
      
      // Error message should already be set by fetchLiveMarketData or other fetch functions
      // But set a fallback if not set
      if (!error) {
        if (isOAuthError) {
          setError('Broker account not connected. Please complete OAuth flow to view live market data.');
        } else {
          setError(errorDetail);
        }
      }
      
      console.error('[CHARTS] ❌ Error loading chart data:', {
        strategyId,
        chartType: type,
        statusCode,
        errorType: isOAuthError ? 'OAuth/Authentication Error' : 'Other Error',
        errorMessage: err.message,
        errorDetail,
        responseData: err.response?.data,
        stack: err.stack,
        fullError: err
      });
      
      setDebugInfo({
        strategyId,
        chartType: type,
        dataPoints: 0,
        dataSource: 'Error',
        symbol: currentStrategy.parameters?.symbol,
        exchange: currentStrategy.parameters?.exchange,
        backtestJobs: backtestJobsCount || undefined,
        lastUpdated: new Date().toISOString(),
        errors: [errorDetail]
      });
    } finally {
      setLoading(false);
      console.log('[CHARTS] ========================================');
    }
  };

  const fetchLiveMarketData = async (): Promise<OHLCDataPoint[]> => {
    if (!currentStrategy?.parameters?.symbol) {
      console.warn('[CHARTS] Cannot fetch live market data - no symbol in strategy parameters');
      const errorMsg = 'No symbol configured in strategy parameters. Please set a symbol to view live market data.';
      setError(errorMsg);
      return [];
    }

    const strategyId = currentStrategy.id;
    const symbol = currentStrategy.parameters.symbol;
    const exchange = currentStrategy.parameters.exchange || 'NSE';
    
    console.log('[CHARTS] ========================================');
    console.log('[CHARTS] Fetching live market data:', {
      strategyId,
      symbol,
      exchange,
      marketType,
      timestamp: new Date().toISOString()
    });

    try {
      // Get last 30 days of data
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);

      console.log('[CHARTS] Live market data request details:', {
        strategyId,
        symbol,
        exchange,
        interval: 'day',
        fromDate: fromDate.toISOString().split('T')[0],
        toDate: toDate.toISOString().split('T')[0],
        dateRange: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`
      });

      const data = await getLiveMarketData(
        symbol,
        exchange,
        'day',
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0]
      );

      console.log('[CHARTS] ✅ Live market data received successfully:', {
        strategyId,
        symbol,
        exchange,
        dataPoints: data.length,
        sampleData: data.slice(0, 3),
        dataRange: data.length > 0 ? {
          first: data[0].date,
          last: data[data.length - 1].date
        } : null
      });

      // Clear any previous errors
      setError(null);
      return data;
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || err.message || 'Unknown error';
      const statusCode = err.response?.status;
      const isOAuthError = errorDetail.includes('Access token') || errorDetail.includes('OAuth') || errorDetail.includes('broker account');
      
      console.error('[CHARTS] ❌ Error fetching live market data:', {
        strategyId,
        symbol,
        exchange,
        statusCode,
        errorType: isOAuthError ? 'OAuth/Authentication Error' : 'Other Error',
        errorMessage: err.message,
        errorDetail,
        responseData: err.response?.data,
        fullError: err
      });

      // Set user-friendly error message
      if (isOAuthError) {
        const oauthErrorMsg = 'Broker account not connected. Please complete OAuth flow to connect your broker account and view live market data.';
        setError(oauthErrorMsg);
        console.warn('[CHARTS] ⚠️ OAuth error detected - user needs to connect broker account');
      } else if (statusCode === 400) {
        setError(`Failed to fetch market data: ${errorDetail}`);
      } else if (statusCode === 404) {
        setError(`Market data not found for ${symbol} on ${exchange}. Please check the symbol and exchange.`);
      } else if (statusCode === 500) {
        setError('Server error while fetching market data. Please try again later.');
      } else {
        setError(`Failed to fetch live market data: ${errorDetail}`);
      }

      // Don't fallback to mock data automatically - let user see the error
      // Only return empty array so error is visible
      console.log('[CHARTS] Not falling back to mock data - showing error to user');
      throw err; // Re-throw to let loadChartData handle it
    }
  };

  const fetchMockRunData = async (): Promise<OHLCDataPoint[]> => {
    if (!currentStrategy?.parameters?.symbol) {
      console.warn('[CHARTS] Cannot fetch mock run data - no symbol in strategy parameters');
      return [];
    }

    const strategyId = currentStrategy.id;
    const symbol = currentStrategy.parameters.symbol;
    const exchange = currentStrategy.parameters.exchange || 'NSE';
    
    console.log('[CHARTS] Fetching mock run data:', {
      strategyId,
      symbol,
      exchange
    });

    try {
      const data = await getMockRunData(symbol, exchange);
      console.log('[CHARTS] Mock run data received:', {
        strategyId,
        symbol,
        dataPoints: data.length
      });
      return data;
    } catch (err: any) {
      console.error('[CHARTS] Error fetching mock run data:', {
        strategyId,
        symbol,
        exchange,
        error: err,
        errorMessage: err.message
      });
      // Fallback to mock data on error
      console.log('[CHARTS] Falling back to generated mock data');
      return generateMockData('mock');
    }
  };

  const fetchBacktestData = async (): Promise<OHLCDataPoint[]> => {
    if (!currentStrategy?.id) {
      console.warn('[CHARTS] Cannot fetch backtest data - no strategy ID');
      return [];
    }

    const strategyId = currentStrategy.id;
    console.log('[CHARTS] Fetching backtest data:', {
      strategyId,
      backtestJobsAvailable: backtestJobsCount
    });

    try {
      // First check for backtest jobs
      try {
        const jobsResponse = await apiClient.get(`/api/backtesting/jobs?strategy_id=${strategyId}&limit=5`);
        const jobs = jobsResponse.data.jobs || [];
        console.log('[CHARTS] Backtest jobs found:', {
          strategyId,
          jobsCount: jobs.length,
          jobs: jobs.map((j: any) => ({
            job_id: j.job_id || j.id,
            status: j.status,
            created_at: j.created_at,
            symbol: j.symbol,
            from_date: j.from_date,
            to_date: j.to_date
          }))
        });

        if (jobs.length === 0) {
          console.warn('[CHARTS] No backtest jobs found for strategy:', strategyId);
        }
      } catch (jobsErr: any) {
        console.warn('[CHARTS] Could not fetch backtest jobs list:', {
          strategyId,
          error: jobsErr.message
        });
      }

      const data = await getBacktestData(strategyId);
      console.log('[CHARTS] Backtest data received:', {
        strategyId,
        dataPoints: data.length,
        hasData: data.length > 0,
        sampleData: data.slice(0, 3)
      });

      if (data.length > 0) {
        return data;
      }
      
      // Fallback to mock data if no backtest data available
      console.warn('[CHARTS] No backtest data available, using mock data');
      return generateMockData('backtest');
    } catch (err: any) {
      console.error('[CHARTS] Error fetching backtest data:', {
        strategyId,
        error: err,
        errorMessage: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      // Fallback to mock data on error
      console.log('[CHARTS] Falling back to generated mock data');
      return generateMockData('backtest');
    }
  };

  // Generate mock data for demonstration
  const generateMockData = (type: ChartDataType): OHLCDataPoint[] => {
    const data: OHLCDataPoint[] = [];
    const now = new Date();
    const basePrice = 2500; // Example base price
    let currentPrice = basePrice;

    // Generate 100 data points
    for (let i = 99; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const change = (Math.random() - 0.5) * 20; // Random price change
      currentPrice = Math.max(100, currentPrice + change);

      const open = currentPrice;
      const close = open + (Math.random() - 0.5) * 10;
      const high = Math.max(open, close) + Math.random() * 5;
      const low = Math.min(open, close) - Math.random() * 5;
      const volume = Math.floor(Math.random() * 1000000) + 100000;

      data.push({
        date: dateStr,
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return data;
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col min-h-0">
      {/* Header with chart type selector */}
      <div className="border-b border-gray-700 p-4 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-white">Charts</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              console.log('[CHARTS] Switching to Live Market chart');
              setChartType('live');
              saveChartConfig('live');
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chartType === 'live'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Live Market
          </button>
          <button
            onClick={() => {
              console.log('[CHARTS] Switching to Mock Run chart');
              setChartType('mock');
              saveChartConfig('mock');
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chartType === 'mock'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Mock Run
          </button>
          <button
            onClick={() => {
              console.log('[CHARTS] Switching to Backtest chart');
              setChartType('backtest');
              saveChartConfig('backtest');
            }}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chartType === 'backtest'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Backtest {backtestJobsCount !== null && `(${backtestJobsCount})`}
          </button>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showDebug
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Toggle debug info"
          >
            🐛 Debug
          </button>
          <button
            onClick={() => loadChartData(chartType)}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh chart data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 relative min-h-0" ref={chartContainerRef}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center">
              <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-sm text-gray-400">Loading chart data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center p-6 max-w-md">
              <div className="mb-4">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-400 font-medium mb-2">{error}</p>
                {error.includes('OAuth') || error.includes('broker account') ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-gray-400">
                      To view live market data, you need to connect your broker account.
                    </p>
                    <a
                      href="/dashboard/broker-credentials"
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      Connect Broker Account
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      console.log('[CHARTS] Retrying chart data load:', { chartType });
                      setError(null);
                      loadChartData(chartType);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!currentStrategy?.id && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400">Select a strategy to view charts</p>
          </div>
        )}
      </div>

      {/* Debug Info Panel */}
      {showDebug && debugInfo && (
        <div className="border-t border-gray-700 bg-gray-800 p-3 text-xs text-gray-300 flex-shrink-0 max-h-48 overflow-y-auto">
          <div className="font-semibold text-white mb-2">🐛 Chart Debug Info</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Strategy ID:</span>
              <span className="ml-2 font-mono text-yellow-400">{debugInfo.strategyId || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Chart Type:</span>
              <span className="ml-2 text-blue-400">{debugInfo.chartType}</span>
            </div>
            <div>
              <span className="text-gray-500">Data Points:</span>
              <span className="ml-2 text-green-400">{debugInfo.dataPoints}</span>
            </div>
            <div>
              <span className="text-gray-500">Data Source:</span>
              <span className="ml-2 text-purple-400">{debugInfo.dataSource}</span>
            </div>
            <div>
              <span className="text-gray-500">Symbol:</span>
              <span className="ml-2">{debugInfo.symbol || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Exchange:</span>
              <span className="ml-2">{debugInfo.exchange || 'N/A'}</span>
            </div>
            {debugInfo.backtestJobs !== undefined && (
              <div>
                <span className="text-gray-500">Backtest Jobs:</span>
                <span className="ml-2 text-cyan-400">{debugInfo.backtestJobs}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Last Updated:</span>
              <span className="ml-2 text-gray-400">{debugInfo.lastUpdated ? new Date(debugInfo.lastUpdated).toLocaleTimeString() : 'N/A'}</span>
            </div>
            {debugInfo.errors && debugInfo.errors.length > 0 && (
              <div className="col-span-2">
                <span className="text-red-400">Errors:</span>
                <ul className="list-disc list-inside ml-2 text-red-300">
                  {debugInfo.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Info */}
      {currentStrategy?.id && !loading && !error && (
        <div className="border-t border-gray-700 p-2 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
          <div className="flex gap-4">
            <span>Strategy ID: <span className="font-mono text-yellow-400">{currentStrategy.id}</span></span>
            <span>Symbol: {currentStrategy.parameters?.symbol || 'N/A'}</span>
            <span>Exchange: {currentStrategy.parameters?.exchange || 'N/A'}</span>
            <span>Type: {chartType === 'live' ? 'Live Market Data' : chartType === 'mock' ? 'Mock Run Data' : 'Backtest Data'}</span>
            {debugInfo && <span>Data Points: {debugInfo.dataPoints}</span>}
          </div>
          <div className="text-gray-500">
            Powered by TradingView Lightweight Charts
          </div>
        </div>
      )}
    </div>
  );
}

