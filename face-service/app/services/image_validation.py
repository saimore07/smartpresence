import cv2
import numpy as np
from fastapi import HTTPException, status
from app.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_PREFIXES = ("image/jpeg", "image/png", "image/webp")

def validate_image_file_bytes(data: bytes, filename: str = "upload.jpg") -> np.ndarray:
    """
    Validate raw uploaded image bytes and decode into an OpenCV BGR image matrix.
    Raises HTTPException on validation errors.
    """
    if not data or len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded image is empty."
        )

    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds maximum limit of {settings.MAX_IMAGE_SIZE_MB}MB."
        )

    # Magic byte checks
    # JPEG starts with FF D8 FF
    # PNG starts with 89 50 4E 47 0D 0A 1A 0A
    # WebP starts with RIFF .... WEBP
    is_valid_header = (
        data.startswith(b"\xff\xd8\xff") or
        data.startswith(b"\x89PNG\r\n\x1a\n") or
        (len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )
    if not is_valid_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or corrupt image format. Allowed formats: JPEG, PNG, WebP."
        )

    # Decode bytes into OpenCV image
    np_arr = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image is None or image.size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode image. The file may be corrupted."
        )

    h, w = image.shape[:2]
    if h < 50 or w < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image dimensions ({w}x{h}) are too small for facial analysis. Minimum required is 50x50 pixels."
        )

    return image

def compute_sharpness_score(face_crop: np.ndarray) -> float:
    """
    Estimates face sharpness via Laplacian variance.
    Returns normalized quality score between 0.0 and 1.0.
    """
    if face_crop is None or face_crop.size == 0:
        return 0.0
    try:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        # Typical variance ranges from 10 (blurry) to 300+ (crisp)
        # Normalize into a 0.0 - 1.0 score
        score = min(1.0, max(0.0, variance / 250.0))
        return round(float(score), 3)
    except Exception:
        return 0.5
