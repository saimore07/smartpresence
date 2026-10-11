from typing import List, Dict, Any, Tuple, Set
from app.config import settings
from app.schemas.requests import EnrolledStudentCandidate
from app.schemas.responses import (
    MatchOutcome,
    DetectedFaceItem,
    BoundingBox,
    CandidateMatch,
    GroupRecognitionResponse
)
from app.services.embedding_service import EmbeddingService

class MatchingService:
    def __init__(self):
        self.embedding_service = EmbeddingService.get_instance()

    def match_detections(
        self,
        detections: List[Dict[str, Any]],
        candidates: List[EnrolledStudentCandidate],
        total_photos: int,
        elapsed_time_ms: float
    ) -> GroupRecognitionResponse:
        """
        Matches a list of detected faces against authorized class candidates.
        Performs threshold classification, multi-photo deduplication,
        conflict resolution, and roster aggregation.
        """
        all_detections_results: List[DetectedFaceItem] = []
        assigned_students_by_photo: Dict[int, Set[str]] = {}
        student_matches: Dict[str, List[Tuple[float, int, str]]] = {} # student_id -> [(score, photo_idx, face_id)]

        for det in detections:
            photo_idx = det["photo_index"]
            face_id = det["face_id"]
            bbox = BoundingBox(**det["bbox"])
            det_score = det["score"]
            quality = det["quality_score"]
            face_embedding = det.get("embedding")

            if photo_idx not in assigned_students_by_photo:
                assigned_students_by_photo[photo_idx] = set()

            # Handle low quality or missing embedding
            if not face_embedding or det_score < settings.DETECTION_SCORE_THRESHOLD:
                all_detections_results.append(DetectedFaceItem(
                    face_id=face_id,
                    photo_index=photo_idx,
                    bbox=bbox,
                    detection_confidence=det_score,
                    quality_score=quality,
                    outcome=MatchOutcome.LOW_QUALITY,
                    notes="Face detection score or resolution is below reliable threshold."
                ))
                continue

            # Find best candidate among enrolled students
            best_candidate = None
            best_similarity = -1.0

            for cand in candidates:
                sim = self.embedding_service.cosine_similarity(face_embedding, cand.embedding)
                if sim > best_similarity:
                    best_similarity = sim
                    best_candidate = cand

            # Classify based on calibrated thresholds
            if best_similarity >= settings.ACCEPTANCE_THRESHOLD and best_candidate:
                outcome = MatchOutcome.MATCHED
                cand_id = best_candidate.student_id
                cand_name = best_candidate.name
                cand_roll = best_candidate.roll_number
            elif best_similarity >= settings.REJECTION_THRESHOLD and best_candidate:
                outcome = MatchOutcome.UNCERTAIN
                cand_id = best_candidate.student_id
                cand_name = best_candidate.name
                cand_roll = best_candidate.roll_number
            else:
                outcome = MatchOutcome.UNKNOWN
                cand_id = None
                cand_name = None
                cand_roll = None

            item = DetectedFaceItem(
                face_id=face_id,
                photo_index=photo_idx,
                bbox=bbox,
                detection_confidence=det_score,
                quality_score=quality,
                outcome=outcome,
                candidate_student_id=cand_id,
                candidate_name=cand_name,
                candidate_roll_number=cand_roll,
                similarity_score=round(float(best_similarity), 4) if best_similarity > 0 else 0.0,
                is_duplicate=False,
                conflict=False
            )
            all_detections_results.append(item)

            if outcome == MatchOutcome.MATCHED and cand_id:
                if cand_id not in student_matches:
                    student_matches[cand_id] = []
                student_matches[cand_id].append((best_similarity, photo_idx, face_id))

        # Conflict and Multi-Photo Deduplication Pass
        # Check if same student appears multiple times
        conflicts = []
        proposed_present_details: List[CandidateMatch] = []
        proposed_present_ids: Set[str] = set()

        for cand_id, matches in student_matches.items():
            # Find the best match across all photos
            matches.sort(key=lambda x: x[0], reverse=True)
            best_score, best_photo_idx, best_face_id = matches[0]

            # Check for conflict: multiple detections in the SAME photo matching the same student
            photo_occurrences = [m[1] for m in matches]
            has_intra_photo_conflict = len(photo_occurrences) != len(set(photo_occurrences))

            if has_intra_photo_conflict:
                conflicts.append({
                    "student_id": cand_id,
                    "reason": "Duplicate match detected within the same photograph",
                    "occurrences": len(matches)
                })

            # Mark duplicates and conflicts among the detected items
            is_first = True
            for score, p_idx, f_id in matches:
                # Find corresponding item
                for item in all_detections_results:
                    if item.photo_index == p_idx and item.face_id == f_id:
                        if is_first:
                            is_first = False
                            item.conflict = has_intra_photo_conflict
                            if has_intra_photo_conflict:
                                item.notes = f"Conflict: Another face in Row {p_idx+1} also matched candidate {cand_id}."
                        else:
                            if p_idx == best_photo_idx:
                                # Intra-photo conflict: distinct person in same row matched same identity
                                item.conflict = True
                                item.outcome = MatchOutcome.UNCERTAIN
                                item.notes = f"Intra-row conflict: multiple faces in Row {p_idx+1} matched candidate {cand_id}. Flagged for faculty verification."
                            else:
                                # Genuine cross-photo multi-row appearance: consolidate cleanly
                                item.is_duplicate = True
                                item.notes = f"Cross-photo duplicate appearance of student {cand_id} in Row {p_idx+1}; consolidated to best match in Row {best_photo_idx+1}."

            # Retrieve candidate details
            matched_candidate = next((c for c in candidates if c.student_id == cand_id), None)
            if matched_candidate:
                proposed_present_ids.add(cand_id)
                proposed_present_details.append(CandidateMatch(
                    student_id=cand_id,
                    name=matched_candidate.name,
                    roll_number=matched_candidate.roll_number,
                    confidence=round(best_score, 4),
                    detection_photo_index=best_photo_idx,
                    face_id=best_face_id
                ))

        # Sort proposed present by roll number
        proposed_present_details.sort(key=lambda x: x.roll_number)

        # Proposed absent students (enrolled candidates not matched)
        all_candidate_ids = {c.student_id for c in candidates}
        proposed_absent_ids = sorted(list(all_candidate_ids - proposed_present_ids))

        # Categorized lists for review
        matched_items = [d for d in all_detections_results if d.outcome == MatchOutcome.MATCHED and not d.is_duplicate]
        uncertain_items = [d for d in all_detections_results if d.outcome == MatchOutcome.UNCERTAIN]
        unknown_items = [d for d in all_detections_results if d.outcome == MatchOutcome.UNKNOWN]
        low_quality_items = [d for d in all_detections_results if d.outcome == MatchOutcome.LOW_QUALITY]

        return GroupRecognitionResponse(
            success=True,
            total_photos_processed=total_photos,
            total_faces_detected=len(detections),
            matched_count=len(matched_items),
            uncertain_count=len(uncertain_items),
            unknown_count=len(unknown_items),
            low_quality_count=len(low_quality_items),
            proposed_present_student_ids=sorted(list(proposed_present_ids)),
            proposed_absent_student_ids=proposed_absent_ids,
            proposed_present_details=proposed_present_details,
            uncertain_details=uncertain_items,
            unknown_details=unknown_items,
            face_detections=all_detections_results,
            conflicts=conflicts,
            processing_time_ms=round(elapsed_time_ms, 2)
        )
