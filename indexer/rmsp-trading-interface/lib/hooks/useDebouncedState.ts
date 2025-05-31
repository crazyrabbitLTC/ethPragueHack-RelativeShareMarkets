import { useState, useEffect, useRef } from 'react';

export function useDebouncedState<T>(initialValue: T, delay: number = 500): [T, T, (value: T) => void] {
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update internal value when initialValue changes
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(initialValue);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [initialValue, delay]);

  return [debouncedValue, initialValue, () => {}];
}