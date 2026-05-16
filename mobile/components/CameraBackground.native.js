import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { CameraView } from 'expo-camera';

// Mobile: wraps expo-camera CameraView and exposes takePictureAsync via ref
const CameraBackground = forwardRef(({ style, onCameraReady, children }, ref) => {
  const cameraRef = useRef(null);

  useImperativeHandle(ref, () => ({
    takePictureAsync: async (options) => {
      if (!cameraRef.current) return null;
      return cameraRef.current.takePictureAsync(options);
    },
  }));

  return (
    <CameraView
      ref={cameraRef}
      style={style}
      facing="front"
      onCameraReady={onCameraReady}
    >
      {children}
    </CameraView>
  );
});

export default CameraBackground;
