'use client';

import { useState, useRef, useEffect } from 'react';
import type { Strategy } from '@/types';
import { useAIChat } from '@/hooks/useAIChat';
import { updateStrategy } from '@/lib/api/strategies';

interface LeftColumnProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
  onCodeReceived?: (code: string) => void; // Callback when AI returns code
  onChartGenerated?: (chartData: {
    data_points: any[];
    symbol: string;
    exchange: string;
    interval: string;
    from_date: string;
    to_date: string;
    summary?: any;
  }, insights: string) => void; // Callback when AI returns chart data
  onSwitchToCharts?: () => void; // Callback to switch to Charts tab
}

export default function LeftColumn({ 
  currentStrategy, 
  onStrategyUpdate, 
  marketType = 'equity', 
  onCodeReceived,
  onChartGenerated,
  onSwitchToCharts
}: LeftColumnProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { messages, loading, error, sendMessage, loadConversationByStrategy } = useAIChat();

  // Load conversation history when strategy changes
  useEffect(() => {
    if (currentStrategy?.id) {
      loadConversationByStrategy(currentStrategy.id);
    } else {
      // Clear messages if no strategy is selected
      loadConversationByStrategy('');
    }
  }, [currentStrategy?.id, loadConversationByStrategy]);

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
      console.log('[AI_CHAT] handleSend - Sending message:', {
        userMessage,
        strategyId: currentStrategy?.id,
        marketType,
        hasCurrentCode: !!(currentStrategy?.strategy_code || currentStrategy?.code)
      });

      // Send with auto_save_code: true if we have a strategy (backend will auto-save)
      const result = await sendMessage(
        userMessage,
        {
          strategy_id: currentStrategy?.id,
          market_type: marketType,
          current_code: currentStrategy?.strategy_code || currentStrategy?.code
        },
        !!currentStrategy?.id // Auto-save code if strategy exists
      );

      console.log('[AI_CHAT] handleSend - Result received:', {
        has_strategy_code: !!result.strategy_code,
        strategy_code_length: result.strategy_code?.length || 0,
        has_strategy_id: !!currentStrategy?.id,
        has_onCodeReceived: !!onCodeReceived,
        has_metadata: !!result.metadata,
        metadata_keys: result.metadata ? Object.keys(result.metadata) : [],
        has_chart_data: !!result.metadata?.chart_data,
        chart_data_symbol: result.metadata?.chart_data?.symbol,
        full_metadata: result.metadata // Log full metadata for debugging
      });

      // Check if chart data was returned
      // Check for chart_data existence - it should have data_points array
      const chartData = result.metadata?.chart_data;
      if (chartData && chartData.data_points && Array.isArray(chartData.data_points) && chartData.data_points.length > 0) {
        console.log('[AI_CHAT] ✅ Chart data detected in response:', {
          symbol: chartData.symbol,
          exchange: chartData.exchange,
          interval: chartData.interval,
          dataPoints: chartData.data_points.length,
          hasSummary: !!chartData.summary,
          chartRequestDetected: chartData.chart_request_detected,
          fromDate: chartData.from_date,
          toDate: chartData.to_date
        });

        // Pass chart data to parent component
        if (onChartGenerated) {
          console.log('[AI_CHAT] Calling onChartGenerated callback');
          onChartGenerated(
            {
              data_points: chartData.data_points || [],
              symbol: chartData.symbol,
              exchange: chartData.exchange,
              interval: chartData.interval,
              from_date: chartData.from_date,
              to_date: chartData.to_date,
              summary: chartData.summary
            },
            result.response // Use AI response as insights
          );
        } else {
          console.warn('[AI_CHAT] ⚠️ Chart data detected but onChartGenerated callback is not available');
        }

        // Switch to Charts tab if callback is available
        if (onSwitchToCharts) {
          console.log('[AI_CHAT] Switching to Charts tab');
          setTimeout(() => {
            onSwitchToCharts();
          }, 500); // Small delay to ensure chart data is processed
        } else {
          console.warn('[AI_CHAT] ⚠️ Chart data detected but onSwitchToCharts callback is not available');
        }
      } else {
        console.log('[AI_CHAT] ❌ No chart data in response:', {
          has_metadata: !!result.metadata,
          has_chart_data: !!result.metadata?.chart_data,
          chart_data_type: typeof result.metadata?.chart_data,
          chart_data_keys: result.metadata?.chart_data ? Object.keys(result.metadata.chart_data) : [],
          has_data_points: !!result.metadata?.chart_data?.data_points,
          data_points_length: result.metadata?.chart_data?.data_points?.length || 0
        });
      }

      // If AI returned code, populate it in the editor
      // Backend will auto-save if auto_save_code: true was sent
      if (result.strategy_code) {
        const codeToUse = result.strategy_code;
        console.log('[AI_CHAT] Code received - Populating editor:', {
          codeLength: codeToUse.length,
          codePreview: codeToUse.substring(0, 100),
          hasStrategyId: !!currentStrategy?.id,
          autoSaveWasEnabled: !!currentStrategy?.id
        });
        
        // Always populate code in editor
        if (onCodeReceived) {
          console.log('[AI_CHAT] Calling onCodeReceived callback');
          onCodeReceived(codeToUse);
        } else {
          console.warn('[AI_CHAT] onCodeReceived callback is not available!');
        }
        
        // If backend auto-saved (auto_save_code: true), refresh strategy to get updated code
        // Otherwise, manually save
        if (currentStrategy?.id) {
          // Backend should have auto-saved, but refresh to get the updated strategy
          // Wait longer for backend to process and save the code
          setTimeout(async () => {
            try {
              console.log('[AI_CHAT] Refreshing strategy to get auto-saved code:', {
                strategyId: currentStrategy.id
              });
              // Refresh strategy to get the auto-saved code and extracted model
              onStrategyUpdate();
            } catch (refreshErr) {
              console.error('[AI_CHAT] Failed to refresh strategy:', refreshErr);
              // Fallback: manually save if refresh fails
              try {
                console.log('[AI_CHAT] Fallback: Manually saving code');
                await updateStrategy(currentStrategy.id, { strategy_code: codeToUse }, false);
                onStrategyUpdate();
              } catch (saveErr) {
                console.error('[AI_CHAT] Failed to save AI-generated code:', saveErr);
              }
            }
          }, 2000); // Wait 2 seconds for backend auto-save to complete (was 500ms)
        }
      } else {
        console.log('[AI_CHAT] No code in response:', {
          has_strategy_code: !!result.strategy_code,
          has_onCodeReceived: !!onCodeReceived
        });
      }
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
