import os
from fastapi import APIRouter, status
from app.config import settings

router = APIRouter(tags=["Health & Readiness"])

@router.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "environment": settings.ENVIRONMENT,
        "model_identifier": settings.MODEL_IDENTIFIER,
    }

@router.get("/ready", status_code=status.HTTP_200_OK)
def readiness_check():
    yunet_exists = os.path.exists(settings.YUNET_MODEL_PATH)
    sface_exists = os.path.exists(settings.SFACE_MODEL_PATH)
    
    is_ready = yunet_exists and sface_exists
    return {
        "ready": is_ready,
        "models": {
            "detector_loaded": yunet_exists,
            "recognizer_loaded": sface_exists,
            "detector_path": settings.YUNET_MODEL_PATH,
            "recognizer_path": settings.SFACE_MODEL_PATH,
        }
    }
