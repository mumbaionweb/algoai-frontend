import { apiClient } from './client';

export interface ValidationIssue {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: string[];
}

export interface ValidateCodeRequest {
  strategy_code: string;
  market_type?: string;
}

/**
 * Validate strategy code
 */
export async function validateCode(request: ValidateCodeRequest): Promise<ValidationResult> {
  const response = await apiClient.post<ValidationResult>('/api/strategies/validate-code', request);
  return response.data;
}

