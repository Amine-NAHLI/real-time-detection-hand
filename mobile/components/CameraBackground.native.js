import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { CameraView } from 'expo-camera';
import { StyleSheet, View } from 'react-native';

// Mobile: wraps expo-camera CameraView and exposes takePictureAsync via ref.
// Renders children as parallel sibling with absolute fill to satisfy no-children constraint on CameraView.
const CameraBackground = forwardRef(({ style, onCameraReady, children }, ref) => {
  const cameraRef = useRef(null);

  useImperativeHandle(ref, () => ({
    takePictureAsync: async (options) => {
      if (!cameraRef.current) return null;
      return cameraRef.current.takePictureAsync(options);
    },
  }));

  return (
    <View style={[style, styles.container]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        flash="off"
        onCameraReady={onCameraReady}
      />
      {children && (
        <View style={StyleSheet.absoluteFill}>
          {children}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
});

export default CameraBackground;
