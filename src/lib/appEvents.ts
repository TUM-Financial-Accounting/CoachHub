import { useEffect, useRef } from 'react';

export type AppEvent = 'open-create-team' | 'open-create-season' | 'open-search';

export function emitAppEvent(name: AppEvent): void {
  window.dispatchEvent(new Event(name));
}

export function useAppEvent(name: AppEvent, handler: () => void): void {
  // Latest handler without re-subscribing on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = () => handlerRef.current();
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [name]);
}
