import { apiClient } from './client';

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  auto_save_code?: boolean; // Auto-save code to strategy when code is generated
  context?: {
    strategy_id?: string;
    market_type?: string;
    current_code?: string;
  };
}

export interface CodeSuggestion {
  type: 'code_snippet';
  title: string;
  code: string;
  description: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  suggestions: CodeSuggestion[];
  strategy_code?: string | null;
  strategy_id?: string;
  metadata: {
    tokens_used?: number;
    model: string;
    timestamp: string;
    has_code?: boolean;
  };
}

export interface GenerateStrategyRequest {
  requirements: string;
  market_type?: string;
  symbol?: string;
  exchange?: string;
  parameters?: Record<string, any>;
}

export interface GenerateStrategyResponse {
  strategy_code: string;
  explanation: string;
  parameters: Record<string, any>;
  metadata: {
    complexity: 'low' | 'medium' | 'high';
    estimated_trades_per_day?: string;
    risk_level?: string;
  };
}

export interface AnalyzeStrategyRequest {
  strategy_code: string;
  market_type?: string;
}

export interface AnalyzeStrategyResponse {
  analysis: {
    valid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    suggestions: string[];
    complexity: string;
    estimated_performance: string;
  };
  code_metrics: {
    lines_of_code: number;
    functions: number;
    indicators_used: string[];
    risk_management: boolean;
  };
}

export interface ValidationIssue {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface Conversation {
  id?: string;
  conversation_id?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  created_at?: string;
  updated_at?: string;
  strategy_id?: string;
  user_id?: string;
}

/**
 * Chat with AI assistant
 */
export async function chatAI(request: ChatRequest): Promise<ChatResponse> {
  const response = await apiClient.post<ChatResponse>('/api/ai/chat', request);
  return response.data;
}

/**
 * Generate strategy code from requirements
 */
export async function generateStrategy(request: GenerateStrategyRequest): Promise<GenerateStrategyResponse> {
  const response = await apiClient.post<GenerateStrategyResponse>('/api/ai/generate-strategy', request);
  return response.data;
}

/**
 * Analyze existing strategy code
 */
export async function analyzeStrategy(request: AnalyzeStrategyRequest): Promise<AnalyzeStrategyResponse> {
  const response = await apiClient.post<AnalyzeStrategyResponse>('/api/ai/analyze-strategy', request);
  return response.data;
}

/**
 * Get conversation history
 */
export async function getConversation(conversationId: string): Promise<Conversation> {
  const response = await apiClient.get<Conversation>(`/api/ai/conversations/${conversationId}`);
  return response.data;
}

/**
 * Get conversation history by strategy ID
 */
export async function getConversationByStrategy(strategyId: string): Promise<Conversation | null> {
  const response = await apiClient.get<Conversation | null>(`/api/ai/conversations/strategy/${strategyId}`);
  return response.data;
}

