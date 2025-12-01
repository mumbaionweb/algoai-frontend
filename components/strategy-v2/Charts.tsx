'use client';

import { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Strategy } from '@/types';
import { getLiveMarketData, getMockRunData, getBacktestData, type OHLCDataPoint } from '@/lib/api/charts';

interface ChartsProps {
  currentStrategy: Strategy | null;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
}

type ChartDataType = 'live' | 'mock' | 'backtest';


export default function Charts({ currentStrategy, marketType = 'equity' }: ChartsProps) {
  const [chartType, setChartType] = useState<ChartDataType>('live');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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

    // Create candlestick series
    // @ts-ignore - lightweight-charts types may not be fully up to date
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Create volume series
    // @ts-ignore - lightweight-charts types may not be fully up to date
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

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

  // Load chart data based on type
  useEffect(() => {
    if (!currentStrategy?.id || !chartRef.current || !candlestickSeriesRef.current) return;

    loadChartData(chartType);
  }, [chartType, currentStrategy?.id, marketType]);

  const loadChartData = async (type: ChartDataType) => {
    if (!currentStrategy?.id) return;

    setLoading(true);
    setError(null);

    try {
      let data: OHLCDataPoint[] = [];

      switch (type) {
        case 'live':
          data = await fetchLiveMarketData();
          break;
        case 'mock':
          data = await fetchMockRunData();
          break;
        case 'backtest':
          data = await fetchBacktestData();
          break;
      }

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

        candlestickSeriesRef.current.setData(candlestickData);
        if (volumeData.length > 0) {
          volumeSeriesRef.current.setData(volumeData);
        }

        // Fit content
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load chart data');
      console.error('[CHARTS] Error loading chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveMarketData = async (): Promise<OHLCDataPoint[]> => {
    if (!currentStrategy?.parameters?.symbol) {
      return [];
    }

    try {
      const symbol = currentStrategy.parameters.symbol;
      const exchange = currentStrategy.parameters.exchange || 'NSE';
      
      // Get last 30 days of data
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);

      const data = await getLiveMarketData(
        symbol,
        exchange,
        'day',
        fromDate.toISOString().split('T')[0],
        toDate.toISOString().split('T')[0]
      );

      return data;
    } catch (err) {
      console.error('[CHARTS] Error fetching live market data:', err);
      // Fallback to mock data on error
      return generateMockData('live');
    }
  };

  const fetchMockRunData = async (): Promise<OHLCDataPoint[]> => {
    if (!currentStrategy?.parameters?.symbol) {
      return [];
    }

    try {
      const symbol = currentStrategy.parameters.symbol;
      const exchange = currentStrategy.parameters.exchange || 'NSE';
      
      const data = await getMockRunData(symbol, exchange);
      return data;
    } catch (err) {
      console.error('[CHARTS] Error fetching mock run data:', err);
      // Fallback to mock data on error
      return generateMockData('mock');
    }
  };

  const fetchBacktestData = async (): Promise<OHLCDataPoint[]> => {
    if (!currentStrategy?.id) return [];

    try {
      const data = await getBacktestData(currentStrategy.id);
      if (data.length > 0) {
        return data;
      }
      // Fallback to mock data if no backtest data available
      return generateMockData('backtest');
    } catch (err) {
      console.error('[CHARTS] Error fetching backtest data:', err);
      // Fallback to mock data on error
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
            onClick={() => setChartType('live')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chartType === 'live'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Live Market
          </button>
          <button
            onClick={() => setChartType('mock')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chartType === 'mock'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Mock Run
          </button>
          <button
            onClick={() => setChartType('backtest')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              chartType === 'backtest'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Backtest
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
            <div className="text-center p-4">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={() => loadChartData(chartType)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!currentStrategy?.id && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400">Select a strategy to view charts</p>
          </div>
        )}
      </div>

      {/* Chart Info */}
      {currentStrategy?.id && !loading && !error && (
        <div className="border-t border-gray-700 p-2 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
          <div className="flex gap-4">
            <span>Symbol: {currentStrategy.parameters?.symbol || 'N/A'}</span>
            <span>Exchange: {currentStrategy.parameters?.exchange || 'N/A'}</span>
            <span>Type: {chartType === 'live' ? 'Live Market Data' : chartType === 'mock' ? 'Mock Run Data' : 'Backtest Data'}</span>
          </div>
          <div className="text-gray-500">
            Powered by TradingView Lightweight Charts
          </div>
        </div>
      )}
    </div>
  );
}

