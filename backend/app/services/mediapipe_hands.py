from __future__ import annotations

import os
import threading

# Silence noisy MediaPipe/absl logs before importing mediapipe.
os.environ.setdefault("GLOG_minloglevel", "2")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

from absl import logging as absl_logging

absl_logging.set_verbosity(absl_logging.ERROR)

from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import mediapipe as mp
import numpy as np


class HandsService:
    def __init__(
        self,
        weights_path: str,
        max_num_hands: int = 1,
        min_detection_confidence: float = 0.2,
        min_tracking_confidence: float = 0.3,
    ) -> None:
        self._lock = threading.Lock()
        
        base_options = python.BaseOptions(model_asset_path=weights_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_hands=max_num_hands,
            min_hand_detection_confidence=min_detection_confidence,
            min_hand_presence_confidence=min_tracking_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._landmarker = vision.HandLandmarker.create_from_options(options)

    def process(self, rgb: np.ndarray):
        # Convert numpy RGB to MediaPipe Image object
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        
        with self._lock:
            return self._landmarker.detect(mp_image)

    def close(self) -> None:
        with self._lock:
            self._landmarker.close()
