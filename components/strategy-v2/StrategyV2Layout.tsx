'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { Strategy } from '@/types';
import LeftSidebar from './LeftSidebar';
import TopRow from './TopRow';
import LeftColumn from './LeftColumn';
import RightColumn from './RightColumn';
import RightSidebar from './RightSidebar';
import BottomRow from './BottomRow';

interface StrategyV2LayoutProps {
  strategies: Strategy[];
  currentStrategy: Strategy | null;
  onStrategyChange: (strategy: Strategy | null) => void;
  onStrategiesUpdate: () => void;
  onStrategyPlay: (strategy: Strategy) => void;
  onStrategyPause: (strategy: Strategy) => void;
  onStrategyDelete: (strategy: Strategy) => void;
}

export default function StrategyV2Layout({
  strategies,
  currentStrategy,
  onStrategyChange,
  onStrategiesUpdate,
  onStrategyPlay,
  onStrategyPause,
  onStrategyDelete,
}: StrategyV2LayoutProps) {
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [bottomPaneCollapsed, setBottomPaneCollapsed] = useState(true);
  const [rightBottomPaneCollapsed, setRightBottomPaneCollapsed] = useState(true);
  const [marketType, setMarketType] = useState<'equity' | 'commodity' | 'currency' | 'futures'>('equity');
  const [externalCode, setExternalCode] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [chatChartData, setChatChartData] = useState<{
    data_points: any[];
    symbol: string;
    exchange: string;
    interval: string;
    from_date: string;
    to_date: string;
    summary?: any;
  } | null>(null);
  const [chatChartInsights, setChatChartInsights] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sync Status Indicator */}
      {syncStatus && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium">{syncStatus}</span>
        </div>
      )}

      {/* Top Row */}
      <TopRow 
        currentStrategy={currentStrategy} 
        marketType={marketType} 
        onMarketTypeChange={setMarketType}
        onStrategyUpdate={onStrategiesUpdate}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Collapse buttons when sidebars are hidden */}
        {leftSidebarCollapsed && (
          <button
            onClick={() => setLeftSidebarCollapsed(false)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-gray-800 hover:bg-gray-700 border-r border-gray-700 px-2 py-4 rounded-r-lg transition-colors"
            title="Show Strategies"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {rightSidebarCollapsed && (
          <button
            onClick={() => setRightSidebarCollapsed(false)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-50 bg-gray-800 hover:bg-gray-700 border-l border-gray-700 px-2 py-4 rounded-l-lg transition-colors"
            title="Show Details"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Panel Group for resizable layout */}
        <PanelGroup direction="horizontal" className="w-full h-full">
          {/* Left Sidebar */}
          {!leftSidebarCollapsed && (
            <>
              <Panel defaultSize={15} minSize={10} maxSize={30} className="h-full">
                <LeftSidebar
                  strategies={strategies}
                  currentStrategy={currentStrategy}
                  onStrategySelect={onStrategyChange}
                  onPlayStrategy={onStrategyPlay}
                  onPauseStrategy={onStrategyPause}
                  onDeleteStrategy={onStrategyDelete}
                  onCollapse={() => setLeftSidebarCollapsed(true)}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-col-resize" />
            </>
          )}

          {/* Main Content: Left Column + Right Column */}
          <Panel defaultSize={leftSidebarCollapsed && rightSidebarCollapsed ? 100 : leftSidebarCollapsed ? 85 : rightSidebarCollapsed ? 85 : 70} minSize={30} className="h-full">
            <PanelGroup direction="horizontal" className="h-full">
              {/* Left Column - AI Chatbot */}
              <Panel defaultSize={35} minSize={20} maxSize={50} className="h-full">
                <LeftColumn
                  currentStrategy={currentStrategy}
                  onStrategyUpdate={() => {
                    onStrategiesUpdate();
                    // Show sync indicator
                    setSyncStatus('AI → Code → Visual Builder');
                    setTimeout(() => setSyncStatus(null), 3000);
                  }}
                  marketType={marketType}
                  onCodeReceived={(code) => {
                    console.log('[STRATEGY_LAYOUT] onCodeReceived called:', {
                      codeLength: code.length,
                      codePreview: code.substring(0, 100)
                    });
                    setExternalCode(code);
                    console.log('[STRATEGY_LAYOUT] externalCode state set, will clear in 1000ms');
                    // Clear after a delay to allow CodeEditor to process it and prevent override
                    // Keep it longer to prevent currentStrategy refresh from clearing it
                    setTimeout(() => {
                      console.log('[STRATEGY_LAYOUT] Clearing externalCode after timeout');
                      setExternalCode(null);
                    }, 1000);
                  }}
                  onChartGenerated={(chartData, insights) => {
                    console.log('[STRATEGY_LAYOUT] Chart generated:', {
                      symbol: chartData.symbol,
                      exchange: chartData.exchange,
                      dataPoints: chartData.data_points.length
                    });
                    setChatChartData(chartData);
                    setChatChartInsights(insights);
                    // Clear after a delay to allow Charts component to process it
                    setTimeout(() => {
                      console.log('[STRATEGY_LAYOUT] Clearing chatChartData after timeout');
                      setChatChartData(null);
                      setChatChartInsights(null);
                    }, 2000);
                  }}
                  onSwitchToCharts={() => {
                    // This will be handled by RightColumn
                    console.log('[STRATEGY_LAYOUT] Request to switch to Charts tab');
                  }}
                />
              </Panel>

              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-col-resize" />

              {/* Right Column - Code + Visual Builder */}
              <Panel defaultSize={65} minSize={30} className="h-full">
                <RightColumn
                  currentStrategy={currentStrategy}
                  bottomPaneCollapsed={bottomPaneCollapsed}
                  onBottomPaneToggle={() => setBottomPaneCollapsed(!bottomPaneCollapsed)}
                  onStrategyUpdate={() => {
                    onStrategiesUpdate();
                    // Show sync indicator when code is saved
                    setSyncStatus('Code → Visual Builder');
                    setTimeout(() => setSyncStatus(null), 3000);
                  }}
                  marketType={marketType}
                  externalCode={externalCode}
                  chatChartData={chatChartData}
                  chatChartInsights={chatChartInsights}
                />
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Right Sidebar */}
          {!rightSidebarCollapsed && (
            <>
              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-col-resize" />
              <Panel defaultSize={15} minSize={10} maxSize={30} className="h-full">
                <RightSidebar
                  currentStrategy={currentStrategy}
                  bottomPaneCollapsed={rightBottomPaneCollapsed}
                  onBottomPaneToggle={() => setRightBottomPaneCollapsed(!rightBottomPaneCollapsed)}
                  onCollapse={() => setRightSidebarCollapsed(true)}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Bottom Row */}
      <BottomRow currentStrategy={currentStrategy} />
    </div>
  );
}
