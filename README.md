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

---

## 4. Role-Based Architecture & Centralized Enrollment

SmartPresence implements a 3-tier Role-Based Access Control (RBAC) architecture:

```
                            ROLE ARCHITECTURE
                                    |
     +------------------------------+------------------------------+
     |                              |                              |
   ADMIN                         FACULTY                        STUDENT
- Centralized Enrollment      - Assigned Subjects Roster     - Personal Attendance Dashboard
- Faculty Account Management  - AI Multi-Row Attendance     - Subject-wise Percentages
- Subject Allocations         - Subject-Scoped History       - Historical Session Logs
- System Statistics           - CSV Session Exports          - Mandatory Password Change
- Biometric Revocation        (Forbidden from Re-enrolling)   (Read-Only Personal Data)
```

### Initial Administrator Bootstrap
The system provisions an initial Admin account via environment variables on server boot or migration:
- **Email:** `admin@smartpresence.com` (configured via `ADMIN_EMAIL`)
- **Initial Password:** `admin@123` (configured via `ADMIN_INITIAL_PASSWORD`)
- **Idempotency:** Password is hashed with `bcryptjs` (salt rounds: 10). If the administrator already exists in MongoDB, the password is never overwritten on server restart.

### Centralized Student Enrollment
- Canonical student records exist once in MongoDB (`Student` collection) with separate `firstName` and `lastName`, compulsory unique `email`, `studentId`, `rollNumber`, and `className`.
- Facial biometric templates (`FaceTemplate` collection) are bound to the canonical `studentId`.
- **Elimination of Duplication:** Faculty members never enroll students. All authorized faculty members teaching a class access the centralized roster without duplicate image capture or template creation.

### Faculty-Specific Subject Scoping
- The backend determines the authenticated faculty identity directly from the verified JWT (`req.user._id`).
- When querying attendance history, session details, statistics, or CSV exports, requests are strictly filtered to the faculty member's authorized subjects.
- Any attempt to query or mark attendance for an unassigned subject is rejected with `403 Forbidden`.

---

## 5. Quick Startup Instructions (Windows PowerShell)

### Database Migration & Idempotent Bootstrap
Before starting the servers for the first time, run the non-destructive migration script:
```powershell
cd c:\Users\mores\Desktop\SmartPresence\server
npm run migrate
```
*What this does safely:*
1. Backfills assigned subjects for existing faculty from historical records.
2. Creates canonical subject records with faculty assignments.
3. Performs non-destructive reconciliation of duplicate student profiles (repointing attendance references and transferring biometric templates).
4. Drops obsolete single-field indexes and ensures compound unique indexes.
5. Idempotently provisions the bootstrap Administrator account (`admin@smartpresence.com`).

---

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

#### Terminal 1: Local MongoDB
```powershell
# Verify MongoDB service status
Get-Service -Name *mongo*

# If not running, start MongoDB
Start-Service MongoDB
```

#### Terminal 2: Python AI Microservice (`face-service`)
```powershell
cd c:\Users\mores\Desktop\SmartPresence\face-service

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run unit tests (8 tests)
python -m pytest tests/ -v

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Terminal 3: Node.js Express Backend (`server`)
```powershell
cd c:\Users\mores\Desktop\SmartPresence\server

# Run backend test suite (e2e tests + feature enhancement tests)
npm test

# Start Express server on port 5000
npm run dev
```

#### Terminal 4: React Native / Expo (`mobile`)
```powershell
cd c:\Users\mores\Desktop\SmartPresence\mobile

# Start Expo development server
npx expo start
```

---

## 6. Development Networking & IP Configuration

- **Backend to MongoDB**: `mongodb://127.0.0.1:27017/smartpresence`
- **Backend to Python AI Service**: `http://127.0.0.1:8000`
- **Android Physical Device to Backend**:
  - The Android phone and laptop must be connected to the same Wi-Fi network.
  - The laptop's LAN IP is automatically detected by `Constants.expoConfig?.hostUri` in `mobile/constants/config.js` or configured via `PC_LAN_IP`.
  - Windows Firewall: Ensure port 5000 (Express) and 8081 (Metro) are allowed on Private networks.
- **Android Studio Emulator**: Automatically maps `localhost` to `10.0.2.2:5000`.

---

## 7. API Reference

### Health Endpoints
- `GET /api/health` -> Express health
- `GET http://127.0.0.1:8000/health` -> AI service health
- `GET http://127.0.0.1:8000/ready` -> AI model readiness check

### Authentication Endpoints
- `POST /api/auth/admin/login` -> Admin login (JWT issued with role `admin`)
- `POST /api/auth/faculty/login` -> Faculty login (JWT issued with role `faculty`)
- `POST /api/auth/faculty/signup` -> Faculty registration (when enabled)
- `POST /api/auth/student/login` -> Student login (JWT issued with role `student`, checks `mustChangePassword`)
- `POST /api/auth/student/change-password` -> Mandatory student password change

### Admin Endpoints (Requires `admin` role)
- `GET /api/admin/stats` -> System counts (students, faculty, subjects, sessions)
- `GET /api/admin/faculty` -> List all faculty accounts with assigned subjects
- `POST /api/admin/faculty` -> Register faculty account with assigned subjects
- `PUT /api/admin/faculty/:id` -> Update faculty details and subject assignments
- `PATCH /api/admin/faculty/:id/status` -> Toggle faculty active/inactive status
- `GET /api/admin/subjects` -> List all subjects and assigned faculty
- `POST /api/admin/subjects` -> Create subject and allocate to faculty members
- `DELETE /api/admin/subjects/:id` -> Delete subject
- `PATCH /api/admin/students/:id/status` -> Toggle student active/inactive status

### Student & Biometric Endpoints
- `POST /api/students` (Admin only, multipart): Centralized student enrollment with portrait photo and AI template creation.
- `GET /api/students`: List/search students (Admin & Faculty read access).
- `GET /api/students/:id`: Student details (Admin & Faculty).
- `PUT /api/students/:id`: Update student identity fields without re-enrollment (Admin only).
- `DELETE /api/students/:id`: Delete student record (Admin only).
- `DELETE /api/students/:id/face-template`: Revoke facial template (Admin only).
- `GET /api/students/attendance/summary`: Student personal attendance summary (Student only).
- `GET /api/students/attendance/history`: Student personal session logs with pagination (Student only).

### Attendance Endpoints
- `GET /api/attendance/subjects`: Returns authorized subjects for authenticated faculty.
- `POST /api/attendance/recognize-session`: Multi-row facial recognition (Faculty only, authorized subjects only).
- `POST /api/attendance`: Finalize attendance session (Faculty only, enforces `facultyId = req.user._id`).
- `GET /api/attendance`: Session history strictly scoped to faculty assigned subjects.
- `GET /api/attendance/:id`: Session detail (strictly verified against faculty subjects).
- `GET /api/attendance/stats`: Attendance statistics scoped to faculty subjects.
- `GET /api/attendance/:id/export-csv`: CSV export for authorized sessions.

---

## 8. Verification & Test Plan

1. **Backend Automated Tests**:
   ```bash
   cd server
   npm test
   ```
   *Executes both `test/e2e.test.js` and `test/features_enhancement.test.js` covering Admin bootstrap, student centralized enrollment, duplicate email rejection, role authorization barriers, 12-hour session time validation, zero-session handling, and faculty-scoped history.*

2. **Face Service AI Tests**:
   ```bash
   cd face-service
   .\venv\Scripts\python.exe -m pytest tests/ -v
   ```
   *Validates YuNet detector, SFace feature extractor, cosine similarity math, and synthetic match outcomes.*

3. **Admin Workflow in Mobile App**:
   - Open mobile app -> Select **Admin** tab.
   - Enter `admin@smartpresence.com` / `admin@123`.
   - Access **Admin Dashboard**:
     - View system stats (Students, Faculty, Subjects, Attendance Sessions).
     - Tap **Centralized Student Enrollment** -> Enter First Name, Last Name, Email, Roll Number, Class -> Capture portrait -> Submit.
     - Tap **Faculty Management** -> Add faculty, assign subjects, or toggle active status.
     - Tap **Subject Allocation** -> Add subject code and name, check assigned faculty.
     - Tap **Student Directory** -> Search students, view details, edit details without re-enrollment.

4. **Faculty Workflow in Mobile App**:
   - Log out -> Select **Faculty** tab -> Log in as faculty.
   - Access **Faculty Dashboard**:
     - Notice assigned subject chips at the top.
     - Observe absence of student enrollment button (preventing duplicate enrollments).
     - Tap **Take Attendance** -> Select one of the assigned subjects, date, and 12-hour AM/PM time slot.
     - Capture row photos -> Run AI face recognition -> Confirm attendance.
     - Tap **Attendance History** -> Verify history lists only sessions for assigned subjects.
