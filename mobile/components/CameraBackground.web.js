import React, { forwardRef, useRef, useEffect, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';

// Web: wraps getUserMedia video stream and exposes takePictureAsync via ref.
// Captures frames via canvas — same JPEG base64 format as expo-camera on mobile.
const CameraBackground = forwardRef(({ style, onCameraReady, children }, ref) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Keep a stable ref to onCameraReady so the effect (which runs once) always
  // calls the latest version without needing it in the dependency array.
  const onCameraReadyRef = useRef(onCameraReady);
  onCameraReadyRef.current = onCameraReady;

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          onCameraReadyRef.current?.();
        }
      } catch (err) {
        console.warn('Web camera error:', err.message || err);
      }
    }

    start();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useImperativeHandle(ref, () => ({
    takePictureAsync: async (options = {}) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      // Draw without mirroring — send natural image to backend (matches web frontend behavior)
      ctx.drawImage(video, 0, 0);

      const quality = options.quality ?? 0.2;
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1];
      return { base64, uri: dataUrl };
    },
  }));

  return (
    <View style={[style, styles.container]}>
      {/* Camera feed — mirrored via CSS for a natural selfie view */}
      <video
        ref={videoRef}
        style={videoStyle}
        autoPlay
        muted
        playsInline
      />
      {/* Overlay UI sits on top of the video */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
});

// Inline style for the <video> element (must use DOM style, not RN StyleSheet)
const videoStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'scaleX(-1)', // Mirror display only — capture is not mirrored
};

export default CameraBackground;
