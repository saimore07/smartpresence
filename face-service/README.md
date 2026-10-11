# SmartPresence — Face Recognition Engine Microservice

This microservice provides high-performance, legally compliant face detection, facial landmark alignment, embedding extraction, and multi-photo classroom attendance matching for the **SmartPresence** attendance ecosystem.

---

## 1. Architectural & Legal Model Selection

### Licensing Analysis & Compliance
Many popular face recognition models distributed in research repositories (such as the standard weights bundled in InsightFace) are licensed under **Non-Commercial Research licenses (e.g., CC BY-NC 4.0)**, making them legally unusable for commercial institutions or production academic deployments without costly proprietary licenses.

To guarantee **100% legal compliance and permissive open-source usage**, this engine uses:
1. **Face Detector**: **OpenCV YuNet (`face_detection_yunet`)**
   - **License**: Apache 2.0 / MIT (OpenCV Zoo).
   - Ultra-fast 5-landmark face detector capable of detecting multiple small, rotated, occluded, or varied-lighting faces.
2. **Face Feature Recognizer**: **SFace (`face_recognition_sface`)**
   - **License**: Apache 2.0 / BSD / MIT (OpenCV Zoo).
   - Generates 128-dimensional L2-normalized deep feature vectors.
   - Executes in **under 25–40ms per face on standard CPU** without requiring multi-gigabyte PyTorch/CUDA runtime bloat.

---

## 2. Threshold Calibration

Cosine similarity ranges between feature vectors:
- **`>= 0.52` (`MATCHED`)**: Strong candidate similarity. The student is proposed as **Present**.
- **`0.36 - 0.52` (`UNCERTAIN`)**: Plausible candidate match but insufficient certainty. Flagged for faculty verification.
- **`< 0.36` (`UNKNOWN`)**: No acceptable identity match found. Flagged as unknown person.
- **`LOW_QUALITY`**: Detection confidence below 0.65 or face dimensions below 24×24px.

---

## 3. API Endpoints

All internal endpoints require the `X-Internal-Secret` header matching `INTERNAL_API_SECRET`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status. |
| `GET` | `/ready` | Model readiness and loaded state. |
| `POST` | `/detect-faces` | Accepts a single image and returns bounding boxes, detection scores, and landmarks. |
| `POST` | `/enroll` | Accepts a student portrait, verifies that exactly 1 face is present, and returns the 128-d embedding. |
| `POST` | `/recognize-group` | Accepts 1 to 8 classroom photographs and candidate templates, detects all faces, matches them, and deduplicates across row photos. |

---

## 4. Setup and Startup (Windows PowerShell)

```powershell
# Navigate to the service folder
cd c:\Users\mores\Desktop\SmartPresence\face-service

# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
python -m pip install -r requirements.txt

# Run automated tests
python -m pytest tests

# Start the service
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
