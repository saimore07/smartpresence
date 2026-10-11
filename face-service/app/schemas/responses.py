from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field

class MatchOutcome(str, Enum):
    MATCHED = "MATCHED"
    UNCERTAIN = "UNCERTAIN"
    UNKNOWN = "UNKNOWN"
    LOW_QUALITY = "LOW_QUALITY"

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class DetectedFaceItem(BaseModel):
    face_id: str
    photo_index: int
    bbox: BoundingBox
    detection_confidence: float
    quality_score: float
    outcome: MatchOutcome
    candidate_student_id: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_roll_number: Optional[str] = None
    similarity_score: float = 0.0
    is_duplicate: bool = False
    conflict: bool = False
    notes: Optional[str] = None

class CandidateMatch(BaseModel):
    student_id: str
    name: str
    roll_number: str
    confidence: float
    detection_photo_index: int
    face_id: str

class GroupRecognitionResponse(BaseModel):
    success: bool
    total_photos_processed: int
    total_faces_detected: int
    matched_count: int
    uncertain_count: int
    unknown_count: int
    low_quality_count: int
    proposed_present_student_ids: List[str]
    proposed_absent_student_ids: List[str]
    proposed_present_details: List[CandidateMatch]
    uncertain_details: List[DetectedFaceItem]
    unknown_details: List[DetectedFaceItem]
    face_detections: List[DetectedFaceItem]
    conflicts: List[Dict[str, Any]]
    processing_time_ms: float

class EnrollResponse(BaseModel):
    success: bool
    student_id: str
    embedding: Optional[List[float]] = None
    model_identifier: str
    detection_confidence: float
    quality_score: float
    message: str

class DetectionOnlyItem(BaseModel):
    face_id: str
    bbox: BoundingBox
    score: float
    quality_score: float
    landmarks: List[List[float]]

class DetectFacesResponse(BaseModel):
    success: bool
    face_count: int
    image_width: int
    image_height: int
    faces: List[DetectionOnlyItem]
    processing_time_ms: float
