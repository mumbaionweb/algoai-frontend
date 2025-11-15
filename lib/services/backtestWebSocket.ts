import type { BacktestResponse } from '@/types';

export type ProgressCallback = (progress: {
  job_id: string;
  status: string;
  progress: number;
  current_bar?: number;
  total_bars?: number;
  message?: string;
}) => void;

export type CompleteCallback = (result: BacktestResponse) => void;
export type ErrorCallback = (error: string) => void;

export class BacktestProgressClient {
  private ws: WebSocket | null = null;
  private jobId: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  constructor(jobId: string, token: string) {
    this.jobId = jobId;
    this.token = token;
  }

  connect(
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback
  ): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    const wsUrl = this.getWebSocketUrl();
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Backtest progress WebSocket connected');
        this.reconnectAttempts = 0;
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message, onProgress, onComplete, onError);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          onError('Invalid message format');
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        this.stopPingInterval();
        
        // Auto-reconnect if not intentional and job might still be running
        if (!this.isIntentionallyClosed && 
            event.code !== 1000 && 
            this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            10000
          );
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            this.connect(onProgress, onComplete, onError);
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      onError('Failed to create WebSocket connection');
    }
  }

  private getWebSocketUrl(): string {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Extract host from API URL or use WS_HOST env var
    let wsHost: string;
    if (process.env.NEXT_PUBLIC_WS_HOST) {
      wsHost = process.env.NEXT_PUBLIC_WS_HOST;
    } else {
      // Extract host from API URL
      try {
        const apiUrl = new URL(API_URL);
        wsHost = apiUrl.host;
      } catch {
        // Fallback if API_URL is not a valid URL
        wsHost = API_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
      }
    }
    
    return `${wsProtocol}//${wsHost}/ws/backtest/${this.jobId}?token=${encodeURIComponent(this.token)}`;
  }

  private handleMessage(
    message: any,
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback
  ): void {
    switch (message.type) {
      case 'connection':
        console.log('✅ Connected to backtest progress stream');
        break;

      case 'progress':
        onProgress({
          job_id: message.job_id,
          status: message.status,
          progress: message.progress,
          current_bar: message.current_bar,
          total_bars: message.total_bars,
          message: message.message,
        });
        break;

      case 'completed':
        onComplete(message.result);
        this.disconnect();
        break;

      case 'failed':
        onError(message.error_message || 'Backtest failed');
        this.disconnect();
        break;

      case 'error':
        onError(message.message);
        break;

      case 'pong':
        // Heartbeat response - no action needed
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  refresh(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'refresh' }));
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
}

