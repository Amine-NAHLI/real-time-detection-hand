import { useState, useEffect, useRef, useCallback } from 'react';

export const useASLWebSocket = (url) => {
  const [prediction, setPrediction] = useState('nothing');
  const [confidence, setConfidence] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('Connecting to:', url);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.pred) {
          setPrediction(data.pred);
          setConfidence(data.confidence || 0);
        }
      } catch (err) {
        console.error('Message parsing error:', err);
      }
    };

    ws.onerror = (e) => {
      console.log('WebSocket Error:', e.message);
      setError('Connection Error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket Closed');
      setIsConnected(false);
      // Auto reconnect
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const sendFrame = (frameBase64) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({ frame: frameBase64 });
      wsRef.current.send(payload);
    }
  };

  return { prediction, confidence, isConnected, error, sendFrame };
};
