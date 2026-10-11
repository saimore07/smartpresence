import io
import json
import pytest
import numpy as np
import cv2
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.config import settings
from app.services.face_detector import FaceDetectorService
from app.services.embedding_service import EmbeddingService

def create_synthetic_image(width=300, height=300, color=(200, 200, 200)) -> bytes:
    """Creates a simple synthetic image without faces."""
    img = np.full((height, width, 3), color, dtype=np.uint8)
    # Add some geometric shapes
    cv2.circle(img, (width // 2, height // 2), 40, (50, 50, 50), -1)
    success, encoded = cv2.imencode(".jpg", img)
    assert success
    return encoded.tobytes()

def create_corrupted_image() -> bytes:
    return b"CorruptImageDataNotAnActualJPEGFile1234567890"

@pytest.fixture
def auth_headers():
    return {"X-Internal-Secret": settings.INTERNAL_API_SECRET}

@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "service" in data

@pytest.mark.asyncio
async def test_ready_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["ready"] is True
        assert data["models"]["detector_loaded"] is True
        assert data["models"]["recognizer_loaded"] is True

@pytest.mark.asyncio
async def test_auth_rejection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # No auth header
        res = await client.post("/detect-faces")
        assert res.status_code == 403

        # Invalid auth header
        res = await client.post(
            "/detect-faces",
            headers={"X-Internal-Secret": "invalid_wrong_secret"}
        )
        assert res.status_code == 403

@pytest.mark.asyncio
async def test_corrupt_image_detection(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("test.jpg", create_corrupted_image(), "image/jpeg")}
        res = await client.post("/detect-faces", headers=auth_headers, files=files)
        assert res.status_code == 400
        assert "format" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_no_face_image_detection(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("blank.jpg", create_synthetic_image(), "image/jpeg")}
        res = await client.post("/detect-faces", headers=auth_headers, files=files)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["face_count"] == 0
        assert len(data["faces"]) == 0

@pytest.mark.asyncio
async def test_enroll_no_face_rejected(auth_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"file": ("blank.jpg", create_synthetic_image(), "image/jpeg")}
        data = {"student_id": "TEST_STUDENT_01"}
        res = await client.post("/enroll", headers=auth_headers, data=data, files=files)
        assert res.status_code == 400
        assert "no face detected" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_cosine_similarity_math():
    service = EmbeddingService.get_instance()
    # Identical vectors should have similarity 1.0
    v1 = [1.0] + [0.0] * 127
    assert pytest.approx(service.cosine_similarity(v1, v1), 0.001) == 1.0

    # Orthogonal vectors should have similarity 0.0
    v2 = [0.0, 1.0] + [0.0] * 126
    assert pytest.approx(service.cosine_similarity(v1, v2), 0.001) == 0.0

    # Opposite vectors should have similarity -1.0
    v3 = [-1.0] + [0.0] * 127
    assert pytest.approx(service.cosine_similarity(v1, v3), 0.001) == -1.0

@pytest.mark.asyncio
async def test_matching_logic_with_synthetic_embeddings():
    from app.services.matching_service import MatchingService
    from app.schemas.requests import EnrolledStudentCandidate
    from app.schemas.responses import MatchOutcome

    matcher = MatchingService()

    cand1_emb = [1.0] + [0.0] * 127
    cand2_emb = [0.0, 1.0] + [0.0] * 126

    candidates = [
        EnrolledStudentCandidate(student_id="S01", name="Alice", roll_number="101", embedding=cand1_emb),
        EnrolledStudentCandidate(student_id="S02", name="Bob", roll_number="102", embedding=cand2_emb),
    ]

    # Test 1: Exact match with candidate 1 (similarity 1.0 >= 0.52 -> MATCHED)
    detections = [
        {
            "photo_index": 0,
            "face_id": "face_1",
            "bbox": {"x": 10, "y": 10, "width": 50, "height": 50},
            "score": 0.95,
            "quality_score": 0.85,
            "embedding": cand1_emb,
        }
    ]

    res = matcher.match_detections(detections, candidates, total_photos=1, elapsed_time_ms=10.0)
    assert res.matched_count == 1
    assert "S01" in res.proposed_present_student_ids
    assert "S02" in res.proposed_absent_student_ids
    assert res.face_detections[0].outcome == MatchOutcome.MATCHED
    assert res.face_detections[0].candidate_student_id == "S01"

    # Test 2: Unknown face (orthogonal to both candidates)
    unknown_emb = [0.0, 0.0, 1.0] + [0.0] * 125
    detections_unk = [
        {
            "photo_index": 0,
            "face_id": "face_2",
            "bbox": {"x": 20, "y": 20, "width": 50, "height": 50},
            "score": 0.92,
            "quality_score": 0.80,
            "embedding": unknown_emb,
        }
    ]
    res_unk = matcher.match_detections(detections_unk, candidates, total_photos=1, elapsed_time_ms=10.0)
    assert res_unk.unknown_count == 1
    assert res_unk.face_detections[0].outcome == MatchOutcome.UNKNOWN
    assert res_unk.face_detections[0].candidate_student_id is None

    # Test 3: Deduplication across two row photographs (same student appears in Row 1 and Row 2)
    detections_multi_row = [
        {
            "photo_index": 0,
            "face_id": "row1_face_1",
            "bbox": {"x": 10, "y": 10, "width": 50, "height": 50},
            "score": 0.95,
            "quality_score": 0.85,
            "embedding": cand1_emb,
        },
        {
            "photo_index": 1,
            "face_id": "row2_face_1",
            "bbox": {"x": 30, "y": 30, "width": 50, "height": 50},
            "score": 0.90,
            "quality_score": 0.80,
            "embedding": cand1_emb,
        }
    ]
    res_multi = matcher.match_detections(detections_multi_row, candidates, total_photos=2, elapsed_time_ms=15.0)
    # Student S01 should only be counted once in proposed present!
    assert len(res_multi.proposed_present_student_ids) == 1
    assert res_multi.proposed_present_student_ids == ["S01"]
    # The second detection should be flagged as a duplicate
    dups = [f for f in res_multi.face_detections if f.is_duplicate]
    assert len(dups) == 1
