'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Strategy } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { useAutoSave } from '@/hooks/useAutoSave';
import { validateCode, type ValidationResult } from '@/lib/api/validation';
import { updateStrategy } from '@/lib/api/strategies';

interface CodeEditorProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
  marketType?: 'equity' | 'commodity' | 'currency' | 'futures';
  onCodeChange?: (code: string) => void;
  onValidationChange?: (validation: ValidationResult) => void;
  externalCode?: string | null; // Code to set from external source (e.g., AI chat)
}

export default function CodeEditor({ 
  currentStrategy, 
  onStrategyUpdate, 
  marketType = 'equity',
  onCodeChange,
  onValidationChange,
  externalCode
}: CodeEditorProps) {
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [isExternalCode, setIsExternalCode] = useState(false); // Track if code came from AI

  // Debounce code changes for auto-validation
  const debouncedCode = useDebounce(code, 1000);

  // Auto-save for existing strategies (disabled when code comes from AI)
  useAutoSave(
    currentStrategy?.id,
    code,
    !!currentStrategy && code.length > 0 && !isExternalCode
  );

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

  // Handle external code updates (e.g., from AI chat)
  useEffect(() => {
    if (externalCode && externalCode.trim()) {
      setIsExternalCode(true); // Mark as external code to disable auto-save
      setCode(externalCode);
      onCodeChange?.(externalCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCode]); // Only depend on externalCode to avoid loops

  // Validate code when it changes
  useEffect(() => {
    if (debouncedCode && debouncedCode.trim()) {
      validateCodeAsync(debouncedCode);
    } else {
      setValidation(null);
    }
  }, [debouncedCode, marketType]);

  const validateCodeAsync = async (codeToValidate: string) => {
    setValidating(true);
    try {
      const result = await validateCode({
        strategy_code: codeToValidate,
        market_type: marketType
      });
      setValidation(result);
      onValidationChange?.(result);
    } catch (err) {
      console.error('Validation error:', err);
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onCodeChange?.(newCode);
    // Once user manually edits, re-enable auto-save
    if (isExternalCode) {
      setIsExternalCode(false);
    }
  };

  const handleSave = async () => {
    if (!currentStrategy) {
      // TODO: Create new strategy
      return;
    }
    
    setIsSaving(true);
    try {
      // Save code (backend will extract model automatically)
      const updatedStrategy = await updateStrategy(currentStrategy.id, { strategy_code: code }, false); // manual save
      
      // Refresh strategy to get extracted model
      onStrategyUpdate();
      
      return updatedStrategy;
    } catch (err) {
      console.error('Failed to save strategy:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 min-h-0">
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
      <div className="flex-1 overflow-auto min-h-0">
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="w-full h-full bg-gray-900 text-gray-100 font-mono text-sm p-4 focus:outline-none resize-none"
          spellCheck={false}
          placeholder="Enter your strategy code here..."
        />
      </div>

      {/* Validation Results */}
      {validation && (
        <div className="border-t border-gray-700 bg-gray-900 p-4 max-h-48 overflow-y-auto">
          {validation.errors.length > 0 && (
            <div className="mb-2">
              <h4 className="font-semibold text-red-400 text-sm mb-1">Errors:</h4>
              {validation.errors.map((error, idx) => (
                <div key={idx} className="text-xs text-red-400 mb-1">
                  Line {error.line}: {error.message}
                </div>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="mb-2">
              <h4 className="font-semibold text-yellow-400 text-sm mb-1">Warnings:</h4>
              {validation.warnings.map((warning, idx) => (
                <div key={idx} className="text-xs text-yellow-400 mb-1">
                  Line {warning.line}: {warning.message}
                </div>
              ))}
            </div>
          )}
          {validation.suggestions.length > 0 && (
            <div>
              <h4 className="font-semibold text-blue-400 text-sm mb-1">Suggestions:</h4>
              {validation.suggestions.map((suggestion, idx) => (
                <div key={idx} className="text-xs text-blue-400 mb-1">
                  • {suggestion}
                </div>
              ))}
            </div>
          )}
          {validation.valid && validation.errors.length === 0 && validation.warnings.length === 0 && (
            <div className="text-xs text-green-400">
              ✓ Code is valid
            </div>
          )}
        </div>
      )}

      {validating && (
        <div className="border-t border-gray-700 p-2 text-xs text-gray-400 bg-gray-900">
          Validating...
        </div>
      )}
    </div>
  );
}

