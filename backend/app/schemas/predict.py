from pydantic import BaseModel, Field


class WSControl(BaseModel):
    smoothing_window: int | None = Field(default=None, ge=1, le=60)
    confidence_threshold: float | None = Field(default=None, ge=0.05, le=0.99)
    send_landmarks: bool | None = None


class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float | None = None


class HandResult(BaseModel):
    pred: str
    confidence: float = Field(ge=0.0, le=1.0)
    hand_detected: bool = True
    landmarks: list[LandmarkPoint] | None = None


class PredictResponse(BaseModel):
    pred: str
    confidence: float = Field(ge=0.0, le=1.0)
    hand_detected: bool
    # Multi-hand results; None when only one hand was detected or endpoint
    # did not request it, so existing clients are unaffected.
    hands: list[HandResult] | None = None


class WSFrameIn(BaseModel):
    frame: str | None = None
    image: str | None = None
    control: WSControl | None = None


class WSFrameOut(BaseModel):
    pred: str
    confidence: float = Field(ge=0.0, le=1.0)
    hand_detected: bool
    landmarks: list[LandmarkPoint] | None = None
    # Per-hand breakdown; None when no hand was detected.
    hands: list[HandResult] | None = None
