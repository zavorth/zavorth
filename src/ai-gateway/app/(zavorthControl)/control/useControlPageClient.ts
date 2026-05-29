import { useState, useRef, useEffect } from "react";

export type ControlPageClientState = {
  wsReconnectAttempt: number;
};

export function useControlPageClient() {
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);

  const fetchJson = async (url: string) => {
    const res = await fetch(url);
    return res.json();
  };

  const loadControlState = async () => {
    return fetchJson("/api/gateway-control");
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      setWsReconnectAttempt((prev) => prev + 1);
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return {
    wsReconnectAttempt,
    loadControlState,
    scheduleReconnect,
  };
}
