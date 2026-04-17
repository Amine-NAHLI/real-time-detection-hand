import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { Settings, Info, Connectivity, ShieldCheck, Zap } from 'lucide-react-native';

const WINDOW_WIDTH = Dimensions.get('window').width;
const WINDOW_HEIGHT = Dimensions.get('window').height;

// --- CONFIGURATION ---
// Replace this with your computer's local IP address
const SERVER_IP = '10.200.11.248'; 
const PORT = '8091';
const WS_URL = `ws://${SERVER_IP}:${PORT}/api/v1/ws/predict`;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [prediction, setPrediction] = useState('nothing');
  const [confidence, setConfidence] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const cameraRef = useRef(null);
  const wsRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // Initialize WebSocket
  const connectWebSocket = () => {
    console.log('Connecting to:', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.pred) {
        setPrediction(data.pred);
        setConfidence(data.confidence || 0);
      }
    };

    ws.onerror = (e) => console.log('WebSocket Error:', e.message);
    ws.onclose = () => {
      console.log('WebSocket Closed');
      setIsConnected(false);
      // Try to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      stopCapture();
    };
  }, []);

  const startCapture = () => {
    if (isCapturing) return;
    setIsCapturing(true);
    
    captureIntervalRef.current = setInterval(async () => {
      if (cameraRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Take a very low quality, small snapshot for performance
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.1, // Very low quality to reduce data size
            scale: 0.3,   // Small scale
            shutterSound: false,
          });

          const payload = {
            frame: `data:image/jpeg;base64,${photo.base64}`
          };
          
          wsRef.current.send(JSON.stringify(payload));
        } catch (error) {
          console.log('Capture error:', error);
        }
      }
    }, 250); // Send 4 frames per second
  };

  const stopCapture = () => {
    setIsCapturing(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
  };

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera access is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
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
          {/* Header Stats */}
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
              <Text style={styles.statusText}>{isConnected ? 'LIVE CONNECTED' : 'OFFLINE'}</Text>
            </View>
            <View style={styles.iconGroup}>
              <TouchableOpacity style={styles.iconButton}>
                <Settings size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Prediction Card */}
          <View style={styles.predictionCard}>
            <View style={styles.predictionLabelRow}>
              <Zap size={16} color="#6366f1" />
              <Text style={styles.predictionLabel}>CURRENT SIGN</Text>
            </View>
            <Text style={styles.predictionText}>
              {prediction.toUpperCase()}
            </Text>
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBarBg}>
                <View style={[styles.confidenceBarFill, { width: `${confidence * 100}%` }]} />
              </View>
              <Text style={styles.confidenceText}>{(confidence * 100).toFixed(0)}%</Text>
            </View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.footer}>
            <View style={styles.infoBox}>
              <ShieldCheck size={18} color="#a5b4fc" />
              <Text style={styles.infoText}>ASL Recognition Active</Text>
            </View>
          </View>
        </SafeAreaView>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  iconGroup: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  predictionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  predictionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionLabel: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginLeft: 6,
  },
  predictionText: {
    color: '#fff',
    fontSize: 72,
    fontWeight: '900',
    marginVertical: 10,
  },
  confidenceRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  confidenceBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  confidenceText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '700',
    width: 40,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoText: {
    color: '#a5b4fc',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
