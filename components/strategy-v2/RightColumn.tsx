'use client';

import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { Strategy } from '@/types';
import CodeEditor from './CodeEditor';
import VisualBuilder from './VisualBuilder';
import FlowBasedVisualBuilder from './FlowBasedVisualBuilder';
import Charts from './Charts';

interface RightColumnProps {
  currentStrategy: Strategy | null;
  bottomPaneCollapsed: boolean;
  onBottomPaneToggle: () => void;
  onStrategyUpdate: () => void;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
  externalCode?: string | null; // Code from AI chat to populate
  chatChartData?: {
    data_points: any[];
    symbol: string;
    exchange: string;
    interval: string;
    from_date: string;
    to_date: string;
    summary?: any;
  } | null;
  chatChartInsights?: string | null;
}

export default function RightColumn({
  currentStrategy,
  bottomPaneCollapsed,
  onBottomPaneToggle,
  onStrategyUpdate,
  marketType = 'equity',
  externalCode,
  chatChartData,
  chatChartInsights,
}: RightColumnProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'visual' | 'charts'>('code');

  // Switch to Charts tab when chart data is received
  useEffect(() => {
    if (chatChartData && chatChartData.data_points && chatChartData.data_points.length > 0) {
      console.log('[RIGHT_COLUMN] Chat chart data received, switching to Charts tab');
      setActiveTab('charts');
    }
  }, [chatChartData]);

  return (
    <div className="h-full bg-gray-800 flex flex-col min-h-0">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-gray-700">
        <div className="flex">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'code'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            Code
          </button>
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'visual'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            Visual Builder
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'charts'
                ? 'text-blue-400 border-blue-400'
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            Charts
          </button>
        </div>
        <button
          onClick={onBottomPaneToggle}
          className="px-3 py-2 text-gray-400 hover:text-white transition-colors"
          title={bottomPaneCollapsed ? 'Show bottom pane' : 'Hide bottom pane'}
        >
          <svg
            className={`w-4 h-4 transition-transform ${bottomPaneCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <PanelGroup direction="vertical" className="flex-1 min-h-0">
        <Panel defaultSize={bottomPaneCollapsed ? 100 : 70} minSize={30}>
          {activeTab === 'code' ? (
            <CodeEditor 
              currentStrategy={currentStrategy} 
              onStrategyUpdate={onStrategyUpdate}
              marketType={marketType}
              externalCode={externalCode}
            />
          ) : activeTab === 'visual' ? (
            <FlowBasedVisualBuilder 
              currentStrategy={currentStrategy} 
              onStrategyUpdate={onStrategyUpdate}
            />
          ) : (
            <Charts 
              currentStrategy={currentStrategy}
              marketType={marketType}
              onStrategyUpdate={onStrategyUpdate}
              chatChartData={chatChartData}
              chatChartInsights={chatChartInsights}
            />
          )}
        </Panel>

        {!bottomPaneCollapsed && (
          <>
            <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-row-resize" />
            <Panel defaultSize={30} minSize={10}>
              <div className="h-full bg-gray-900 p-4">
                <h3 className="text-sm font-semibold text-white mb-2">Bottom Pane</h3>
                <p className="text-xs text-gray-400">Additional information and tools will appear here</p>
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}

