# SmartPresence — AI-Powered Facial Attendance System

SmartPresence is a full-stack automated college attendance management ecosystem built with **React Native (Expo)**, **Node.js (Express)**, a dedicated **Python 3.12 (FastAPI)** AI face-recognition microservice, and local **MongoDB**.

Designed for classroom lectures of ~80 students divided across rows (10–16 students per row), faculty members can capture 4–5 photographs (one row at a time) and have the system detect, align, embed, and match student identities against authorized enrolled class members. Faculty review the proposed attendance list, resolve any uncertain matches, and explicitly confirm the final records.

---

## 1. System Architecture

```
                       SMARTPRESENCE
                             |
             +---------------+---------------+
             |                               |
       Android Mobile                   Node.js Backend
    (React Native + Expo)              (Express REST API)
             |                               |
             | Authenticated                 | Authenticated Internal
             | Image Upload                  | Request (X-Internal-Secret)
             v                               v
    +-----------------+              +-----------------------+
    | Faculty Camera  |              | Python / FastAPI      |
    | Multi-Row Flow  |              | AI Face Recognition   |
    +-----------------+              | (YuNet + SFace ONNX)  |
             ^                       +-----------------------+
             |                               |
             | Structured Attendance         | Detection, Embeddings,
             | Proposal for Review           | Similarity & Deduplication
             |                               v
    +-----------------+              +-----------------------+
    | Faculty Review  | ------------>| MongoDB               |
    | & Confirmation  |              | Collections:          |
    +-----------------+              | - Faculty             |
                                     | - Student             |
                                     | - FaceTemplate        |
                                     | - Attendance          |
                                     +-----------------------+
```

### Security & Data Isolation
- **No Direct DB Access from Mobile**: The Android application communicates exclusively with the Express backend over JWT-authenticated HTTPS/HTTP endpoints.
- **Biometric Protection**: Facial templates (128-dimensional L2-normalized float vectors) are stored in a dedicated `FaceTemplate` collection with model identifier metadata and enrollment status. Face templates are never leaked to public client responses.
- **Service Isolation**: The Python AI microservice binds strictly to `127.0.0.1:8000` and validates all requests via the `X-Internal-Secret` header.

---

## 2. Technology Stack & Legal Model Compliance

### Mobile Application
- **Framework:** React Native (0.86.3), Expo SDK 57, Expo Router 57.
- **Language:** Pure JavaScript (`.jsx`, `.js`).
- **Camera:** `expo-camera` (`CameraView`) with custom row-alignment guide overlays.
- **Optimization:** `expo-image-manipulator` for local image compression before upload.

### Backend API
- **Runtime:** Node.js (v24), Express (v5.1).
- **Database:** Local MongoDB (`mongodb://127.0.0.1:27017/smartpresence`).
- **Security:** JWT authentication, bcryptjs password hashing, Multer file upload filters.

### AI Face Recognition Service (`face-service/`)
- **Runtime:** Python 3.12, FastAPI, Uvicorn, OpenCV (`opencv-python-headless`), NumPy.
- **Face Detector:** **OpenCV YuNet (`face_detection_yunet`)**
  - **License:** Apache 2.0 / MIT (OpenCV Zoo). Fully commercial & academic compliant.
  - Detects faces with 5 facial landmarks (eyes, nose, mouth corners) even with partial occlusion, varied poses, and diverse lighting.
- **Face Feature Recognizer:** **SFace (`face_recognition_sface`)**
  - **License:** Apache 2.0 / BSD / MIT (OpenCV Zoo).
  - 128-dimensional L2-normalized cosine feature extractor. Runs in ~25–40ms per face on CPU.
- **Legal Compliance:** Eliminates the non-commercial research licensing restrictions (CC BY-NC 4.0) bundled with default DeepInsight/InsightFace weights.

---

## 3. Threshold Calibration & Matching Outcomes

Cosine similarity matching against enrolled student templates produces four distinct outcomes:

| Outcome | Cosine Similarity Score | System Action |
|---|---|---|
| **`MATCHED`** | $\ge 0.52$ | Candidate identity matched with high confidence. Proposed as **Present**. |
| **`UNCERTAIN`** | $0.36 \le \text{Score} < 0.52$ | Plausible identity candidate, but flagged with an amber badge for faculty review. |
| **`UNKNOWN`** | $< 0.36$ | No acceptable match found. Flagged as unknown person; never assigned randomly. |
| **`LOW_QUALITY`** | Detection score $< 0.65$ or $< 24\text{px}$ | Rejected or flagged for poor visibility or blur. |

### Cross-Row Multi-Photo Deduplication
When a student is visible in multiple row photographs (e.g., Row 1 and Row 2), their attendance is automatically consolidated to the highest-confidence occurrence across the session. Duplicate occurrences are marked to prevent double-counting.

---

## 4. Quick Startup Instructions (Windows PowerShell)

### Option A: One-Click Launch Script (Recommended)
You can start the entire stack (MongoDB, Python AI Engine, Node.js Backend, and Expo Bundler) with a single command from the project root:

```powershell
# In PowerShell at the root of SmartPresence:
.\start.ps1
```

To shut down all services at once when done:
```powershell
.\stop.ps1
```

---

### Option B: Manual Multi-Terminal Startup
If you prefer starting each service manually in its own terminal:

### Terminal 1: Local MongoDB
```powershell
# Verify MongoDB service status
Get-Service -Name *mongo*

# If not running, start MongoDB
Start-Service MongoDB
```

### Terminal 2: Python AI Microservice (`face-service`)
```powershell
cd c:\Users\mores\Desktop\SmartPresence\face-service

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run unit tests
python -m pytest tests

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 3: Node.js Express Backend (`server`)
```powershell
cd c:\Users\mores\Desktop\SmartPresence\server

# Run test suite (22 automated tests)
npm test

# Start Express server on port 5000
npm run dev
```

### Terminal 4: React Native / Expo (`mobile`)
```powershell
cd c:\Users\mores\Desktop\SmartPresence\mobile

# Start Expo development server
npx expo start
```

---

## 5. Development Networking & IP Configuration

- **Backend to MongoDB**: `mongodb://127.0.0.1:27017/smartpresence`
- **Backend to Python AI Service**: `http://127.0.0.1:8000`
- **Android Physical Device to Backend**:
  - The Android phone and laptop must be connected to the same Wi-Fi network.
  - The laptop's LAN IP is automatically detected by `Constants.expoConfig?.hostUri` in `mobile/constants/config.js` or configured via `PC_LAN_IP`.
  - Windows Firewall: Ensure port 5000 (Express) and 8081 (Metro) are allowed on Private networks.
- **Android Studio Emulator**: Automatically maps `localhost` to `10.0.2.2:5000`.

---

## 6. API Reference

### Health Endpoints
- `GET http://127.0.0.1:5000/api/health` -> Express health
- `GET http://127.0.0.1:8000/health` -> AI service health
- `GET http://127.0.0.1:8000/ready` -> AI model readiness check

### Student & Biometric Endpoints (Express)
- `POST /api/students` (multipart with portrait `faceImage`): Enrolls student and creates biometric `FaceTemplate`.
- `GET /api/students/:id`: Returns student details and active biometric template status.
- `DELETE /api/students/:id/face-template`: Revokes and deletes facial biometric templates.

### Attendance Endpoints (Express)
- `POST /api/attendance/recognize-session` (multipart with `classroomImages` array): Runs multi-row AI recognition and returns structured proposed present, proposed absent, uncertain matches, and unknown detections.
- `POST /api/attendance`: Finalizes confirmed attendance in MongoDB.
- `GET /api/attendance`: Attendance session history.

---

## 7. Step-by-Step Manual Test Plan

1. **Verify Services**:
   - Run `curl http://127.0.0.1:8000/health` -> should return `{"status":"healthy"}`.
   - Run `curl http://127.0.0.1:8000/ready` -> should return `{"ready":true}`.
   - Run `curl http://localhost:5000/api/health` -> should return `{"success":true}`.
2. **Faculty Login / Signup**:
   - Open mobile app -> Sign up or log in with faculty credentials.
3. **Enroll Students**:
   - Tap "Enroll Student" -> Enter name, roll number, class (e.g. `CS-A`).
   - Tap camera icon -> Capture a front portrait photo -> Submit.
   - Verify student appears in Students list with "✓ Template Enrolled".
4. **Take Multi-Row Attendance**:
   - Tap "Take Attendance" -> Select Class `CS-A`, Subject, Date.
   - Tap "Start Session & Open Camera".
   - Snap Row 1 photo -> Preview row.
   - Tap "Capture Next Row" -> Snap Row 2 photo.
   - Tap "⚡ Process 2 Row Photos with AI".
5. **Review & Confirm Roster**:
   - Inspect Attendance Review screen:
     - Enrolled matching students are marked "Present" with a green `✓ AI Match` pill.
     - Enrolled non-present students are listed as "Absent".
     - Tap any student card to manually toggle their status.
   - Tap "CONFIRM ATTENDANCE".
   - Verify attendance appears in "Attendance History" and MongoDB.
