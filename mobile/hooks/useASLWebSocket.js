import { useState, useEffect, useRef, useCallback } from 'react';

export const WS_STATUS = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
};

const MIN_DELAY = 1000;
const MAX_DELAY = 30000;
const GROWTH = 1.4;

export const useASLWebSocket = (url) => {
  const [prediction, setPrediction] = useState('nothing');
  const [confidence, setConfidence] = useState(0);
  const [handDetected, setHandDetected] = useState(false);
  const [landmarks, setLandmarks] = useState(null);
  const [status, setStatus] = useState(WS_STATUS.DISCONNECTED);
  const [wsError, setWsError] = useState(null);

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    let delay = MIN_DELAY;

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function connect() {
      if (!aliveRef.current) return;
      clearTimer();
      setStatus(WS_STATUS.CONNECTING);

      console.log('─────────────────────────────────────');
      console.log('🔌 [WS] Attempting connection to:', url);
      console.log('─────────────────────────────────────');

      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error('❌ [WS] Failed to create WebSocket:', err.message || err);
        setStatus(WS_STATUS.ERROR);
        setWsError('Invalid server URL — check IP and port in Settings');
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!aliveRef.current) { ws.close(); return; }
        console.log('✅ [WS] CONNECTED successfully to:', url);
        setStatus(WS_STATUS.CONNECTED);
        setWsError(null);
        delay = MIN_DELAY;
        // Ask backend to include MediaPipe landmarks in every response
        ws.send(JSON.stringify({ control: { send_landmarks: true } }));
      };

      ws.onmessage = (e) => {
        if (!aliveRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.pred !== undefined) {
            setPrediction(data.pred);
            setConfidence(data.confidence ?? 0);
            setHandDetected(data.hand_detected ?? false);
            setLandmarks(data.landmarks ?? null);
          } else if (data.detail) {
            console.warn('⚠️ [WS] Server detail message:', data.detail);
            setWsError(data.detail);
          }
        } catch (parseErr) {
          console.error('❌ [WS] Failed to parse message:', parseErr.message);
          setWsError('Invalid response from server');
        }
      };

      ws.onerror = (event) => {
        if (!aliveRef.current) return;
        console.error('❌ [WS] CONNECTION ERROR to:', url);
        console.error('❌ [WS] Error event:', JSON.stringify(event, null, 2));
        console.error('❌ [WS] ReadyState:', ws.readyState);
        setStatus(WS_STATUS.ERROR);
        setWsError('Connection failed — check server IP and port in Settings');
      };

      ws.onclose = (event) => {
        if (!aliveRef.current) return;
        console.log('🔒 [WS] Connection CLOSED. Code:', event.code, 'Reason:', event.reason || '(none)');
        console.log('🔒 [WS] Will retry in', Math.round(delay / 1000), 'seconds...');
        setStatus(WS_STATUS.DISCONNECTED);
        // Exponential backoff before reconnecting
        timerRef.current = setTimeout(() => {
          delay = Math.min(delay * GROWTH, MAX_DELAY);
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      aliveRef.current = false;
      clearTimer();
      if (wsRef.current) {
        wsRef.current.close(1000, 'unmount');
        wsRef.current = null;
      }
    };
  }, [url]); // Full reconnect when URL changes (e.g. after settings update)

  const sendFrame = useCallback((frameBase64) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ frame: frameBase64 }));
    }
  }, []);

  return {
    prediction,
    confidence,
    handDetected,
    landmarks,
    isConnected: status === WS_STATUS.CONNECTED,
    status,
    wsError,
    sendFrame,
  };
};
