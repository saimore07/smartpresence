import json
import time
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from pydantic import TypeAdapter

from app.config import settings
from app.schemas.requests import EnrolledStudentCandidate
from app.schemas.responses import (
    EnrollResponse,
    GroupRecognitionResponse,
    MatchOutcome
)
from app.services.image_validation import validate_image_file_bytes
from app.services.face_detector import FaceDetectorService
from app.services.embedding_service import EmbeddingService
from app.services.matching_service import MatchingService
from app.security.internal_auth import verify_internal_auth

router = APIRouter(tags=["Facial Recognition & Enrollment"])

candidate_adapter = TypeAdapter(List[EnrolledStudentCandidate])

@router.post(
    "/enroll",
    response_model=EnrollResponse,
    dependencies=[Depends(verify_internal_auth)]
)
async def enroll_student_face(
    student_id: str = Form(..., description="Stable system student identifier"),
    file: UploadFile = File(..., description="Front-facing portrait image for enrollment")
):
    """
    Validates a student reference portrait and extracts a normalized face embedding.
    Strictly verifies that exactly one clear, high-quality face is present.
    """
    contents = await file.read()
    image = validate_image_file_bytes(contents, file.filename or "portrait.jpg")

    detector = FaceDetectorService.get_instance()
    detections = detector.detect_faces(image)

    if len(detections) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the enrollment image. Please provide a clear, well-lit front-facing portrait."
        )

    if len(detections) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Multiple faces ({len(detections)}) detected. Student enrollment requires an image with exactly one individual."
        )

    face = detections[0]
    if face["score"] < 0.70:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Face detection confidence is too low. Please provide a sharper, front-facing portrait."
        )

    embedding_service = EmbeddingService.get_instance()
    embedding = embedding_service.extract_embedding(image, face["raw_face"])

    return EnrollResponse(
        success=True,
        student_id=student_id,
        embedding=embedding,
        model_identifier=settings.MODEL_IDENTIFIER,
        detection_confidence=face["score"],
        quality_score=face["quality_score"],
        message="Student face biometric template generated successfully."
    )

@router.post(
    "/recognize-group",
    response_model=GroupRecognitionResponse,
    dependencies=[Depends(verify_internal_auth)]
)
async def recognize_group(
    candidates_json: str = Form(..., description="JSON array of enrolled candidate templates"),
    files: List[UploadFile] = File(..., description="Classroom row photographs")
):
    """
    Processes multiple classroom row photographs for an attendance session.
    Detects faces, generates embeddings, matches against authorized students,
    deduplicates identical students appearing across multiple rows, and generates
    structured review proposals.
    """
    start_time = time.time()

    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one classroom photograph must be provided."
        )

    if len(files) > settings.MAX_PHOTOS_PER_SESSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many images. Maximum allowed per session is {settings.MAX_PHOTOS_PER_SESSION} photos."
        )

    # Parse authorized student candidates
    try:
        candidates_raw = json.loads(candidates_json)
        candidates = candidate_adapter.validate_python(candidates_raw)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid candidates format: {str(e)}"
        )

    detector = FaceDetectorService.get_instance()
    embedding_service = EmbeddingService.get_instance()
    matching_service = MatchingService()

    all_detections = []

    # Process each classroom photograph
    for photo_idx, upload_file in enumerate(files):
        contents = await upload_file.read()
        image = validate_image_file_bytes(contents, upload_file.filename or f"row_{photo_idx+1}.jpg")

        faces = detector.detect_faces(image)

        for f_idx, face in enumerate(faces):
            # Extract embedding for this face
            try:
                emb = embedding_service.extract_embedding(image, face["raw_face"])
            except Exception:
                emb = None

            all_detections.append({
                "photo_index": photo_idx,
                "face_id": f"photo_{photo_idx+1}_face_{f_idx+1}",
                "bbox": face["bbox"],
                "score": face["score"],
                "quality_score": face["quality_score"],
                "embedding": emb
            })

    elapsed_ms = (time.time() - start_time) * 1000.0

    response = matching_service.match_detections(
        detections=all_detections,
        candidates=candidates,
        total_photos=len(files),
        elapsed_time_ms=elapsed_ms
    )

    return response
