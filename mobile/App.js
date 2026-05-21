import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
  Switch,
  Share,
  Animated,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Settings, ShieldCheck, ImageIcon, X, Trash2, CheckCircle, Copy } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONFIG } from './config';
import { useASLWebSocket, WS_STATUS } from './hooks/useASLWebSocket';
import { PredictionCard } from './components/PredictionCard';
import { SettingsModal } from './components/SettingsModal';
import { WordDisplay } from './components/WordDisplay';
import { TranslationModal } from './components/TranslationModal';
import CameraBackground from './components/CameraBackground';
import { translateToArabic } from './services/translationService';

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPTURE_INTERVAL_MS = 250;
const STABILITY_REQUIRED = 4;

const MANUAL_CONF_THRESHOLD = 0.85;
const MANUAL_HOLD_MS = 1500;
const MANUAL_COOLDOWN_MS = 1000;

const AUTO_CONF_THRESHOLD = 0.80;
const AUTO_HOLD_MS = 1000;
const AUTO_COOLDOWN_MS = 1000;
const AUTO_NO_HAND_MS = 3000;

const STATUS_CONFIG = {
  [WS_STATUS.CONNECTING]:   { color: '#f59e0b', label: 'CONNECTING' },
  [WS_STATUS.CONNECTED]:    { color: '#10b981', label: 'LIVE' },
  [WS_STATUS.DISCONNECTED]: { color: '#ef4444', label: 'RECONNECTING' },
  [WS_STATUS.ERROR]:        { color: '#ef4444', label: 'ERROR' },
};

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// ─── Global CSS injected once for the web layout ──────────────────────────────

const WEB_CSS = `
  html, body, #root {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background: #0d1117 !important;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button { font-family: inherit; }

  .asl-root {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #0d1117;
    color: #fff;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .asl-cam-zone {
    width: 100%;
    height: 55vh;
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    background: #000;
  }
  .asl-cam-inner { width: 100%; height: 100%; position: relative; }

  .asl-live-badge {
    position: absolute; top: 12px; left: 12px;
    display: flex; align-items: center; gap: 6px;
    background: rgba(13,17,23,0.80);
    padding: 5px 12px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.12);
    z-index: 10; pointer-events: none;
  }
  .asl-live-dot { width: 7px; height: 7px; border-radius: 50%; }
  .asl-live-text { color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; }

  .asl-cam-controls {
    position: absolute; top: 12px; right: 12px;
    display: flex; gap: 8px; z-index: 10;
  }
  .asl-icon-btn {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(13,17,23,0.80);
    border: 1px solid rgba(255,255,255,0.12);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .asl-icon-btn:hover { background: rgba(30,41,59,0.95); }

  .asl-error-banner {
    position: absolute; bottom: 12px; left: 12px; right: 12px;
    background: rgba(239,68,68,0.92); color: #fff;
    padding: 7px 14px; border-radius: 10px;
    font-size: 12px; font-weight: 600; text-align: center; z-index: 10;
  }

  .asl-ui-zone { flex: 1; overflow-y: auto; border-top: 1px solid rgba(255,255,255,0.08); }
  .asl-ui-inner {
    padding: 14px 16px 20px; min-height: 100%;
    display: flex; flex-direction: column; gap: 10px;
  }

  .asl-card {
    background: #161b27; border-radius: 14px; padding: 14px 16px;
    border: 1px solid rgba(255,255,255,0.07);
  }
  .asl-card-flash {
    background: rgba(16,185,129,0.18) !important;
    border-color: rgba(16,185,129,0.45) !important;
  }

  .asl-letter {
    font-size: 80px; font-weight: 900; color: #fff; line-height: 1;
    text-align: center; text-shadow: 0 4px 20px rgba(99,102,241,0.45);
    letter-spacing: -2px; margin-bottom: 10px;
  }

  .asl-timer-wrap { display: flex; justify-content: center; margin-bottom: 10px; }

  .asl-conf-bg { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .asl-conf-fill { height: 100%; border-radius: 3px; transition: width 0.15s ease, background-color 0.3s; }
  .asl-conf-label {
    font-size: 11px; color: #64748b; margin-top: 6px; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
  }
  .asl-conf-ok { color: #10b981; font-weight: 700; }

  .asl-hand-row { display: flex; align-items: center; gap: 7px; margin-top: 8px; }
  .asl-hand-dot { width: 8px; height: 8px; border-radius: 50%; transition: background-color 0.3s; }
  .asl-hand-label { font-size: 11px; color: #94a3b8; font-weight: 600; }

  .asl-section-label {
    font-size: 9px; font-weight: 800; color: #475569; letter-spacing: 1.5px;
    text-transform: uppercase; display: block; margin-bottom: 6px;
  }

  .asl-word-text {
    font-size: 24px; font-weight: 700; color: #e2e8f0; letter-spacing: 3px;
    min-height: 32px; display: block;
  }
  .asl-word-placeholder { color: #2d3748; font-weight: 400; }

  .asl-btn-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .asl-action-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(13,17,23,0.6); color: #94a3b8;
    font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;
  }
  .asl-action-btn:hover:not(:disabled) { background: rgba(30,41,59,0.85); }
  .asl-action-btn:disabled { opacity: 0.35; cursor: default; }

  .asl-detected-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
  }
  .asl-detected-header-btns { display: flex; gap: 6px; align-items: center; }
  .asl-trash-btn {
    background: none; border: none; cursor: pointer;
    padding: 2px; display: flex; align-items: center; opacity: 0.6;
  }
  .asl-trash-btn:hover { opacity: 1; }
  .asl-detected-text {
    font-size: 16px; font-weight: 600; color: #a5b4fc; line-height: 1.6; min-height: 24px;
  }

  .asl-server-info {
    text-align: center; font-size: 10px; color: #2d3748;
    font-weight: 600; letter-spacing: 0.5px; padding-top: 2px;
  }

  /* ── Desktop two-column layout (≥768px) ── */
  @media (min-width: 768px) {
    .asl-ui-inner { flex-direction: row; align-items: flex-start; gap: 20px; }
    .asl-col-left { flex: 0 0 42%; display: flex; flex-direction: column; gap: 10px; }
    .asl-col-right { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  }
  @media (max-width: 767px) {
    .asl-col-left, .asl-col-right { display: contents; }
  }

  /* ── Upload modal ── */
  .asl-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.82);
    display: flex; align-items: flex-end; justify-content: center; z-index: 1000;
  }
  .asl-modal-card {
    width: 100%; max-width: 560px; background: #0f172a;
    border-top-left-radius: 24px; border-top-right-radius: 24px;
    padding: 24px; border: 1px solid rgba(255,255,255,0.1); min-height: 260px;
  }
  .asl-modal-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  }
  .asl-modal-title { font-size: 18px; font-weight: 700; color: #fff; }
  .asl-modal-close { background: none; border: none; cursor: pointer; display: flex; padding: 4px; }
  .asl-upload-preview {
    width: 100%; max-height: 220px; object-fit: contain;
    border-radius: 12px; background: #1e293b; display: block;
  }
  .asl-upload-result { text-align: center; margin-top: 16px; }
  .asl-upload-letter { font-size: 64px; font-weight: 900; color: #fff; }
  .asl-upload-conf { font-size: 14px; color: #a5b4fc; font-weight: 600; margin-top: 4px; }
  .asl-upload-hand-row {
    display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 6px;
  }
  .asl-upload-hand-dot { width: 7px; height: 7px; border-radius: 50%; }
  .asl-upload-hand-text { font-size: 13px; color: #64748b; font-weight: 500; }
  .asl-spinner-wrap { display: flex; justify-content: center; margin-top: 24px; }

  /* ── Mode toggle ── */
  .asl-mode-toggle {
    display: flex; border-radius: 10px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1); background: rgba(13,17,23,0.6);
  }
  .asl-mode-btn {
    flex: 1; padding: 7px 0; border: none; background: none;
    color: #64748b; font-size: 12px; font-weight: 700;
    cursor: pointer; letter-spacing: 0.5px; transition: background 0.2s, color 0.2s;
  }
  .asl-mode-btn.active { background: rgba(99,102,241,0.22); color: #a5b4fc; }
  .asl-mode-btn.auto-active { background: rgba(16,185,129,0.22); color: #10b981; }

  /* ── Auto-validate banner (camera overlay) ── */
  .asl-auto-banner {
    position: absolute; bottom: 12px; left: 12px; right: 12px;
    background: rgba(15,23,42,0.96); border: 1px solid rgba(16,185,129,0.45);
    border-radius: 12px; padding: 10px 14px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    z-index: 20;
  }
  .asl-auto-banner-text { font-size: 12px; font-weight: 600; color: #e2e8f0; flex: 1; }
  .asl-auto-banner-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .asl-auto-banner-btn {
    padding: 5px 12px; border-radius: 8px; border: none;
    font-size: 11px; font-weight: 700; cursor: pointer;
  }
  .asl-auto-banner-btn.confirm { background: #10b981; color: #fff; }
  .asl-auto-banner-btn.confirm:hover { background: #059669; }
  .asl-auto-banner-btn.dismiss { background: rgba(255,255,255,0.1); color: #94a3b8; }
  .asl-auto-banner-btn.dismiss:hover { background: rgba(255,255,255,0.18); }

  /* ── Upload validation actions ── */
  .asl-upload-actions { display: flex; gap: 10px; margin-top: 16px; }
  .asl-upload-btn {
    flex: 1; padding: 11px 0; border-radius: 12px; border: none;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.15s;
  }
  .asl-upload-btn:hover:not(:disabled) { opacity: 0.85; }
  .asl-upload-btn:disabled { opacity: 0.35; cursor: default; }
  .asl-upload-btn.accept { background: #10b981; color: #fff; }
  .asl-upload-btn.refuse {
    background: rgba(239,68,68,0.12); color: #ef4444;
    border: 1px solid rgba(239,68,68,0.3);
  }

  /* ── Copy button ── */
  .asl-copy-btn {
    background: none; border: none; cursor: pointer;
    padding: 2px 5px; display: flex; align-items: center; gap: 4px;
    color: #64748b; font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
    opacity: 0.65; transition: opacity 0.15s, color 0.15s; border-radius: 5px;
  }
  .asl-copy-btn:hover:not(:disabled) { opacity: 1; }
  .asl-copy-btn:disabled { opacity: 0.25; cursor: default; }
  .asl-copy-btn.copied { color: #10b981; opacity: 1; }

  /* ── Multi-hand upload display ── */
  .asl-upload-hands-row {
    display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 16px;
  }
  .asl-upload-hand-chip {
    display: flex; flex-direction: column; align-items: center;
    background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3);
    border-radius: 14px; padding: 12px 18px;
  }
  .asl-upload-chip-letter {
    font-size: 52px; font-weight: 900; color: #fff; line-height: 1;
    text-shadow: 0 2px 12px rgba(99,102,241,0.5);
  }
  .asl-upload-chip-conf { font-size: 11px; color: #a5b4fc; font-weight: 600; margin-top: 4px; }
  .asl-upload-composed {
    font-size: 40px; font-weight: 900; color: #10b981; text-align: center;
    letter-spacing: 6px; margin-top: 14px; line-height: 1;
    text-shadow: 0 2px 16px rgba(16,185,129,0.4);
  }
`;

// ─── Web-only: Landmark canvas overlay ───────────────────────────────────────

function LandmarkCanvas({ landmarks, width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (!landmarks || landmarks.length === 0) return;

    const pts = landmarks.map(p => ({
      x: (1 - p.x) * width,
      y: p.y * height,
    }));

    ctx.strokeStyle = 'rgba(99,102,241,0.85)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const [a, b] of HAND_CONNECTIONS) {
      if (!pts[a] || !pts[b]) continue;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }

    for (let i = 0; i < pts.length; i++) {
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, isTip ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? '#a5b4fc' : '#6366f1';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [landmarks, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

// ─── Web-only: Circular progress timer ───────────────────────────────────────

function CircularTimer({ progress }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  return (
    <svg width={50} height={50} style={{ display: 'block' }}>
      <circle cx={25} cy={25} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={3} fill="none" />
      <circle
        cx={25} cy={25} r={r}
        stroke="#10b981" strokeWidth={3} fill="none"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '25px 25px', transition: 'stroke-dashoffset 0.1s linear' }}
      />
    </svg>
  );
}

// ─── Web layout ───────────────────────────────────────────────────────────────

function WebLayout({
  cameraRef,
  startCapture,
  prediction,
  confidence,
  handDetected,
  landmarks,
  status,
  wsError,
  isConnected,
  config,
  pickAndUpload,
  setIsSettingsVisible,
  showUploadModal,
  setShowUploadModal,
  uploadPreviewUri,
  isUploading,
  uploadResult,
  isAutoMode,
  setIsAutoMode,
}) {
  const { color: statusColor, label: statusLabel } =
    STATUS_CONFIG[status] ?? STATUS_CONFIG[WS_STATUS.DISCONNECTED];

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('asl-css')) return;
    const el = document.createElement('style');
    el.id = 'asl-css';
    el.textContent = WEB_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById('asl-css')?.remove(); };
  }, []);

  // Measure camera zone for canvas pixel dimensions
  const camZoneRef = useRef(null);
  const [camSize, setCamSize] = useState({ width: 1280, height: 720 });
  useEffect(() => {
    const el = camZoneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCamSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Accumulation state ──
  const [currentWord, setCurrentWord] = useState('');
  const [detectedText, setDetectedText] = useState('');
  const [flashGreen, setFlashGreen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showAutoValidateBanner, setShowAutoValidateBanner] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Refs for rAF loop (avoids stale closures)
  const predRef = useRef(prediction);
  const confRef = useRef(confidence);
  const handRef = useRef(handDetected);
  const isAutoModeRef = useRef(isAutoMode);
  const currentWordRef = useRef(currentWord);
  predRef.current = prediction;
  confRef.current = confidence;
  handRef.current = handDetected;
  isAutoModeRef.current = isAutoMode;
  currentWordRef.current = currentWord;

  const holdStartRef = useRef(null);
  const cooldownUntilRef = useRef(0);
  const lastCommittedRef = useRef(null);
  const animFrameRef = useRef(null);

  // Auto mode tracking refs
  const handEverGoneRef = useRef(false);
  const noHandSinceRef = useRef(null);
  const prevHandRef = useRef(false);
  const showBannerRef = useRef(false);

  // Tracked timeout refs — cancelled on unmount to prevent state updates after unmount
  const flashTimeoutRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  // Reset all tracking when mode switches
  useEffect(() => {
    holdStartRef.current = null;
    lastCommittedRef.current = null;
    cooldownUntilRef.current = 0;
    handEverGoneRef.current = false;
    noHandSinceRef.current = null;
    if (showBannerRef.current) {
      showBannerRef.current = false;
      setShowAutoValidateBanner(false);
    }
  }, [isAutoMode]);

  // rAF loop: drives progress ring, commits letters, manages auto banner
  const tick = useCallback(() => {
    const now = Date.now();
    const isAuto = isAutoModeRef.current;
    const holdMS = isAuto ? AUTO_HOLD_MS : MANUAL_HOLD_MS;
    const cooldownMS = isAuto ? AUTO_COOLDOWN_MS : MANUAL_COOLDOWN_MS;

    // Track hand transitions
    const handNow = handRef.current;
    if (!handNow && prevHandRef.current) {
      handEverGoneRef.current = true;
      if (noHandSinceRef.current === null) noHandSinceRef.current = now;
    }
    if (handNow) noHandSinceRef.current = null;
    prevHandRef.current = handNow;

    // Auto-validate banner: 3s without hand while word is in progress
    if (isAuto && !handNow && noHandSinceRef.current !== null) {
      if (now - noHandSinceRef.current >= AUTO_NO_HAND_MS && currentWordRef.current.trim()) {
        if (!showBannerRef.current) {
          showBannerRef.current = true;
          setShowAutoValidateBanner(true);
        }
      }
    } else if (showBannerRef.current && (handNow || !isAuto)) {
      showBannerRef.current = false;
      setShowAutoValidateBanner(false);
    }

    // Hold timer + commit
    if (holdStartRef.current !== null) {
      const elapsed = now - holdStartRef.current;
      setHoldProgress(Math.min(elapsed / holdMS, 1));

      if (elapsed >= holdMS) {
        const pred = predRef.current;
        if (pred && pred !== 'nothing') {
          // Anti-doublon: in auto mode, block same letter unless hand was absent between commits
          const blocked = isAuto && pred === lastCommittedRef.current && !handEverGoneRef.current;
          if (!blocked) {
            if (pred === 'space')       setCurrentWord(p => p + ' ');
            else if (pred === 'del')    setCurrentWord(p => p.slice(0, -1));
            else if (pred.length === 1) setCurrentWord(p => p + pred.toUpperCase());
            lastCommittedRef.current = pred;
            if (isAuto) handEverGoneRef.current = false;
            holdStartRef.current = null;
            cooldownUntilRef.current = now + cooldownMS;
            setFlashGreen(true);
            clearTimeout(flashTimeoutRef.current);
            flashTimeoutRef.current = setTimeout(() => setFlashGreen(false), 450);
          } else {
            holdStartRef.current = null;
            cooldownUntilRef.current = now + cooldownMS;
          }
        }
      }
    } else {
      setHoldProgress(0);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(flashTimeoutRef.current);
      clearTimeout(copyTimeoutRef.current);
    };
  }, [tick]);

  // Start / reset hold when prediction quality or mode changes
  useEffect(() => {
    const now = Date.now();
    const inCooldown = now < cooldownUntilRef.current;
    const confThreshold = isAutoMode ? AUTO_CONF_THRESHOLD : MANUAL_CONF_THRESHOLD;
    const valid = prediction !== 'nothing' && confidence >= confThreshold && handDetected;

    if (!valid || inCooldown) {
      holdStartRef.current = null;
      lastCommittedRef.current = null;
    } else if (holdStartRef.current === null) {
      holdStartRef.current = now;
      lastCommittedRef.current = null;
    }
  }, [prediction, confidence, handDetected, isAutoMode]);

  // ── Actions ──

  const validateWord = () => {
    if (!currentWord.trim()) return;
    setDetectedText(prev => (prev ? prev + ' ' + currentWord.trim() : currentWord.trim()));
    setCurrentWord('');
    showBannerRef.current = false;
    setShowAutoValidateBanner(false);
    noHandSinceRef.current = null;
  };

  const dismissBanner = () => {
    showBannerRef.current = false;
    setShowAutoValidateBanner(false);
    noHandSinceRef.current = null;
  };

  const deleteLastLetter = () => setCurrentWord(p => p.slice(0, -1));
  const clearDetectedText = () => setDetectedText('');

  const handleCopy = () => {
    if (!detectedText) return;
    navigator.clipboard.writeText(detectedText).then(() => {
      setCopiedFeedback(true);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedFeedback(false), 1500);
    }).catch(() => {});
  };

  const handleUploadAccept = () => {
    if (uploadResult?.hands && uploadResult.hands.length > 1) {
      const valid = uploadResult.hands.filter(h => h.pred !== 'nothing');
      if (valid.length > 0) {
        const word = valid.map(h => h.pred.toUpperCase()).join('');
        setDetectedText(prev => prev ? prev + ' ' + word : word);
      }
    } else if (uploadResult?.pred && uploadResult.pred !== 'nothing') {
      const letter = uploadResult.pred.toUpperCase();
      setDetectedText(prev => prev ? prev + ' ' + letter : letter);
    }
    setShowUploadModal(false);
  };

  const activeThreshold = isAutoMode ? AUTO_CONF_THRESHOLD : MANUAL_CONF_THRESHOLD;
  const showTimer = prediction !== 'nothing' && confidence >= activeThreshold && handDetected && holdProgress > 0;

  return (
    <div className="asl-root">
      {/* ── Camera zone ── */}
      <div className="asl-cam-zone" ref={camZoneRef}>
        <div className="asl-cam-inner">
          <CameraBackground
            ref={cameraRef}
            style={{ width: '100%', height: '100%' }}
            onCameraReady={startCapture}
          >
            <LandmarkCanvas landmarks={landmarks} width={camSize.width} height={camSize.height} />
          </CameraBackground>
        </div>

        <div className="asl-live-badge">
          <div className="asl-live-dot" style={{ backgroundColor: statusColor }} />
          <span className="asl-live-text">{statusLabel}</span>
        </div>

        <div className="asl-cam-controls">
          <button className="asl-icon-btn" onClick={pickAndUpload} title="Analyser une image">
            <ImageIcon size={18} color="#94a3b8" />
          </button>
          <button className="asl-icon-btn" onClick={() => setIsSettingsVisible(true)} title="Paramètres">
            <Settings size={18} color="#94a3b8" />
          </button>
        </div>

        {wsError && !isConnected && (
          <div className="asl-error-banner">{wsError}</div>
        )}

        {/* Auto-validate banner: shown after 3s no-hand with word in progress */}
        {showAutoValidateBanner && (
          <div className="asl-auto-banner">
            <span className="asl-auto-banner-text">
              Aucune main — valider&nbsp;«&nbsp;{currentWord.trim()}&nbsp;»&nbsp;?
            </span>
            <div className="asl-auto-banner-actions">
              <button className="asl-auto-banner-btn confirm" onClick={validateWord}>Valider</button>
              <button className="asl-auto-banner-btn dismiss" onClick={dismissBanner}>Ignorer</button>
            </div>
          </div>
        )}
      </div>

      {/* ── UI zone ── */}
      <div className="asl-ui-zone">
        <div className="asl-ui-inner">

          {/* LEFT COLUMN */}
          <div className="asl-col-left">
            <div className={`asl-card${flashGreen ? ' asl-card-flash' : ''}`}>
              <div className="asl-letter">
                {prediction === 'nothing' ? '—' : prediction.toUpperCase()}
              </div>
              {showTimer && (
                <div className="asl-timer-wrap">
                  <CircularTimer progress={holdProgress} />
                </div>
              )}
              <div className="asl-conf-bg">
                <div
                  className="asl-conf-fill"
                  style={{
                    width: `${(confidence * 100).toFixed(1)}%`,
                    backgroundColor: confidence >= activeThreshold ? '#10b981' : '#6366f1',
                  }}
                />
              </div>
              <div className="asl-conf-label">
                {(confidence * 100).toFixed(1)}% confiance
                {confidence >= activeThreshold && prediction !== 'nothing' && (
                  <span className="asl-conf-ok">≥ {isAutoMode ? '80' : '85'}%</span>
                )}
              </div>
              <div className="asl-hand-row">
                <div className="asl-hand-dot" style={{ backgroundColor: handDetected ? '#10b981' : '#475569' }} />
                <span className="asl-hand-label">{handDetected ? 'Main détectée' : 'Aucune main'}</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="asl-col-right">
            {/* Mode toggle */}
            <div className="asl-mode-toggle">
              <button
                className={`asl-mode-btn${!isAutoMode ? ' active' : ''}`}
                onClick={() => setIsAutoMode(false)}
              >
                Manuel
              </button>
              <button
                className={`asl-mode-btn${isAutoMode ? ' auto-active' : ''}`}
                onClick={() => setIsAutoMode(true)}
              >
                Auto
              </button>
            </div>

            {/* Current word */}
            <div className="asl-card">
              <span className="asl-section-label">MOT EN COURS</span>
              <span className="asl-word-text">
                {currentWord || <span className="asl-word-placeholder">…</span>}
              </span>
              <div className="asl-btn-row">
                <button
                  className="asl-action-btn"
                  onClick={validateWord}
                  disabled={!currentWord.trim()}
                >
                  <CheckCircle size={14} color={currentWord.trim() ? '#10b981' : '#475569'} />
                  Valider mot
                </button>
                <button
                  className="asl-action-btn"
                  onClick={deleteLastLetter}
                  disabled={!currentWord}
                >
                  <X size={14} color={currentWord ? '#f59e0b' : '#475569'} />
                  Supprimer lettre
                </button>
              </div>
            </div>

            {/* Detected text */}
            <div className="asl-card">
              <div className="asl-detected-header">
                <span className="asl-section-label" style={{ marginBottom: 0 }}>TEXTE DÉTECTÉ</span>
                <div className="asl-detected-header-btns">
                  <button
                    className={`asl-copy-btn${copiedFeedback ? ' copied' : ''}`}
                    onClick={handleCopy}
                    disabled={!detectedText}
                    title="Copier"
                  >
                    <Copy size={11} color={copiedFeedback ? '#10b981' : '#64748b'} />
                    {copiedFeedback ? 'COPIÉ' : 'COPIER'}
                  </button>
                  <button className="asl-trash-btn" onClick={clearDetectedText} title="Effacer tout">
                    <Trash2 size={14} color="#64748b" />
                  </button>
                </div>
              </div>
              <div className="asl-detected-text">
                {detectedText || <span style={{ color: '#2d3748' }}>Aucun texte</span>}
              </div>
            </div>

            <div className="asl-server-info">{config.SERVER_IP}:{config.PORT}</div>
          </div>

        </div>
      </div>

      {/* ── Upload modal ── */}
      {showUploadModal && (
        <div className="asl-modal-overlay">
          <div className="asl-modal-card">
            <div className="asl-modal-header">
              <span className="asl-modal-title">Prédiction image</span>
              <button className="asl-modal-close" onClick={() => setShowUploadModal(false)}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>
            {uploadPreviewUri && (
              <img src={uploadPreviewUri} alt="aperçu" className="asl-upload-preview" />
            )}
            {isUploading ? (
              <div className="asl-spinner-wrap">
                <ActivityIndicator size="large" color="#6366f1" />
              </div>
            ) : uploadResult ? (() => {
                const isMulti = !!(uploadResult.hands && uploadResult.hands.length > 1);
                const validH = isMulti ? uploadResult.hands.filter(h => h.pred !== 'nothing') : [];
                const composed = validH.map(h => h.pred.toUpperCase()).join('');
                const avgConf = validH.length > 0
                  ? validH.reduce((s, h) => s + h.confidence, 0) / validH.length : 0;
                const acceptOff = isMulti
                  ? validH.length === 0
                  : (uploadResult.pred === 'nothing' || !uploadResult.hand_detected);
                return (
                  <>
                    {isMulti ? (
                      <div className="asl-upload-result">
                        <div className="asl-upload-hands-row">
                          {validH.length > 0 ? validH.map((h, i) => (
                            <div key={i} className="asl-upload-hand-chip">
                              <div className="asl-upload-chip-letter">{h.pred.toUpperCase()}</div>
                              <div className="asl-upload-chip-conf">{(h.confidence * 100).toFixed(0)}%</div>
                            </div>
                          )) : (
                            <span style={{ color: '#64748b', fontSize: '14px' }}>Aucun signe détecté</span>
                          )}
                        </div>
                        <div className="asl-upload-composed">{composed || '—'}</div>
                        <div className="asl-upload-conf">Conf. moy. {(avgConf * 100).toFixed(1)}%</div>
                      </div>
                    ) : (
                      <div className="asl-upload-result">
                        <div className="asl-upload-letter">
                          {uploadResult.pred === 'nothing' ? '?' : uploadResult.pred.toUpperCase()}
                        </div>
                        <div className="asl-upload-conf">
                          {(uploadResult.confidence * 100).toFixed(1)}% confiance
                        </div>
                        <div className="asl-upload-hand-row">
                          <div
                            className="asl-upload-hand-dot"
                            style={{ backgroundColor: uploadResult.hand_detected ? '#10b981' : '#ef4444' }}
                          />
                          <span className="asl-upload-hand-text">
                            {uploadResult.hand_detected ? 'Main détectée' : 'Aucune main'}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="asl-upload-actions">
                      <button
                        className="asl-upload-btn accept"
                        onClick={handleUploadAccept}
                        disabled={acceptOff}
                      >
                        ✅ Accepter
                      </button>
                      <button
                        className="asl-upload-btn refuse"
                        onClick={() => setShowUploadModal(false)}
                      >
                        ❌ Refuser
                      </button>
                    </div>
                  </>
                );
              })() : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [_camPermission, requestPermission] = useCameraPermissions();
  const permission = Platform.OS === 'web' ? { granted: true } : _camPermission;

  const [config, setConfig] = useState(CONFIG);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoMode, setIsAutoMode] = useState(false);

  // Mobile manual mode: stability-counter accumulation
  const [accumulatedText, setAccumulatedText] = useState(''); // MOT EN COURS (camera letters)
  const [finalText, setFinalText] = useState('');             // TEXTE DÉTECTÉ (upload results)
  const [lastCommittedSign, setLastCommittedSign] = useState(null);
  const stabilityCounter = useRef(0);
  const lastPrediction = useRef(null);

  // Translation
  const [translationVisible, setTranslationVisible] = useState(false);
  const [translationOriginal, setTranslationOriginal] = useState('');
  const [translationResult, setTranslationResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Speech-to-Text (web only)
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  // Image upload (shared)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadPreviewUri, setUploadPreviewUri] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const cameraRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const isCapturingRef = useRef(false);

  const wsUrl = `ws://${config.SERVER_IP}:${config.PORT}/api/v1/ws/predict`;
  const apiBase = `http://${config.SERVER_IP}:${config.PORT}/api/v1`;

  const { prediction, confidence, handDetected, landmarks, isConnected, status, wsError, sendFrame } =
    useASLWebSocket(wsUrl);

  // ── Mobile: sync latest values into refs for the auto interval ──
  const mPredRef = useRef('nothing');
  const mConfRef = useRef(0);
  const mHandRef = useRef(false);
  const mAccTextRef = useRef('');
  mPredRef.current = prediction;
  mConfRef.current = confidence;
  mHandRef.current = handDetected;
  mAccTextRef.current = accumulatedText;

  // ── Mobile: auto mode tracking refs ──
  const mHoldStartRef = useRef(null);
  const mCooldownUntilRef = useRef(0);
  const mLastCommittedRef = useRef(null);
  const mHandEverGoneRef = useRef(false);
  const mNoHandSinceRef = useRef(null);
  const mPrevHandRef = useRef(false);
  const mBannerShownRef = useRef(false);
  const autoIntervalRef = useRef(null);

  // ── Mobile manual mode: stability counter ──
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (isAutoMode) return; // auto mode handles commits via its own interval

    if (prediction === 'nothing') {
      stabilityCounter.current = 0;
      lastPrediction.current = 'nothing';
      setLastCommittedSign(null);
      return;
    }
    if (prediction === lastPrediction.current) {
      stabilityCounter.current += 1;
    } else {
      stabilityCounter.current = 0;
      lastPrediction.current = prediction;
    }
    if (stabilityCounter.current >= STABILITY_REQUIRED && prediction !== lastCommittedSign) {
      commitSign(prediction);
      setLastCommittedSign(prediction);
      stabilityCounter.current = 0;
    }
  }, [prediction, lastCommittedSign, isAutoMode]);

  // ── Mobile auto mode: time-based interval ──
  useEffect(() => {
    if (Platform.OS === 'web' || !isAutoMode) {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
      return;
    }

    // Reset tracking when entering auto mode
    mHoldStartRef.current = null;
    mCooldownUntilRef.current = 0;
    mLastCommittedRef.current = null;
    mHandEverGoneRef.current = false;
    mNoHandSinceRef.current = null;
    mPrevHandRef.current = false;
    mBannerShownRef.current = false;

    autoIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const pred = mPredRef.current;
      const conf = mConfRef.current;
      const hand = mHandRef.current;

      // Track hand transitions
      if (!hand && mPrevHandRef.current) {
        mHandEverGoneRef.current = true;
        if (mNoHandSinceRef.current === null) mNoHandSinceRef.current = now;
      }
      if (hand) mNoHandSinceRef.current = null;
      mPrevHandRef.current = hand;

      // 3s no-hand with word in progress → Alert (once per absence)
      if (!hand && mNoHandSinceRef.current !== null) {
        if (
          now - mNoHandSinceRef.current >= AUTO_NO_HAND_MS &&
          mAccTextRef.current.trim() &&
          !mBannerShownRef.current
        ) {
          mBannerShownRef.current = true;
          Alert.alert(
            'Aucune main détectée',
            `Mot en cours : "${mAccTextRef.current.trim()}"\n\nContinuer ou effacer ?`,
            [
              {
                text: 'Effacer',
                style: 'destructive',
                onPress: () => {
                  setAccumulatedText('');
                  mBannerShownRef.current = false;
                },
              },
              {
                text: 'Continuer',
                onPress: () => { mBannerShownRef.current = false; },
              },
            ]
          );
        }
      } else if (hand) {
        mBannerShownRef.current = false;
      }

      // Check detection validity
      const inCooldown = now < mCooldownUntilRef.current;
      const valid = pred !== 'nothing' && conf >= AUTO_CONF_THRESHOLD && hand && !inCooldown;

      if (!valid) {
        if (!hand || pred === 'nothing') mHoldStartRef.current = null;
        return;
      }

      if (mHoldStartRef.current === null) {
        mHoldStartRef.current = now;
        return;
      }

      const elapsed = now - mHoldStartRef.current;
      if (elapsed >= AUTO_HOLD_MS) {
        const blocked = pred === mLastCommittedRef.current && !mHandEverGoneRef.current;
        if (!blocked) {
          commitSign(pred);
          mLastCommittedRef.current = pred;
          mHandEverGoneRef.current = false;
          mHoldStartRef.current = null;
          mCooldownUntilRef.current = now + AUTO_COOLDOWN_MS;
        } else {
          mHoldStartRef.current = null;
          mCooldownUntilRef.current = now + AUTO_COOLDOWN_MS;
        }
      }
    }, 100);

    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [isAutoMode]);

  const commitSign = useCallback((sign) => {
    if (sign === 'space')       setAccumulatedText(p => p + ' ');
    else if (sign === 'del')    setAccumulatedText(p => p.slice(0, -1));
    else if (sign.length === 1) setAccumulatedText(p => p + sign.toUpperCase());
  }, []);

  // Load saved config from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const savedIP   = await AsyncStorage.getItem('SERVER_IP');
        const savedPort = await AsyncStorage.getItem('PORT');
        if (savedIP && savedPort) {
          setConfig(prev => ({ ...prev, SERVER_IP: savedIP, PORT: savedPort }));
        }
      } catch (err) {
        console.warn('Failed to load config:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveConfig = async (newConfig) => {
    try {
      await AsyncStorage.setItem('SERVER_IP', newConfig.SERVER_IP);
      await AsyncStorage.setItem('PORT', newConfig.PORT);
      setConfig(prev => ({ ...prev, ...newConfig }));
    } catch (err) {
      console.warn('Failed to save config:', err);
    }
  };

  const startCapture = useCallback(() => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    captureIntervalRef.current = setInterval(async () => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true, quality: 0.2, skipProcessing: true, shutterSound: false,
        });
        if (photo?.base64) sendFrame(`data:image/jpeg;base64,${photo.base64}`);
      } catch { /* ignore transient capture errors */ }
    }, CAPTURE_INTERVAL_MS);
  }, [sendFrame]);

  const stopCapture = () => {
    isCapturingRef.current = false;
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  useEffect(() => () => stopCapture(), []);

  const pickAndUpload = async () => {
    if (Platform.OS !== 'web') {
      const { status: ps } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (ps !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setUploadPreviewUri(asset.uri);
    setUploadResult(null);
    setIsUploading(true);
    setShowUploadModal(true);

    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        formData.append('image', blob, 'photo.jpg');
      } else {
        formData.append('image', { uri: asset.uri, name: 'photo.jpg', type: 'image/jpeg' });
      }
      const resp = await fetch(`${apiBase}/predict/image`, { method: 'POST', body: formData });
      if (!resp.ok) throw new Error(`Server error (${resp.status})`);
      setUploadResult(await resp.json());
    } catch (err) {
      Alert.alert('Erreur de détection', err.message || 'Impossible de contacter le serveur.');
      setShowUploadModal(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMobileUploadAccept = () => {
    if (uploadResult?.hands && uploadResult.hands.length > 1) {
      const valid = uploadResult.hands.filter(h => h.pred !== 'nothing');
      if (valid.length > 0) {
        const word = valid.map(h => h.pred.toUpperCase()).join('');
        setFinalText(prev => prev ? prev + ' ' + word : word);
      }
    } else if (uploadResult?.pred && uploadResult.pred !== 'nothing' && uploadResult.hand_detected) {
      const letter = uploadResult.pred.toUpperCase();
      setFinalText(prev => prev ? prev + ' ' + letter : letter);
    }
    setShowUploadModal(false);
  };

  const handleFinalTextCopy = async () => {
    if (!finalText) return;
    try {
      await Share.share({ message: finalText });
    } catch {}
  };

  const handleTranslate = useCallback(async (text) => {
    if (!text?.trim()) return;
    setTranslationOriginal(text);
    setTranslationResult('');
    setTranslationError(false);
    setIsTranslating(true);
    setTranslationVisible(true);
    try {
      const result = await translateToArabic(text.trim());
      setTranslationResult(result);
    } catch {
      setTranslationError(true);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const handleSpeechToText = useCallback(() => {
    if (Platform.OS !== 'web') {
      Alert.alert('Non supporté sur cet appareil');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert('Non supporté sur cet appareil');
      return;
    }

    // Second press while listening → stop early
    if (isListeningRef.current) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    };

    recognition.onresult = (event) => {
      setManualInput(event.results[0][0].transcript);
    };

    const cleanupRecognition = () => {
      isListeningRef.current = false;
      setIsListening(false);
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      pulseAnim.setValue(1);
      recognitionRef.current = null;
    };

    recognition.onerror = cleanupRecognition;
    recognition.onend = cleanupRecognition;

    recognition.start();
  }, [pulseAnim]);

  // Stop any in-progress recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      pulseLoopRef.current?.stop();
    };
  }, []);

  // ─── Loading / Permission gates ───────────────────────────────────────────

  if (isLoading || (!permission && Platform.OS !== 'web')) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (Platform.OS !== 'web' && !permission?.granted) {
    return (
      <View style={styles.centeredScreen}>
        <ShieldCheck size={64} color="#6366f1" style={{ marginBottom: 20 }} />
        <Text style={styles.permissionText}>Camera access required for ASL detection</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Web render ───────────────────────────────────────────────────────────

  if (Platform.OS === 'web') {
    return (
      <>
        <WebLayout
          cameraRef={cameraRef}
          startCapture={startCapture}
          prediction={prediction}
          confidence={confidence}
          handDetected={handDetected}
          landmarks={landmarks}
          status={status}
          wsError={wsError}
          isConnected={isConnected}
          config={config}
          pickAndUpload={pickAndUpload}
          setIsSettingsVisible={setIsSettingsVisible}
          showUploadModal={showUploadModal}
          setShowUploadModal={setShowUploadModal}
          uploadPreviewUri={uploadPreviewUri}
          isUploading={isUploading}
          uploadResult={uploadResult}
          isAutoMode={isAutoMode}
          setIsAutoMode={setIsAutoMode}
        />
        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          config={config}
          onSave={saveConfig}
        />
      </>
    );
  }

  // ─── Native (iOS / Android) render ───────────────────────────────────────

  const { color: statusColor, label: statusLabel } =
    STATUS_CONFIG[status] ?? STATUS_CONFIG[WS_STATUS.DISCONNECTED];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <CameraBackground ref={cameraRef} style={styles.camera} onCameraReady={startCapture}>
        <SafeAreaView style={styles.overlay}>
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.iconButton} onPress={pickAndUpload}>
                <ImageIcon size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, { marginLeft: 8 }]}
                onPress={() => setIsSettingsVisible(true)}
              >
                <Settings size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeToggleRow}>
            <Text style={[styles.modeLabel, !isAutoMode && styles.modeLabelManual]}>Manuel</Text>
            <Switch
              value={isAutoMode}
              onValueChange={setIsAutoMode}
              trackColor={{ false: '#334155', true: '#10b981' }}
              thumbColor={isAutoMode ? '#fff' : '#94a3b8'}
              style={{ marginHorizontal: 8 }}
            />
            <Text style={[styles.modeLabel, isAutoMode && styles.modeLabelAuto]}>Auto</Text>
          </View>

          {wsError && !isConnected && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{wsError}</Text>
            </View>
          )}

          <View style={styles.wordSection}>
            <WordDisplay
              text={accumulatedText}
              onClear={() => setAccumulatedText('')}
              onTranslate={handleTranslate}
            />
          </View>

          <View style={styles.finalTextSection}>
            <View style={styles.finalTextCard}>
              <View style={styles.finalTextHeader}>
                <View style={styles.finalTextTitleRow}>
                  <CheckCircle size={13} color="#a5b4fc" />
                  <Text style={styles.finalTextTitle}>TEXTE DÉTECTÉ</Text>
                </View>
                <View style={styles.finalTextHeaderBtns}>
                  <TouchableOpacity
                    style={[styles.finalTextTranslateBtn, !accumulatedText && { opacity: 0.4 }]}
                    onPress={() => handleTranslate(accumulatedText)}
                    disabled={!accumulatedText}
                  >
                    <Text style={styles.finalTextTranslateTxt}>ترجمة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.finalTextActionBtn}
                    onPress={handleFinalTextCopy}
                    disabled={!finalText}
                  >
                    <Copy size={16} color={finalText ? '#64748b' : '#2d3748'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.finalTextActionBtn}
                    onPress={() => setFinalText('')}
                    disabled={!finalText}
                  >
                    <Trash2 size={16} color={finalText ? '#64748b' : '#2d3748'} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.finalTextContent, !finalText && styles.finalTextEmpty]}>
                {finalText || 'Aucun texte'}
              </Text>
            </View>
          </View>

          <View style={styles.mainContent}>
            <PredictionCard prediction={prediction} confidence={confidence} handDetected={handDetected} />
          </View>

          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder={isListening ? 'Écoute...' : 'Saisir du texte...'}
              placeholderTextColor={isListening ? '#e74c3c' : '#6b7280'}
              returnKeyType="done"
              editable={!isListening}
            />
            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginLeft: 8 }}>
              <TouchableOpacity
                style={[styles.micBtn, isListening && styles.micBtnListening]}
                onPress={handleSpeechToText}
              >
                <Text style={styles.micBtnText}>🎤</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity
              style={[styles.manualTranslateBtn, !manualInput.trim() && { opacity: 0.4 }]}
              onPress={() => handleTranslate(manualInput)}
              disabled={!manualInput.trim()}
            >
              <Text style={styles.manualTranslateBtnText}>ترجمة</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <View style={styles.infoPill}>
              <Text style={styles.infoText}>{config.SERVER_IP}:{config.PORT}</Text>
            </View>
          </View>
        </SafeAreaView>
      </CameraBackground>

      {/* Upload modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadCard}>
            <View style={styles.uploadHeader}>
              <Text style={styles.uploadTitle}>Image Prediction</Text>
              <TouchableOpacity
                onPress={() => setShowUploadModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {uploadPreviewUri && (
              <Image source={{ uri: uploadPreviewUri }} style={styles.uploadPreview} resizeMode="contain" />
            )}
            {isUploading ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 24 }} />
            ) : uploadResult ? (() => {
                const isMulti = !!(uploadResult.hands && uploadResult.hands.length > 1);
                const validH = isMulti ? uploadResult.hands.filter(h => h.pred !== 'nothing') : [];
                const composed = validH.map(h => h.pred.toUpperCase()).join('');
                const avgConf = validH.length > 0
                  ? validH.reduce((s, h) => s + h.confidence, 0) / validH.length : 0;
                const acceptOff = isMulti
                  ? validH.length === 0
                  : (!uploadResult.hand_detected || uploadResult.pred === 'nothing');
                return (
                  <>
                    {isMulti ? (
                      <View style={styles.uploadResultContent}>
                        <View style={styles.uploadHandsRow}>
                          {validH.length > 0 ? validH.map((h, i) => (
                            <View key={i} style={styles.uploadHandChip}>
                              <Text style={styles.uploadChipLetter}>{h.pred.toUpperCase()}</Text>
                              <Text style={styles.uploadChipConf}>{(h.confidence * 100).toFixed(0)}%</Text>
                            </View>
                          )) : (
                            <Text style={{ color: '#64748b', fontSize: 14 }}>Aucun signe détecté</Text>
                          )}
                        </View>
                        <Text style={styles.uploadComposedWord}>{composed || '—'}</Text>
                        <Text style={styles.uploadConfidence}>
                          Conf. moy. {(avgConf * 100).toFixed(1)}%
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.uploadResultContent}>
                        <Text style={styles.uploadPredLetter}>
                          {uploadResult.pred === 'nothing' ? '?' : uploadResult.pred.toUpperCase()}
                        </Text>
                        <Text style={styles.uploadConfidence}>
                          Confidence: {(uploadResult.confidence * 100).toFixed(1)}%
                        </Text>
                        <View style={styles.uploadHandRow}>
                          <View style={[styles.uploadHandDot, { backgroundColor: uploadResult.hand_detected ? '#10b981' : '#ef4444' }]} />
                          <Text style={styles.uploadHandText}>
                            {uploadResult.hand_detected ? 'Hand detected' : 'No hand detected'}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.uploadActions}>
                      <TouchableOpacity
                        style={[styles.uploadActionBtn, styles.uploadAcceptBtn, acceptOff && styles.uploadBtnDisabled]}
                        onPress={handleMobileUploadAccept}
                        disabled={acceptOff}
                      >
                        <Text style={styles.uploadAcceptText}>✅ Accepter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.uploadActionBtn, styles.uploadRefuseBtn]}
                        onPress={() => setShowUploadModal(false)}
                      >
                        <Text style={styles.uploadRefuseText}>❌ Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })() : null}
          </View>
        </View>
      </Modal>

      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        config={config}
        onSave={saveConfig}
      />

      <TranslationModal
        visible={translationVisible}
        onClose={() => setTranslationVisible(false)}
        originalText={translationOriginal}
        translatedText={translationResult}
        isLoading={isTranslating}
        error={translationError}
      />
    </View>
  );
}

// ─── Native StyleSheet (iOS / Android only) ───────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centeredScreen: {
    flex: 1, backgroundColor: '#0f172a',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  permissionText: {
    color: '#fff', fontSize: 18, textAlign: 'center',
    marginBottom: 32, fontWeight: '500', lineHeight: 26,
  },
  permissionButton: {
    backgroundColor: '#6366f1', paddingVertical: 16,
    paddingHorizontal: 32, borderRadius: 16, width: '100%', alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: 44, height: 44, backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modeToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginTop: 10,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modeLabel: { color: '#475569', fontSize: 12, fontWeight: '700' },
  modeLabelManual: { color: '#a5b4fc' },
  modeLabelAuto: { color: '#10b981' },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.92)', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 14, marginTop: 8,
  },
  errorText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  wordSection: { marginTop: 12 },
  mainContent: { marginBottom: 8 },
  footer: { alignItems: 'center', paddingBottom: 10 },
  infoPill: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 12,
  },
  infoText: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  uploadOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  uploadCard: {
    backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minHeight: 340,
  },
  uploadHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  uploadTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  uploadPreview: { width: '100%', height: 180, borderRadius: 16, backgroundColor: '#1e293b' },
  uploadResultContent: { alignItems: 'center', marginTop: 20 },
  uploadPredLetter: {
    color: '#fff', fontSize: 72, fontWeight: '900',
    textShadowColor: 'rgba(99,102,241,0.5)',
    textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10,
  },
  uploadConfidence: { color: '#a5b4fc', fontSize: 16, fontWeight: '600', marginTop: 8 },
  uploadHandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  uploadHandDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  uploadHandText: { color: '#64748b', fontSize: 14, fontWeight: '500' },
  uploadActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  uploadActionBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
  },
  uploadAcceptBtn: { backgroundColor: '#10b981' },
  uploadRefuseBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  uploadBtnDisabled: { opacity: 0.35 },
  uploadAcceptText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  uploadRefuseText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
  // TEXTE DÉTECTÉ zone (upload results)
  finalTextSection: { marginTop: 8 },
  finalTextCard: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(165,180,252,0.2)',
  },
  finalTextHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  finalTextTitleRow: { flexDirection: 'row', alignItems: 'center' },
  finalTextTitle: {
    color: '#a5b4fc', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginLeft: 6,
  },
  finalTextHeaderBtns: { flexDirection: 'row', alignItems: 'center' },
  finalTextActionBtn: { padding: 4, marginLeft: 8 },
  finalTextTranslateBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  finalTextTranslateTxt: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  finalTextContent: { color: '#a5b4fc', fontSize: 15, fontWeight: '600', lineHeight: 22, minHeight: 22 },
  finalTextEmpty: { color: '#2d3748' },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.5)',
  },
  manualTranslateBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 0,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  manualTranslateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  micBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnListening: {
    backgroundColor: '#e74c3c',
  },
  micBtnText: {
    fontSize: 20,
  },
  // Multi-hand upload chips
  uploadHandsRow: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16,
  },
  uploadHandChip: {
    alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
  },
  uploadChipLetter: { color: '#fff', fontSize: 44, fontWeight: '900', lineHeight: 50 },
  uploadChipConf: { color: '#a5b4fc', fontSize: 11, fontWeight: '600', marginTop: 2 },
  uploadComposedWord: {
    color: '#10b981', fontSize: 38, fontWeight: '900', textAlign: 'center',
    letterSpacing: 6, marginTop: 12,
  },
});
