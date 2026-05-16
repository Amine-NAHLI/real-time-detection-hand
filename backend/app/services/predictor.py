from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

from app.services.mediapipe_hands import HandsService
from app.services.preprocessing import build_features, normalize_landmarks


class Predictor:
    def __init__(
        self,
        model: torch.jit.ScriptModule,
        labels: list[str],
        device: str,
        confidence_threshold: float,
        preprocess_config_path: Path,
        hands_service: HandsService,
    ) -> None:
        self.model = model
        self.labels = labels
        self.device = device
        self.confidence_threshold = float(confidence_threshold)
        self.hands = hands_service

        self.include_z = True
        self.include_bones = True
        self.include_angles = True
        self.include_hand_present = True

        if preprocess_config_path.exists():
            payload = json.loads(preprocess_config_path.read_text(encoding='utf-8'))
            self.include_z = bool(payload.get('include_z', True))
            self.include_bones = bool(payload.get('include_bones', True))
            self.include_angles = bool(payload.get('include_angles', True))
            self.include_hand_present = bool(payload.get('include_hand_present', True))

    def _classify_landmark(
        self,
        lm,
        threshold: float,
        return_landmarks: bool,
    ) -> dict:
        pts = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)
        pts_norm = normalize_landmarks(pts)
        feat = build_features(
            pts_norm,
            include_z=self.include_z,
            include_bones=self.include_bones,
            include_angles=self.include_angles,
            include_hand_present=self.include_hand_present,
            hand_present=1,
        )
        xt = torch.from_numpy(feat).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            logits = self.model(xt)
            probs = torch.softmax(logits, dim=1)[0]
            conf_t, idx_t = torch.max(probs, dim=0)

        confidence = float(conf_t.item())
        pred = self.labels[int(idx_t.item())]
        lm_out = (
            [{'x': float(p.x), 'y': float(p.y), 'z': float(p.z)} for p in lm]
            if return_landmarks else None
        )
        return {
            'pred': pred if confidence >= threshold else 'nothing',
            'confidence': confidence,
            'hand_detected': True,
            'landmarks': lm_out,
        }

    def predict_rgb(
        self,
        rgb: np.ndarray,
        *,
        return_landmarks: bool = False,
        confidence_threshold: float | None = None,
    ) -> tuple[str, float, bool, list[dict[str, float]] | None, list[dict]]:
        """
        Returns (pred, confidence, hand_detected, landmarks, hands_out).

        The first four values reflect the first detected hand for backward
        compatibility. `hands_out` is the full per-hand list; it is empty
        when no hand is detected.
        """
        result = self.hands.process(rgb)
        if not result.hand_landmarks:
            return 'nothing', 0.0, False, None, []

        threshold = (
            self.confidence_threshold if confidence_threshold is None
            else float(confidence_threshold)
        )
        hands_out = [
            self._classify_landmark(lm, threshold, return_landmarks)
            for lm in result.hand_landmarks
        ]

        first = hands_out[0]
        return first['pred'], first['confidence'], True, first['landmarks'], hands_out
