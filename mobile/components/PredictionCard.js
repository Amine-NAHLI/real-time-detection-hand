import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Zap } from 'lucide-react-native';

export const PredictionCard = ({ prediction, confidence, handDetected }) => {
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Zap size={16} color="#6366f1" fill="#6366f1" />
        <Text style={styles.label}>LIVE RECOGNITION</Text>
      </View>

      <Text style={styles.predictionText}>
        {prediction === 'nothing' ? '...' : prediction.toUpperCase()}
      </Text>

      <View style={styles.handStatusRow}>
        <View
          style={[
            styles.handDot,
            { backgroundColor: handDetected ? '#10b981' : '#ef4444' },
          ]}
        />
        <Text style={styles.handStatusText}>
          {handDetected ? 'Hand Detected' : 'No Hand'}
        </Text>
      </View>

      <View style={styles.confidenceRow}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${confidence * 100}%` }]} />
        </View>
        <Text style={styles.confidenceText}>{(confidence * 100).toFixed(0)}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginLeft: 8,
  },
  predictionText: {
    color: '#fff',
    fontSize: 84,
    fontWeight: '900',
    marginVertical: 4,
    textShadowColor: 'rgba(99, 102, 241, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  handStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  handDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  handStatusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  confidenceText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '800',
    width: 45,
  },
});
