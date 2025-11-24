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
}

export default function StrategyV2Layout({
  strategies,
  currentStrategy,
  onStrategyChange,
  onStrategiesUpdate,
}: StrategyV2LayoutProps) {
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [bottomPaneCollapsed, setBottomPaneCollapsed] = useState(true);
  const [rightBottomPaneCollapsed, setRightBottomPaneCollapsed] = useState(true);
  const [marketType, setMarketType] = useState<'equity' | 'commodity' | 'currency' | 'futures'>('equity');

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Top Row */}
      <TopRow currentStrategy={currentStrategy} marketType={marketType} onMarketTypeChange={setMarketType} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
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
        <PanelGroup direction="horizontal" className="w-full">
          {/* Left Sidebar */}
          {!leftSidebarCollapsed && (
            <>
              <Panel defaultSize={15} minSize={10} maxSize={30}>
                <LeftSidebar
                  strategies={strategies}
                  currentStrategy={currentStrategy}
                  onStrategySelect={onStrategyChange}
                  onCollapse={() => setLeftSidebarCollapsed(true)}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-col-resize" />
            </>
          )}

          {/* Main Content: Left Column + Right Column */}
          <Panel defaultSize={leftSidebarCollapsed && rightSidebarCollapsed ? 100 : leftSidebarCollapsed ? 85 : rightSidebarCollapsed ? 85 : 70} minSize={30}>
            <PanelGroup direction="horizontal">
              {/* Left Column - AI Chatbot */}
              <Panel defaultSize={35} minSize={20} maxSize={50}>
                <LeftColumn
                  currentStrategy={currentStrategy}
                  onStrategyUpdate={onStrategiesUpdate}
                  marketType={marketType}
                />
              </Panel>

              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-col-resize" />

              {/* Right Column - Code + Visual Builder */}
              <Panel defaultSize={65} minSize={30}>
                <RightColumn
                  currentStrategy={currentStrategy}
                  bottomPaneCollapsed={bottomPaneCollapsed}
                  onBottomPaneToggle={() => setBottomPaneCollapsed(!bottomPaneCollapsed)}
                  onStrategyUpdate={onStrategiesUpdate}
                  marketType={marketType}
                />
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Right Sidebar */}
          {!rightSidebarCollapsed && (
            <>
              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-col-resize" />
              <Panel defaultSize={15} minSize={10} maxSize={30}>
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

