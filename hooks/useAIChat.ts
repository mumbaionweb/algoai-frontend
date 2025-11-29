import { useState, useCallback } from 'react';
import { chatAI, generateStrategy, analyzeStrategy, getConversationByStrategy, type ChatRequest, type GenerateStrategyRequest, type AnalyzeStrategyRequest } from '@/lib/api/ai';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    message: string,
    context?: { strategy_id?: string; market_type?: string; current_code?: string }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const request: ChatRequest = {
        message,
        conversation_id: conversationId || undefined,
        context,
      };

      const response = await chatAI(request);
      setConversationId(response.conversation_id);
      
      setMessages(prev => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: response.response }
      ]);

      return {
        response: response.response,
        suggestions: response.suggestions,
        strategy_code: response.strategy_code,
        metadata: response.metadata
      };
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to send message';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const generateStrategyCode = useCallback(async (
    requirements: string,
    marketType: string = 'equity',
    symbol?: string,
    exchange?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const request: GenerateStrategyRequest = {
        requirements,
        market_type: marketType,
        symbol,
        exchange
      };

      const response = await generateStrategy(request);
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate strategy';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeStrategyCode = useCallback(async (
    strategyCode: string,
    marketType: string = 'equity'
  ) => {
    setLoading(true);
    setError(null);

    try {
      const request: AnalyzeStrategyRequest = {
        strategy_code: strategyCode,
        market_type: marketType
      };

      const response = await analyzeStrategy(request);
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to analyze strategy';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  const loadConversationByStrategy = useCallback(async (strategyId: string) => {
    if (!strategyId) {
      setMessages([]);
      setConversationId(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const conversation = await getConversationByStrategy(strategyId);
      if (conversation && conversation.messages) {
        // Convert conversation messages to ChatMessage format
        const chatMessages: ChatMessage[] = conversation.messages.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content || msg.message || ''
        }));
        setMessages(chatMessages);
        setConversationId(conversation.id || conversation.conversation_id || null);
      } else {
        // No conversation found, reset to empty
        setMessages([]);
        setConversationId(null);
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      // Don't set error for 404 or missing conversations, just reset
      if (err.response?.status !== 404) {
        setError(err.response?.data?.detail || err.message || 'Failed to load conversation');
      } else {
        setMessages([]);
        setConversationId(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    messages,
    conversationId,
    loading,
    error,
    sendMessage,
    generateStrategyCode,
    analyzeStrategyCode,
    clearMessages,
    loadConversationByStrategy
  };
}

