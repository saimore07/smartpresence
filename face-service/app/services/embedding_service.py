import os
import cv2
import numpy as np
from typing import List, Optional
from app.config import settings

class EmbeddingService:
    _instance = None

    def __init__(self):
        self.model_path = settings.SFACE_MODEL_PATH
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"SFace model not found at {self.model_path}")
        self.recognizer = cv2.FaceRecognizerSF.create(
            model=self.model_path,
            config=""
        )

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = EmbeddingService()
        return cls._instance

    def extract_embedding(self, image: np.ndarray, raw_face: np.ndarray) -> List[float]:
        """
        Aligns the face using the 5 detected landmarks and extracts a 128-dimensional
        L2-normalized feature embedding using SFace.
        """
        # alignCrop transforms and warps the face to standard 112x112 canonical pose
        aligned_face = self.recognizer.alignCrop(image, raw_face)
        feature = self.recognizer.feature(aligned_face)
        
        # Ensure L2 normalization
        feat_arr = np.array(feature, dtype=np.float32).flatten()
        norm = np.linalg.norm(feat_arr)
        if norm > 1e-6:
            feat_arr = feat_arr / norm
        else:
            feat_arr = np.zeros_like(feat_arr)

        return feat_arr.tolist()

    @staticmethod
    def cosine_similarity(embedding_a: List[float], embedding_b: List[float]) -> float:
        """
        Computes cosine similarity between two normalized embedding vectors.
        Output range is -1.0 to 1.0 (typically 0.0 to 1.0 for valid faces).
        """
        if not embedding_a or not embedding_b or len(embedding_a) != len(embedding_b):
            return 0.0
        
        vec_a = np.asarray(embedding_a, dtype=np.float32)
        vec_b = np.asarray(embedding_b, dtype=np.float32)

        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)

        if norm_a < 1e-6 or norm_b < 1e-6:
            return 0.0

        similarity = np.dot(vec_a, vec_b) / (norm_a * norm_b)
        return float(np.clip(similarity, -1.0, 1.0))
