import { useState, useEffect } from 'react';

export interface ReadableAtom<T> {
  get(): T;
  subscribe(callback: (value: T) => void): () => void;
}

export interface WritableAtom<T> extends ReadableAtom<T> {
  set(value: T): void;
}

export function atom<T>(initialValue: T): WritableAtom<T> {
  let value = initialValue;
  const listeners = new Set<(val: T) => void>();

  return {
    get() {
      return value;
    },
    set(nextValue: T) {
      value = nextValue;
      listeners.forEach((listener) => listener(value));
    },
    subscribe(listener: (val: T) => void) {
      listeners.add(listener);
      listener(value);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function computed<T, A, B>(
  stores: [ReadableAtom<A>, ReadableAtom<B>],
  fn: (a: A, b: B) => T,
): ReadableAtom<T> {
  let value = fn(stores[0].get(), stores[1].get());
  const listeners = new Set<(val: T) => void>();

  const update = () => {
    value = fn(stores[0].get(), stores[1].get());
    listeners.forEach((listener) => listener(value));
  };

  stores[0].subscribe(update);
  stores[1].subscribe(update);

  return {
    get() {
      return value;
    },
    subscribe(listener: (val: T) => void) {
      listeners.add(listener);
      listener(value);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T>(store: ReadableAtom<T>): T {
  const [val, setVal] = useState(() => store.get());
  useEffect(() => store.subscribe(setVal), [store]);
  return val;
}
