import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Trash2, Type } from 'lucide-react-native';

export const WordDisplay = ({ text, onClear }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Type size={16} color="#6366f1" />
          <Text style={styles.title}>DETECTED TEXT</Text>
        </View>
        <TouchableOpacity onPress={onClear} style={styles.clearButton}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.textContainer}
      >
        <Text style={styles.mainText}>
          {text || "Start signing..."}
        </Text>
        {text.length > 0 && <View style={styles.cursor} />}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    minHeight: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginLeft: 6,
  },
  clearButton: {
    padding: 4,
  },
  textContainer: {
    alignItems: 'center',
    paddingRight: 20,
  },
  mainText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cursor: {
    width: 12,
    height: 28,
    backgroundColor: '#6366f1',
    marginLeft: 4,
    borderRadius: 2,
  }
});
