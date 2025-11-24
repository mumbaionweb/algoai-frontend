import { useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { updateStrategy } from '@/lib/api/strategies';
import type { StrategyUpdate } from '@/types';

export function useAutoSave(
  strategyId: string | undefined,
  code: string,
  enabled: boolean = true
) {
  const debouncedCode = useDebounce(code, 2000); // 2 second debounce
  const lastSavedCode = useRef<string>('');

  useEffect(() => {
    if (!enabled || !strategyId || !debouncedCode || debouncedCode === lastSavedCode.current) {
      return;
    }

    const save = async () => {
      try {
        const updates: StrategyUpdate = { strategy_code: debouncedCode };
        await updateStrategy(strategyId, updates, true); // auto_save = true
        lastSavedCode.current = debouncedCode;
        console.log('Auto-saved strategy code');
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    };

    save();
  }, [debouncedCode, strategyId, enabled]);
}

