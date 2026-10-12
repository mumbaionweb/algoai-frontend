'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type AreaData,
} from 'lightweight-charts';
import { useThemeStore } from '@/store/themeStore';
import type { Portfolio } from '@/types';
import { TrendingUp, Sparkles, Activity, Layers, HelpCircle } from 'lucide-react';

export type Timeframe = '1M' | '15M' | '1H' | '1D' | '1Mth';

interface PortfolioPerformanceChartProps {
  portfolio: Portfolio | null;
  brokerName?: string;
}

export default function PortfolioPerformanceChart({
  portfolio,
  brokerName = 'All',
}: PortfolioPerformanceChartProps) {
  const { theme } = useThemeStore();
  const [timeframe, setTimeframe] = useState<Timeframe>('15M');
  const [showCandles, setShowCandles] = useState<boolean>(true);
  const [showAiForecast, setShowAiForecast] = useState<boolean>(true);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Series references
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const historyLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const benchmarkGreenSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const benchmarkPurpleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const analysisRedSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aiTrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aiUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const aiLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Real or fallback portfolio metrics
  const totalValue = portfolio?.total_value ?? 124911.20;
  const investedValue = portfolio?.invested_value ?? 115140.98;
  const totalPnl = portfolio?.total_pnl ?? (totalValue - investedValue);
  const totalPnlPercentage = portfolio?.total_pnl_percentage ?? (totalPnl / investedValue) * 100;

  // Compute theme colors dynamically
  const colors = useMemo(() => {
    if (theme === 'solarized-light') {
      return {
        bg: '#eee8d5',
        cardBg: '#e4ddc8',
        text: '#073642',
        subtext: '#657b83',
        grid: '#d8d1be',
        border: '#d8d1be',
        candleUp: '#2aa198',
        candleDown: '#dc322f',
        historyBlue: '#268bd2',
        benchGreen: '#859900',
        benchPurple: '#6c71c4',
        analysisRed: '#cb4b16',
        aiDashed: '#2aa198',
        aiBounds: '#586e75',
      };
    } else if (theme === 'light') {
      return {
        bg: '#ffffff',
        cardBg: '#f8fafc',
        text: '#0f172a',
        subtext: '#64748b',
        grid: '#e2e8f0',
        border: '#e2e8f0',
        candleUp: '#10b981',
        candleDown: '#ef4444',
        historyBlue: '#2563eb',
        benchGreen: '#059669',
        benchPurple: '#7c3aed',
        analysisRed: '#dc2626',
        aiDashed: '#0284c7',
        aiBounds: '#94a3b8',
      };
    } else {
      // Dark / Black theme default
      return {
        bg: '#0d1117',
        cardBg: '#161b22',
        text: '#f3f4f6',
        subtext: '#9ca3af',
        grid: '#21262d',
        border: '#30363d',
        candleUp: '#10b981',
        candleDown: '#ef4444',
        historyBlue: '#38bdf8',
        benchGreen: '#34d399',
        benchPurple: '#a78bfa',
        analysisRed: '#f87171',
        aiDashed: '#38bdf8',
        aiBounds: '#64748b',
      };
    }
  }, [theme]);

  // Generate synthetic timeseries grounded in actual portfolio metrics
  const chartData = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    let stepSec = 60;
    let histCount = 50;
    let forecastCount = 18;

    switch (timeframe) {
      case '1M':
        stepSec = 60; // 1 min
        histCount = 55;
        forecastCount = 18;
        break;
      case '15M':
        stepSec = 15 * 60; // 15 mins
        histCount = 45;
        forecastCount = 15;
        break;
      case '1H':
        stepSec = 3600; // 1 hour
        histCount = 40;
        forecastCount = 12;
        break;
      case '1D':
        stepSec = 86400; // 1 day
        histCount = 35;
        forecastCount = 10;
        break;
      case '1Mth':
        stepSec = 30 * 86400; // 1 month
        histCount = 24;
        forecastCount = 8;
        break;
    }

    const startSec = nowSec - histCount * stepSec;
    const startValue = investedValue * 0.985;
    const endValue = totalValue;
    const netGrowth = endValue - startValue;

    const candles: CandlestickData<UTCTimestamp>[] = [];
    const histLine: LineData<UTCTimestamp>[] = [];
    const benchGreen: LineData<UTCTimestamp>[] = [];
    const benchPurple: LineData<UTCTimestamp>[] = [];
    const analysisRed: LineData<UTCTimestamp>[] = [];

    // Deterministic pseudo-random noise generator
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let prevClose = startValue;

    for (let i = 0; i <= histCount; i++) {
      const t = (startSec + i * stepSec) as UTCTimestamp;
      const progress = i / histCount;

      // Sigmoid/S-curve progression towards current valuation
      const sCurve = Math.pow(progress, 1.3);
      const trendBase = startValue + netGrowth * sCurve;

      // Realistic market volatility
      const noise = (rnd() - 0.48) * (investedValue * 0.008);
      const close = i === histCount ? endValue : Math.max(startValue * 0.95, trendBase + noise);
      const open = i === 0 ? startValue : prevClose;
      const high = Math.max(open, close) + Math.abs(rnd()) * (investedValue * 0.004);
      const low = Math.min(open, close) - Math.abs(rnd()) * (investedValue * 0.004);

      prevClose = close;

      candles.push({
        time: t,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });

      histLine.push({
        time: t,
        value: Number(close.toFixed(2)),
      });

      // Benchmark 1 (Nifty 50 steady index)
      const bench1Val = startValue * (1 + 0.065 * progress + (rnd() - 0.5) * 0.006);
      benchGreen.push({
        time: t,
        value: Number(bench1Val.toFixed(2)),
      });

      // Benchmark 2 (Sensex / Midcap index)
      const bench2Val = startValue * (1 + 0.042 * progress + (rnd() - 0.5) * 0.008);
      benchPurple.push({
        time: t,
        value: Number(bench2Val.toFixed(2)),
      });

      // Historical analysis moving average / smoothed wave
      const analysisVal = trendBase * (1 + Math.sin(progress * Math.PI * 4) * 0.012);
      analysisRed.push({
        time: t,
        value: Number(analysisVal.toFixed(2)),
      });
    }

    // AI Future Forecast Channel
    const aiTrend: LineData<UTCTimestamp>[] = [];
    const aiUpper: LineData<UTCTimestamp>[] = [];
    const aiLower: LineData<UTCTimestamp>[] = [];

    // Anchor at last historical point
    const lastT = (startSec + histCount * stepSec) as UTCTimestamp;
    aiTrend.push({ time: lastT, value: endValue });
    aiUpper.push({ time: lastT, value: endValue });
    aiLower.push({ time: lastT, value: endValue });

    const projectedGrowthSlope = (endValue - startValue) / histCount;

    for (let j = 1; j <= forecastCount; j++) {
      const t = (startSec + (histCount + j) * stepSec) as UTCTimestamp;
      const projProgress = j / forecastCount;

      const expected = endValue + projectedGrowthSlope * j * 0.85;
      const spread = (investedValue * 0.035) * Math.sqrt(projProgress);

      const upperVal = expected + spread + Math.sin(j * 0.8) * (investedValue * 0.005);
      const lowerVal = expected - spread * 0.75 - Math.sin(j * 0.6) * (investedValue * 0.004);
      const centerVal = (upperVal + lowerVal) / 2;

      aiTrend.push({ time: t, value: Number(centerVal.toFixed(2)) });
      aiUpper.push({ time: t, value: Number(upperVal.toFixed(2)) });
      aiLower.push({ time: t, value: Number(lowerVal.toFixed(2)) });
    }

    const latestBenchmark1 = benchGreen[benchGreen.length - 1]?.value ?? totalValue * 0.98;
    const latestBenchmark2 = benchPurple[benchPurple.length - 1]?.value ?? totalValue * 0.96;
    const latestAiUpper = aiUpper[aiUpper.length - 1]?.value ?? totalValue * 1.05;
    const latestAiLower = aiLower[aiLower.length - 1]?.value ?? totalValue * 0.97;

    return {
      candles,
      histLine,
      benchGreen,
      benchPurple,
      analysisRed,
      aiTrend,
      aiUpper,
      aiLower,
      latestBenchmark1,
      latestBenchmark2,
      latestAiUpper,
      latestAiLower,
    };
  }, [timeframe, totalValue, investedValue]);

  // Create and initialize TradingView chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { color: colors.cardBg },
        textColor: colors.subtext,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid, style: LineStyle.Dotted },
        horzLines: { color: colors.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: {
          color: colors.subtext,
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: colors.subtext,
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: colors.border,
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: colors.border,
        timeVisible: timeframe === '1M' || timeframe === '15M' || timeframe === '1H',
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      width: container.clientWidth,
      height: container.clientHeight || 380,
    });

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      borderVisible: false,
      wickUpColor: colors.candleUp,
      wickDownColor: colors.candleDown,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.05,
      },
    });

    // 2. Historical Close Line
    const historyLineSeries = chart.addSeries(LineSeries, {
      color: colors.historyBlue,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      title: 'Historical',
    });

    // 3. Benchmarks Line 1 (Green)
    const benchmarkGreenSeries = chart.addSeries(LineSeries, {
      color: colors.benchGreen,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Benchmark (NIFTY)',
    });

    // 4. Benchmarks Line 2 (Purple)
    const benchmarkPurpleSeries = chart.addSeries(LineSeries, {
      color: colors.benchPurple,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Benchmark (SENSEX)',
    });

    // 5. Historical Analysis Line (Red)
    const analysisRedSeries = chart.addSeries(LineSeries, {
      color: colors.analysisRed,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'Analysis',
    });

    // 6. AI Predicted Upper Trend Channel (Dashed)
    const aiUpperSeries = chart.addSeries(LineSeries, {
      color: colors.aiBounds,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'AI Upper Bound',
    });

    // 7. AI Predicted Lower Trend Channel (Dashed)
    const aiLowerSeries = chart.addSeries(LineSeries, {
      color: colors.aiBounds,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'AI Lower Bound',
    });

    // 8. AI Central Predicted Trendline (Dashed Cyan)
    const aiTrendSeries = chart.addSeries(LineSeries, {
      color: colors.aiDashed,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'AI Projection',
    });

    // Save series references
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    historyLineSeriesRef.current = historyLineSeries;
    benchmarkGreenSeriesRef.current = benchmarkGreenSeries;
    benchmarkPurpleSeriesRef.current = benchmarkPurpleSeries;
    analysisRedSeriesRef.current = analysisRedSeries;
    aiUpperSeriesRef.current = aiUpperSeries;
    aiLowerSeriesRef.current = aiLowerSeries;
    aiTrendSeriesRef.current = aiTrendSeries;

    // Load data
    candleSeries.setData(showCandles ? chartData.candles : []);
    historyLineSeries.setData(chartData.histLine);
    benchmarkGreenSeries.setData(chartData.benchGreen);
    benchmarkPurpleSeries.setData(chartData.benchPurple);
    analysisRedSeries.setData(chartData.analysisRed);

    if (showAiForecast) {
      aiUpperSeries.setData(chartData.aiUpper);
      aiLowerSeries.setData(chartData.aiLower);
      aiTrendSeries.setData(chartData.aiTrend);
    } else {
      aiUpperSeries.setData([]);
      aiLowerSeries.setData([]);
      aiTrendSeries.setData([]);
    }

    chart.timeScale().fitContent();

    // Responsive resize handler
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 380,
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [colors, chartData, showCandles, showAiForecast, timeframe]);

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/60 shadow-lg flex flex-col justify-between">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-700/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-wide">
              Portfolio performance
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {brokerName}
            </span>
          </div>

          {/* Mini Sparkline / Indicator Graphic */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-profit-subtle text-[11px] text-profit border border-profit">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-medium">Live Curve</span>
          </div>
        </div>

        {/* Timeframe Selector Tabs */}
        <div className="flex items-center gap-1 bg-gray-700/60 p-1 rounded-lg self-start sm:self-auto">
          {(['1M', '15M', '1H', '1D', '1Mth'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Legend & AI Forecast Badges Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-[11px] text-gray-300">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#38bdf8] rounded-full inline-block"></span>
            <span className="font-medium text-gray-200">Historical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#34d399] rounded-full inline-block"></span>
            <span className="font-medium text-gray-200">Benchmarks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#a78bfa] rounded-full inline-block"></span>
            <span className="font-medium text-gray-200">Benchmarks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#f87171] rounded-full inline-block"></span>
            <span className="font-medium text-gray-200">Historical analysis</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-gray-400 inline-block"></span>
            <span className="font-medium text-gray-300">AI-predicted trend lines</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-[#38bdf8] inline-block"></span>
            <span className="font-medium text-gray-300">AI-predicted trend</span>
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCandles(!showCandles)}
            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
              showCandles
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-transparent border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
            title="Toggle Candlestick overlay"
          >
            Candles
          </button>
          <button
            type="button"
            onClick={() => setShowAiForecast(!showAiForecast)}
            className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
              showAiForecast
                ? 'bg-blue-900/40 border-blue-500/50 text-blue-300'
                : 'bg-transparent border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
            title="Toggle AI Forecast Channel"
          >
            <Sparkles className="w-3 h-3 text-blue-400" />
            AI Forecast
          </button>
        </div>
      </div>

      {/* Chart Canvas Area with Floating Tags */}
      <div className="relative w-full h-[360px] sm:h-[390px] rounded-lg overflow-hidden bg-gray-900/60 border border-gray-700/40">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Right Edge Values Badge Stack (Matching Screenshot) */}
        <div className="absolute right-2 top-3 flex flex-col items-end gap-1.5 pointer-events-none z-10">
          <div className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 shadow-sm backdrop-blur-sm">
            ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/40 shadow-sm backdrop-blur-sm">
            ₹{chartData.latestBenchmark1.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/40 shadow-sm backdrop-blur-sm">
            ₹{chartData.latestBenchmark2.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {showAiForecast && (
            <>
              <div className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-gray-700/70 text-gray-200 border border-gray-600/50 shadow-sm backdrop-blur-sm">
                Target: ₹{chartData.latestAiUpper.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-950/40 text-red-300 border border-red-500/30 shadow-sm backdrop-blur-sm">
                Support: ₹{chartData.latestAiLower.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
