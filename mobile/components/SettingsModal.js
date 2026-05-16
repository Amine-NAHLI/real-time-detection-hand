import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Server, Globe } from 'lucide-react-native';

export const SettingsModal = ({ visible, onClose, config, onSave }) => {
  const [ip, setIp] = useState(config.SERVER_IP);
  const [port, setPort] = useState(config.PORT);

  // Sync local state whenever the modal opens or config changes externally
  useEffect(() => {
    if (visible) {
      setIp(config.SERVER_IP);
      setPort(config.PORT);
    }
  }, [visible, config]);

  const handleSave = () => {
    onSave({ SERVER_IP: ip.trim(), PORT: port.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={60} tint="dark" style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Network Settings</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#94a3b8" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Globe size={16} color="#6366f1" />
              <Text style={styles.label}>SERVER IP ADDRESS</Text>
            </View>
            <TextInput
              style={styles.input}
              value={ip}
              onChangeText={setIp}
              placeholder="192.168.1.XX"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Server size={16} color="#6366f1" />
              <Text style={styles.label}>SERVER PORT</Text>
            </View>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="8091"
              placeholderTextColor="#475569"
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Apply Changes</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
