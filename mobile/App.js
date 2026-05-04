import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { Settings, ShieldCheck } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Internal Imports
import { CONFIG } from './config';
import { useASLWebSocket } from './hooks/useASLWebSocket';
import { PredictionCard } from './components/PredictionCard';
import { SettingsModal } from './components/SettingsModal';
import { WordDisplay } from './components/WordDisplay';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// Stability constants
const STABILITY_REQUIRED = 4; // Number of consistent frames needed

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [config, setConfig] = useState(CONFIG);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Word Construction State
  const [accumulatedText, setAccumulatedText] = useState("");
  const [lastCommittedSign, setLastCommittedSign] = useState(null);
  const stabilityCounter = useRef(0);
  const lastPrediction = useRef(null);
  
  const cameraRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // WebSocket Hook
  const { prediction, confidence, isConnected, sendFrame } = useASLWebSocket(
    `ws://${config.SERVER_IP}:${config.PORT}/api/v1/ws/predict`
  );

  // Logic to accumulate letters
  useEffect(() => {
    if (prediction === 'nothing') {
      stabilityCounter.current = 0;
      lastPrediction.current = 'nothing';
      setLastCommittedSign(null); // Allow re-adding the same letter after 'nothing'
      return;
    }

    if (prediction === lastPrediction.current) {
      stabilityCounter.current += 1;
    } else {
      stabilityCounter.current = 0;
      lastPrediction.current = prediction;
    }

    // If stable and not just added
    if (stabilityCounter.current >= STABILITY_REQUIRED && prediction !== lastCommittedSign) {
      handleCommit(prediction);
      setLastCommittedSign(prediction);
      stabilityCounter.current = 0;
    }
  }, [prediction]);

  const handleCommit = (sign) => {
    if (sign === 'space') {
      setAccumulatedText(prev => prev + " ");
    } else if (sign === 'del') {
      setAccumulatedText(prev => prev.slice(0, -1));
    } else if (sign.length === 1) { // A-Z
      setAccumulatedText(prev => prev + sign.toUpperCase());
    }
  };

  // Load persisted config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedIP = await AsyncStorage.getItem('SERVER_IP');
        const savedPort = await AsyncStorage.getItem('PORT');
        if (savedIP && savedPort) {
          setConfig({ ...CONFIG, SERVER_IP: savedIP, PORT: savedPort });
        }
      } catch (err) {
        console.error('Failed to load config', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const saveConfig = async (newConfig) => {
    try {
      await AsyncStorage.setItem('SERVER_IP', newConfig.SERVER_IP);
      await AsyncStorage.setItem('PORT', newConfig.PORT);
      setConfig(prev => ({ ...prev, ...newConfig }));
    } catch (err) {
      console.error('Failed to save config', err);
    }
  };

  const startCapture = () => {
    if (isCapturing) return;
    setIsCapturing(true);
    
    captureIntervalRef.current = setInterval(async () => {
      if (cameraRef.current && isConnected) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.1, 
            scale: 0.3,   
            shutterSound: false,
          });

          sendFrame(`data:image/jpeg;base64,${photo.base64}`);
        } catch (error) {
          console.log('Capture error:', error);
        }
      }
    }, 300);
  };

  const stopCapture = () => {
    setIsCapturing(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
  };

  useEffect(() => {
    return () => stopCapture();
  }, []);

  if (isLoading || !permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <ShieldCheck size={64} color="#6366f1" style={{ marginBottom: 20 }} />
        <Text style={styles.permissionText}>Camera access required for ASL detection</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <CameraView 
        style={styles.camera} 
        ref={cameraRef}
        facing="front"
        onCameraReady={() => startCapture()}
      >
        <SafeAreaView style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
              <Text style={styles.statusText}>{isConnected ? 'LIVE' : 'DISCONNECTED'}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => setIsSettingsVisible(true)}
            >
              <Settings size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Word Display (New Part) */}
          <View style={styles.wordSection}>
            <WordDisplay 
              text={accumulatedText} 
              onClear={() => setAccumulatedText("")} 
            />
          </View>

          {/* Prediction Card */}
          <View style={styles.mainContent}>
            <PredictionCard prediction={prediction} confidence={confidence} />
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <View style={styles.infoPill}>
              <Text style={styles.infoText}>Server: {config.SERVER_IP}:{config.PORT}</Text>
            </View>
          </View>
        </SafeAreaView>
      </CameraView>

      <SettingsModal 
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        config={config}
        onSave={saveConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
    lineHeight: 26,
  },
  permissionButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  wordSection: {
    marginTop: 20,
  },
  mainContent: {
    marginBottom: 40,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  infoPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
