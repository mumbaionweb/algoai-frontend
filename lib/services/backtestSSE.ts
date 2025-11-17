import type { BacktestResponse, Transaction } from '@/types';
import { getBacktestJob } from '@/lib/api/backtesting';

export type ProgressCallback = (progress: {
  job_id: string;
  status: string;
  progress: number;
  current_bar?: number;
  total_bars?: number;
  message?: string;
}) => void;

export type TransactionCallback = (transactions: {
  job_id: string;
  transactions: Transaction[];
  total_transactions: number;
  new_transactions_count: number;
  timestamp?: string;
}) => void;

export type CompleteCallback = (result: BacktestResponse) => void;
export type ErrorCallback = (error: string) => void;

export class BacktestSSEClient {
  private eventSource: EventSource | null = null;
  private jobId: string;
  private token: string;
  private isIntentionallyClosed = false;

  constructor(jobId: string, token: string) {
    this.jobId = jobId;
    this.token = token;
  }

  connect(
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback,
    onTransaction?: TransactionCallback
  ): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.warn('SSE already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    const sseUrl = this.getSSEUrl();
    
    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.addEventListener('connection', (event) => {
        const data = JSON.parse(event.data);
        console.log('✅ SSE connected to backtest stream:', data);
      });

      this.eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          onProgress({
            job_id: data.job_id || this.jobId,
            status: data.status,
            progress: data.progress,
            current_bar: data.current_bar,
            total_bars: data.total_bars,
            message: data.message,
          });
        } catch (error) {
          console.error('Error parsing progress event:', error);
        }
      });

      this.eventSource.addEventListener('transaction', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (onTransaction && data.transactions) {
            console.log(`📊 Received ${data.new_transactions_count || data.transactions.length} new transactions via SSE`);
            
            // Debug: Analyze trade_id distribution
            const tradeIdCounts: Record<string, number> = {};
            data.transactions.forEach((txn: Transaction) => {
              const tid = txn.trade_id || 'NO_TRADE_ID';
              tradeIdCounts[tid] = (tradeIdCounts[tid] || 0) + 1;
            });
            
            console.log('🔍 Transaction stream analysis:', {
              new_transactions: data.new_transactions_count || data.transactions.length,
              total_transactions: data.total_transactions,
              unique_trade_ids: Object.keys(tradeIdCounts).length,
              transactions_without_trade_id: data.transactions.filter((t: Transaction) => !t.trade_id).length,
              trade_id_distribution: tradeIdCounts,
              sample_transactions: data.transactions.slice(0, 3).map((t: Transaction) => ({
                trade_id: t.trade_id || 'N/A',
                type: t.type,
                status: t.status,
                quantity: t.quantity,
                symbol: t.symbol,
              })),
            });
            
            onTransaction({
              job_id: data.job_id || this.jobId,
              transactions: data.transactions,
              total_transactions: data.total_transactions || data.transactions.length,
              new_transactions_count: data.new_transactions_count || data.transactions.length,
              timestamp: data.timestamp,
            });
          } else {
            console.warn('⚠️ Transaction event received but no callback provided or transactions missing:', {
              has_callback: !!onTransaction,
              has_transactions: !!data.transactions,
            });
          }
        } catch (error) {
          console.error('Error parsing transaction event:', error);
        }
      });

      this.eventSource.addEventListener('completed', async (event) => {
        try {
          const data = JSON.parse(event.data);
          const resultSummary = data.result_summary || data.result;
          
          console.log('✅ Job completed, result_summary received via SSE:', resultSummary);
          console.log('📊 Fetching full result via REST API...');
          
          // IMPORTANT: Fetch full result immediately via REST API
          try {
            const fullResult = await this.fetchFullResult();
            if (fullResult) {
              console.log('✅ Full result fetched:', {
                backtest_id: fullResult.backtest_id,
                total_trades: fullResult.total_trades,
                transactions_count: fullResult.transactions?.length || 0,
                has_transactions: !!fullResult.transactions,
              });
              onComplete(fullResult);
            } else {
              console.warn('⚠️ Full result not available, using summary');
              onComplete(resultSummary);
            }
          } catch (error) {
            console.error('❌ Error fetching full result:', error);
            console.warn('⚠️ Falling back to result_summary');
            onComplete(resultSummary);
          }
          
          this.disconnect();
        } catch (error) {
          console.error('Error parsing completed event:', error);
          onError('Failed to parse completion data');
        }
      });

      this.eventSource.addEventListener('failed', (event) => {
        try {
          const data = JSON.parse(event.data);
          const errorMsg = data.error_message || 'Backtest failed';
          console.error('❌ Backtest job failed via SSE:', errorMsg);
          console.error('Failed event details:', data);
          onError(errorMsg);
          this.disconnect();
        } catch (error) {
          console.error('Error parsing failed event:', error);
          onError('Backtest failed');
        }
      });

      this.eventSource.addEventListener('cancelled', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('⚠️ Backtest job cancelled via SSE:', data);
          onError('Backtest was cancelled');
          this.disconnect();
        } catch (error) {
          console.error('Error parsing cancelled event:', error);
          onError('Backtest was cancelled');
        }
      });

      this.eventSource.addEventListener('error', (event) => {
        // SSE automatically reconnects, but we can handle errors here
        if (this.eventSource?.readyState === EventSource.CONNECTING) {
          console.log('🔄 SSE reconnecting...');
        } else if (this.eventSource?.readyState === EventSource.CLOSED) {
          if (!this.isIntentionallyClosed) {
            console.log('🔌 SSE connection closed (will auto-reconnect)');
          } else {
            console.log('🔌 SSE connection closed (intentional)');
          }
        } else {
          console.error('❌ SSE error:', event);
          onError('SSE connection error');
        }
      });

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      onError('Failed to create SSE connection');
    }
  }

  private getSSEUrl(): string {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    
    // Extract base URL from API_URL
    let baseUrl: string;
    try {
      const apiUrl = new URL(API_URL);
      baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
    } catch {
      // Fallback if API_URL is not a valid URL
      baseUrl = API_URL.replace(/\/$/, '');
    }
    
    return `${baseUrl}/api/sse/backtest/${this.jobId}?token=${encodeURIComponent(this.token)}`;
  }

  /**
   * Fetch full result via REST API after SSE completion
   * SSE sends only result_summary to avoid large message sizes
   */
  private async fetchFullResult(): Promise<BacktestResponse | null> {
    try {
      console.log(`📡 Fetching full result for job ${this.jobId}...`);
      const job = await getBacktestJob(this.jobId);

      if (job.status === 'completed' && job.result) {
        console.log('✅ Full result retrieved from API:', {
          backtest_id: job.result.backtest_id,
          total_trades: job.result.total_trades,
          transactions_count: job.result.transactions?.length || 0,
          has_transactions: !!job.result.transactions,
          result_keys: Object.keys(job.result),
        });
        return job.result;
      }

      console.warn('⚠️ Job status is not completed or result not available:', {
        status: job.status,
        has_result: !!job.result,
        job_keys: Object.keys(job),
      });
      return null;
    } catch (error) {
      console.error('❌ Error fetching full result:', error);
      throw error;
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

