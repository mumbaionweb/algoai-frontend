'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  Time,
  ColorType,
  UTCTimestamp,
} from 'lightweight-charts';
import {
  getBigqueryCacheRawData,
  getBigqueryCacheIntervals,
} from '@/lib/api/datasets';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export interface StockTradingViewChartProps {
  symbol: string;
  companyName?: string;
  exchange?: string;
}

interface IntervalOption {
  label: string;
  value: string;
  badge?: string;
}

const INTERVAL_OPTIONS: IntervalOption[] = [
  { label: '1m', value: 'minute' },
  { label: '3m', value: '3minute' },
  { label: '5m', value: '5minute' },
  { label: '15m', value: '15minute' },
  { label: '1h', value: '60minute' },
  { label: '1D', value: 'day' },
  { label: '1W', value: 'week' },
  { label: '1M', value: 'month' },
];

export default function StockTradingViewChart({
  symbol,
  companyName,
  exchange = 'NSE',
}: StockTradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<string>('minute');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableIntervals, setAvailableIntervals] = useState<Record<string, { count: number; start?: string; end?: string }>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active hover bar metrics
  const [hoverData, setHoverData] = useState<{
    time?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    log_id?: string | null;
  } | null>(null);

  // Overall dataset metadata for current interval
  const [dataStats, setDataStats] = useState<{
    count: number;
    startDate?: string;
    endDate?: string;
    latestLogId?: string | null;
  } | null>(null);

  // Load available intervals from BigQuery for this symbol
  const loadIntervalMetadata = useCallback(async () => {
    try {
      const res = await getBigqueryCacheIntervals(symbol, exchange);
      if (res && res.intervals) {
        const map: Record<string, { count: number; start?: string; end?: string }> = {};
        res.intervals.forEach((item: any) => {
          map[item.interval] = {
            count: item.count,
            start: item.start_date,
            end: item.end_date,
          };
        });
        setAvailableIntervals(map);

        // Auto-select first interval with data if current has 0
        if (!map[selectedInterval]) {
          const firstWithData = INTERVAL_OPTIONS.find((opt) => map[opt.value]?.count > 0);
          if (firstWithData) {
            setSelectedInterval(firstWithData.value);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load BigQuery interval metadata:', e);
    }
  }, [symbol, exchange, selectedInterval]);

  useEffect(() => {
    loadIntervalMetadata();
  }, [symbol, exchange]);

  // Determine theme mode
  const getThemeConfig = useCallback(() => {
    if (typeof window === 'undefined') return { isDark: true };
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isDark = theme !== 'light' && theme !== 'solarized';
    return {
      isDark,
      bg: isDark ? '#0d1117' : '#ffffff',
      text: isDark ? '#9ca3af' : '#4b5563',
      grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: isDark ? '#21262d' : '#e2e8f0',
    };
  }, []);

  // Initialize Lightweight Charts instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const theme = getThemeConfig();

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: isFullscreen ? window.innerHeight - 180 : 480,
      layout: {
        background: { type: ColorType.Solid, color: theme.bg },
        textColor: theme.text,
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: theme.border,
      },
      rightPriceScale: {
        borderColor: theme.border,
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(59, 130, 246, 0.4)',
          width: 1,
          style: 3,
        },
        horzLine: {
          color: 'rgba(59, 130, 246, 0.4)',
          width: 1,
          style: 3,
        },
      },
    });

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    // Volume histogram series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(16, 185, 129, 0.4)',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume_scale',
    });

    chart.priceScale('volume_scale').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle crosshair hover for real-time OHLCV inspection
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || param.point === undefined) {
        setHoverData(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as any;
      const volumeData = param.seriesData.get(volumeSeries) as any;

      if (candleData) {
        let timeStr = String(param.time);
        if (typeof param.time === 'number') {
          timeStr = new Date(param.time * 1000).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
        }
        setHoverData({
          time: timeStr,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData ? volumeData.value : undefined,
          log_id: (candleData as any).log_id || null,
        });
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 180 : 480,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [isFullscreen, getThemeConfig]);

  // Fetch BigQuery historical candles for selected interval
  const fetchChartData = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    try {
      setLoading(true);
      setError(null);

      const res = await getBigqueryCacheRawData(symbol, exchange, selectedInterval, 5000);
      const rows = res?.data || [];

      if (rows.length === 0) {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
        setDataStats({ count: 0, latestLogId: null });
        setLoading(false);
        return;
      }

      // Convert rows to strictly ascending, non-duplicate lightweight-charts format
      const candleData: any[] = [];
      const volumeData: any[] = [];
      const seenTimes = new Set<string | number>();

      let lastLogId: string | null = null;

      for (const row of rows) {
        if (!row.timestamp) continue;
        const dt = new Date(row.timestamp);
        if (isNaN(dt.getTime())) continue;

        let timeVal: Time;
        if (['day', 'week', 'month'].includes(selectedInterval)) {
          // Format as 'YYYY-MM-DD'
          timeVal = dt.toISOString().split('T')[0] as string;
        } else {
          // Seconds timestamp for intraday
          timeVal = Math.floor(dt.getTime() / 1000) as UTCTimestamp;
        }

        if (seenTimes.has(timeVal)) continue;
        seenTimes.add(timeVal);

        const open = Number(row.open);
        const high = Number(row.high);
        const low = Number(row.low);
        const close = Number(row.close);
        const volume = Number(row.volume || 0);

        if (row.log_id) {
          lastLogId = row.log_id;
        }

        const isUp = close >= open;

        candleData.push({
          time: timeVal,
          open,
          high,
          low,
          close,
          log_id: row.log_id,
        });

        volumeData.push({
          time: timeVal,
          value: volume,
          color: isUp ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
        });
      }

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      if (chartInstanceRef.current && candleData.length > 0) {
        chartInstanceRef.current.timeScale().fitContent();
      }

      setDataStats({
        count: candleData.length,
        startDate: rows[0]?.timestamp,
        endDate: rows[rows.length - 1]?.timestamp,
        latestLogId: lastLogId,
      });
    } catch (e: any) {
      console.error('Failed to load BigQuery chart data:', e);
      setError(e.message || 'Failed to fetch BigQuery data');
    } finally {
      setLoading(false);
    }
  }, [symbol, exchange, selectedInterval]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Reset Zoom
  const handleResetZoom = () => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
    }
  };

  const activeStats = hoverData || (dataStats && dataStats.count > 0 ? {
    open: undefined,
    high: undefined,
    low: undefined,
    close: undefined,
    volume: undefined,
  } : null);

  const priceDiff = hoverData && hoverData.close !== undefined && hoverData.open !== undefined
    ? hoverData.close - hoverData.open
    : null;
  const pricePct = priceDiff !== null && hoverData?.open
    ? (priceDiff / hoverData.open) * 100
    : null;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''
      }`}
    >
      {/* Top Controls Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        {/* Interval Selector Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1 hidden sm:inline">
            Interval:
          </span>
          {INTERVAL_OPTIONS.map((opt) => {
            const hasData = (availableIntervals[opt.value]?.count || 0) > 0;
            const isSelected = selectedInterval === opt.value;
            const count = availableIntervals[opt.value]?.count;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedInterval(opt.value)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : hasData
                    ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                    : 'bg-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title={
                  hasData
                    ? `${opt.label}: ${count?.toLocaleString()} bars available in BigQuery`
                    : `${opt.label}: No bars cached in BigQuery yet`
                }
              >
                <span>{opt.label}</span>
                {hasData && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-profit'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            title="Fit Content / Reset Zoom"
          >
            Reset Zoom
          </button>

          <button
            type="button"
            onClick={fetchChartData}
            disabled={loading}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh Data from BigQuery"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-4 h-4" />
            ) : (
              <ArrowsPointingOutIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Real-time OHLCV Inspection Header */}
      <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700/60 text-xs flex flex-wrap items-center justify-between gap-y-1 gap-x-4">
        <div className="flex items-center gap-4 flex-wrap font-mono">
          {hoverData ? (
            <>
              <span className="text-gray-500 dark:text-gray-400 font-sans">
                {hoverData.time}
              </span>
              <div>
                <span className="text-gray-400 mr-1">O:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₹{hoverData.open?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 mr-1">H:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₹{hoverData.high?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 mr-1">L:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₹{hoverData.low?.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 mr-1">C:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₹{hoverData.close?.toFixed(2)}
                </span>
              </div>
              {priceDiff !== null && pricePct !== null && (
                <div
                  className={`font-bold ${
                    priceDiff >= 0 ? 'text-profit' : 'text-loss'
                  }`}
                >
                  {priceDiff >= 0 ? '+' : ''}
                  ₹{priceDiff.toFixed(2)} ({priceDiff >= 0 ? '+' : ''}
                  {pricePct.toFixed(2)}%)
                </div>
              )}
              {hoverData.volume !== undefined && (
                <div>
                  <span className="text-gray-400 mr-1">Vol:</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {hoverData.volume.toLocaleString()}
                  </span>
                </div>
              )}
            </>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 font-sans italic">
              Hover over chart candles to inspect OHLCV & volume
            </span>
          )}
        </div>

        {/* BigQuery Source Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
          <span>BigQuery: {dataStats?.count.toLocaleString() || 0} bars</span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative flex-1 w-full min-h-[440px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
              <ArrowPathIcon className="w-6 h-6 animate-spin text-blue-500" />
              <span>Fetching BigQuery historical data for {symbol} ({selectedInterval})...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-6">
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 max-w-md text-center">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <h4 className="font-bold text-red-800 dark:text-red-300 mb-1">
                Data Fetch Error
              </h4>
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>
              <button
                type="button"
                onClick={fetchChartData}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && dataStats && dataStats.count === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-6">
            <div className="text-center max-w-md">
              <InformationCircleIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                No BigQuery Data for {selectedInterval}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Historical timeseries data for {symbol} ({selectedInterval}) has not been synced to BigQuery yet.
                Try selecting another interval or trigger the Equity Historical Sync job from the Jobs page.
              </p>
              {Object.keys(availableIntervals).length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="text-xs text-gray-400 self-center">Available:</span>
                  {Object.entries(availableIntervals)
                    .filter(([_, info]) => info.count > 0)
                    .map(([inv, info]) => (
                      <button
                        key={inv}
                        type="button"
                        onClick={() => setSelectedInterval(inv)}
                        className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded text-xs font-semibold text-blue-600 dark:text-blue-300 hover:bg-blue-100"
                      >
                        {inv} ({info.count})
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* Bottom BigQuery Data Lineage & Validation Footer */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircleIcon className="w-4 h-4 text-profit shrink-0" />
          <span className="font-medium text-gray-700 dark:text-gray-300">
            BigQuery Lineage:
          </span>
          <span className="font-mono text-[11px] bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
            algoai_backtests.historical_data
          </span>
          {dataStats?.latestLogId && (
            <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400" title="Latest Job Execution Run ID">
              (log_id: {dataStats.latestLogId.substring(0, 8)}...)
            </span>
          )}
        </div>

        {dataStats && dataStats.startDate && dataStats.endDate && (
          <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
            Coverage: {new Date(dataStats.startDate).toLocaleDateString('en-IN')} &rarr;{' '}
            {new Date(dataStats.endDate).toLocaleDateString('en-IN')}
          </div>
        )}
      </div>
    </div>
  );
}
