import time
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from app.schemas.responses import DetectFacesResponse, DetectionOnlyItem, BoundingBox
from app.services.image_validation import validate_image_file_bytes
from app.services.face_detector import FaceDetectorService
from app.security.internal_auth import verify_internal_auth

router = APIRouter(tags=["Face Detection"])

@router.post(
    "/detect-faces",
    response_model=DetectFacesResponse,
    dependencies=[Depends(verify_internal_auth)]
)
async def detect_faces_endpoint(file: UploadFile = File(...)):
    """
    Accepts a single image and returns detected face bounding boxes,
    detection confidence scores, and facial landmark coordinates.
    Protected internal endpoint.
    """
    start_time = time.time()
    contents = await file.read()
    image = validate_image_file_bytes(contents, file.filename or "photo.jpg")

    detector = FaceDetectorService.get_instance()
    detections = detector.detect_faces(image)

    h, w = image.shape[:2]
    face_items = [
        DetectionOnlyItem(
            face_id=d["face_id"],
            bbox=BoundingBox(**d["bbox"]),
            score=d["score"],
            quality_score=d["quality_score"],
            landmarks=d["landmarks"]
        )
        for d in detections
    ]

    elapsed = (time.time() - start_time) * 1000.0

    return DetectFacesResponse(
        success=True,
        face_count=len(face_items),
        image_width=w,
        image_height=h,
        faces=face_items,
        processing_time_ms=round(elapsed, 2)
    )
