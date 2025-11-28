'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { Strategy } from '@/types';
import OrdersTab from './OrdersTab';
import DetailsTab from './DetailsTab';

interface RightSidebarProps {
  currentStrategy: Strategy | null;
  bottomPaneCollapsed: boolean;
  onBottomPaneToggle: () => void;
  onCollapse: () => void;
}

export default function RightSidebar({
  currentStrategy,
  bottomPaneCollapsed,
  onBottomPaneToggle,
  onCollapse,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'details'>('orders');

  return (
    <div className="h-full bg-gray-800 border-l border-gray-700 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Details</h2>
        <button
          onClick={onCollapse}
          className="text-gray-400 hover:text-white transition-colors"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'orders'
              ? 'text-blue-400 border-blue-400'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'details'
              ? 'text-blue-400 border-blue-400'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          Details
        </button>
      </div>

      {/* Main Content */}
      <PanelGroup direction="vertical">
        <Panel defaultSize={bottomPaneCollapsed ? 100 : 70} minSize={30}>
          {activeTab === 'orders' ? (
            <OrdersTab currentStrategy={currentStrategy} />
          ) : (
            <DetailsTab currentStrategy={currentStrategy} />
          )}
        </Panel>

        {!bottomPaneCollapsed && (
          <>
            <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-gray-600 transition-colors cursor-row-resize" />
            <Panel defaultSize={30} minSize={10}>
              <div className="h-full bg-gray-900 p-4">
                <h3 className="text-sm font-semibold text-white mb-2">Bottom Pane</h3>
                <p className="text-xs text-gray-400">Additional details will appear here</p>
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Bottom Pane Toggle */}
      <div className="border-t border-gray-700 p-2">
        <button
          onClick={onBottomPaneToggle}
          className="w-full px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className={`w-4 h-4 transition-transform ${bottomPaneCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {bottomPaneCollapsed ? 'Show' : 'Hide'} Bottom Pane
        </button>
      </div>
    </div>
  );
}

