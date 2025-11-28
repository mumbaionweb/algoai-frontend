'use client';

import { useState, useRef, useEffect } from 'react';
import type { Strategy } from '@/types';
import { useAIChat } from '@/hooks/useAIChat';

interface LeftColumnProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
}

export default function LeftColumn({ currentStrategy, onStrategyUpdate, marketType = 'equity' }: LeftColumnProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { messages, loading, error, sendMessage } = useAIChat();

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 0);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    try {
      // The backend AI chat endpoint will intelligently handle code generation requests
      // Users can naturally ask for code generation (e.g., "create a strategy", "generate code", etc.)
      // and the AI will respond with the appropriate code generation
      await sendMessage(userMessage, {
        strategy_id: currentStrategy?.id,
        market_type: marketType,
        current_code: currentStrategy?.strategy_code || currentStrategy?.code
      });
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">AI Assistant</h2>
        <p className="text-xs text-gray-400 mt-1">Powered by AI + API sources</p>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-200">
                Hello! I'm your AI strategy assistant. I can help you create and optimize trading strategies. What would you like to build?
              </p>
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-0" />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to create a strategy..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
