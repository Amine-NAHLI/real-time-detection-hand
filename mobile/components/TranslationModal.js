import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';

export const TranslationModal = ({ visible, onClose, originalText, translatedText, isLoading, error }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>ترجمة إلى العربية</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>النص الأصلي</Text>
            <ScrollView style={styles.textBox} nestedScrollEnabled>
              <Text style={styles.originalText}>{originalText}</Text>
            </ScrollView>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>الترجمة بالعربية</Text>
            {isLoading ? (
              <ActivityIndicator size="large" color="#6366f1" style={styles.spinner} />
            ) : error ? (
              <Text style={styles.errorText}>Erreur de traduction</Text>
            ) : (
              <ScrollView style={styles.textBox} nestedScrollEnabled>
                <Text style={styles.arabicText}>{translatedText}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 360,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeX: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  textBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  originalText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  arabicText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 34,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  spinner: {
    marginVertical: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
