import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    SERVICE_NAME: str = "SmartPresence Face Recognition Service"
    ENVIRONMENT: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Internal communication secret between Node.js and FastAPI
    INTERNAL_API_SECRET: str = "smartpresence_internal_secret_2026"
    
    # Model configuration (Permissive Apache 2.0 / MIT OpenCV Zoo models)
    YUNET_MODEL_PATH: str = str(BASE_DIR / "models_bin" / "face_detection_yunet_2023mar.onnx")
    SFACE_MODEL_PATH: str = str(BASE_DIR / "models_bin" / "face_recognition_sface_2021dec.onnx")
    MODEL_IDENTIFIER: str = "opencv_yunet_sface_v1"
    
    # Recognition thresholds
    ACCEPTANCE_THRESHOLD: float = 0.52
    REJECTION_THRESHOLD: float = 0.36
    
    # Detection thresholds
    DETECTION_SCORE_THRESHOLD: float = 0.65
    DETECTION_NMS_THRESHOLD: float = 0.3
    MIN_FACE_SIZE_PX: int = 24
    
    # Limits
    MAX_IMAGE_SIZE_MB: int = 15
    MAX_PHOTOS_PER_SESSION: int = 8
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
