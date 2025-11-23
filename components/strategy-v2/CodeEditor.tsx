'use client';

import { useState, useEffect } from 'react';
import type { Strategy } from '@/types';

interface CodeEditorProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
}

export default function CodeEditor({ currentStrategy, onStrategyUpdate }: CodeEditorProps) {
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentStrategy) {
      setCode(currentStrategy.strategy_code || currentStrategy.code || '');
    } else {
      setCode(`def initialize(context):
    # Strategy initialization
    pass

def handle_data(context, data):
    # Strategy logic
    pass
`);
    }
  }, [currentStrategy]);

  const handleSave = async () => {
    if (!currentStrategy) {
      // TODO: Create new strategy
      return;
    }
    // TODO: Save strategy code
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      onStrategyUpdate();
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Python</span>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full h-full bg-gray-900 text-gray-100 font-mono text-sm p-4 focus:outline-none resize-none"
          spellCheck={false}
          placeholder="Enter your strategy code here..."
        />
      </div>
    </div>
  );
}

