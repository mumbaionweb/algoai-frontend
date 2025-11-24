'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { Strategy } from '@/types';
import CodeEditor from './CodeEditor';
import VisualBuilder from './VisualBuilder';

interface RightColumnProps {
  currentStrategy: Strategy | null;
  bottomPaneCollapsed: boolean;
  onBottomPaneToggle: () => void;
  onStrategyUpdate: () => void;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
}

export default function RightColumn({
  currentStrategy,
  bottomPaneCollapsed,
  onBottomPaneToggle,
  onStrategyUpdate,
  marketType = 'equity',
}: RightColumnProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'visual'>('code');

  return (
    <div className="h-full bg-gray-800 flex flex-col">
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
      <PanelGroup direction="vertical">
        <Panel defaultSize={bottomPaneCollapsed ? 100 : 70} minSize={30}>
          {activeTab === 'code' ? (
            <CodeEditor 
              currentStrategy={currentStrategy} 
              onStrategyUpdate={onStrategyUpdate}
              marketType={marketType}
            />
          ) : (
            <VisualBuilder currentStrategy={currentStrategy} onStrategyUpdate={onStrategyUpdate} />
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

