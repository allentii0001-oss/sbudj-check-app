import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getValue<T,>(key: string, initialValue: T | (() => T)): T {
  const savedValue = localStorage.getItem(key);
  if (savedValue) {
    try {
      return JSON.parse(savedValue);
    } catch (error) {
      console.error('Error parsing JSON from localStorage', error);
      localStorage.removeItem(key);
    }
  }

  if (initialValue instanceof Function) {
    return initialValue();
  }
  return initialValue;
}

// FIX: Replaced React.Dispatch<React.SetStateAction<T>> with Dispatch<SetStateAction<T>> and added relevant imports to fix namespace error.
export function useLocalStorage<T,>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => getValue(key, initialValue));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
