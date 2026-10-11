import os
import threading
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
from app.config import settings
from app.services.image_validation import compute_sharpness_score

class FaceDetectorService:
    _instance = None

    def __init__(self):
        self.model_path = settings.YUNET_MODEL_PATH
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"YuNet model not found at {self.model_path}")
        
        self._lock = threading.Lock()
        # Initial dummy input size, updated dynamically per image
        self.detector = cv2.FaceDetectorYN.create(
            model=self.model_path,
            config="",
            input_size=(320, 320),
            score_threshold=settings.DETECTION_SCORE_THRESHOLD,
            nms_threshold=settings.DETECTION_NMS_THRESHOLD,
            top_k=5000
        )

    @classmethod
    def get_instance(cls) -> "FaceDetectorService":
        if cls._instance is None:
            cls._instance = FaceDetectorService()
        return cls._instance

    def detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detects faces in an image using YuNet.
        Returns a list of detected face dictionaries containing:
        - raw_face: 15-dim numpy array [x, y, w, h, x1, y1, ..., x5, y5, score]
        - bbox: dict(x, y, width, height)
        - score: float
        - quality_score: float
        - crop: cropped BGR face matrix
        """
        h, w = image.shape[:2]
        with self._lock:
            self.detector.setInputSize((w, h))
            _, faces = self.detector.detect(image)

        if faces is None or len(faces) == 0:
            return []

        results = []
        for i, face in enumerate(faces):
            x, y, fw, fh = int(face[0]), int(face[1]), int(face[2]), int(face[3])
            score = float(face[14])

            # Clamp bounding boxes to image dimensions
            x1 = max(0, x)
            y1 = max(0, y)
            x2 = min(w, x + fw)
            y2 = min(h, y + fh)

            box_w = max(0, x2 - x1)
            box_h = max(0, y2 - y1)

            # Skip detections that are too small
            if box_w < settings.MIN_FACE_SIZE_PX or box_h < settings.MIN_FACE_SIZE_PX:
                continue

            face_crop = image[y1:y2, x1:x2]
            quality = compute_sharpness_score(face_crop)

            results.append({
                "face_id": f"face_{i+1}",
                "raw_face": face,
                "bbox": {
                    "x": x1,
                    "y": y1,
                    "width": box_w,
                    "height": box_h
                },
                "score": round(score, 4),
                "quality_score": quality,
                "crop": face_crop,
                "landmarks": [
                    [float(face[4]), float(face[5])],    # right eye
                    [float(face[6]), float(face[7])],    # left eye
                    [float(face[8]), float(face[9])],    # nose tip
                    [float(face[10]), float(face[11])],  # right mouth
                    [float(face[12]), float(face[13])]   # left mouth
                ]
            })

        return results
