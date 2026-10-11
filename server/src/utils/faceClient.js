const fs = require('fs');
const path = require('path');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:8000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'smartpresence_internal_secret_2026';

class FaceServiceClient {
  constructor() {
    this.baseUrl = FACE_SERVICE_URL.replace(/\/$/, '');
    this.secret = INTERNAL_API_SECRET;
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return { healthy: false, status: response.status };
      const data = await response.json();
      return { healthy: true, data };
    } catch (err) {
      return { healthy: false, error: err.message };
    }
  }

  async enrollStudentFace(studentId, imageFilePath) {
    if (!fs.existsSync(imageFilePath)) {
      throw new Error(`Image file not found at ${imageFilePath}`);
    }

    const fileBuffer = fs.readFileSync(imageFilePath);
    const filename = path.basename(imageFilePath);
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('file', new Blob([fileBuffer], { type: mime }), filename);

    try {
      const response = await fetch(`${this.baseUrl}/enroll`, {
        method: 'POST',
        headers: {
          'X-Internal-Secret': this.secret,
        },
        body: formData,
        signal: AbortSignal.timeout(15000), // 15 second timeout for enrollment
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = data && (data.detail || data.message);
        throw new Error(errorDetail || `Face service enrollment returned HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      if (err.name === 'TimeoutError') {
        throw new Error('AI Face Recognition service timed out during portrait analysis.');
      }
      if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        throw new Error('AI Face Recognition service is currently unreachable. Please ensure the Python service is running.');
      }
      throw err;
    }
  }

  async recognizeClassroomGroup(imageFilePaths, candidates) {
    if (!Array.isArray(imageFilePaths) || imageFilePaths.length === 0) {
      throw new Error('No classroom photographs provided for recognition.');
    }

    const formData = new FormData();
    formData.append('candidates_json', JSON.stringify(candidates || []));

    for (const imgPath of imageFilePaths) {
      if (!fs.existsSync(imgPath)) {
        throw new Error(`Classroom image not found at ${imgPath}`);
      }
      const fileBuffer = fs.readFileSync(imgPath);
      const filename = path.basename(imgPath);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      formData.append('files', new Blob([fileBuffer], { type: mime }), filename);
    }

    try {
      const response = await fetch(`${this.baseUrl}/recognize-group`, {
        method: 'POST',
        headers: {
          'X-Internal-Secret': this.secret,
        },
        body: formData,
        signal: AbortSignal.timeout(45000), // 45 second timeout for multi-photo analysis
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = data && (data.detail || data.message);
        throw new Error(errorDetail || `Face recognition service returned HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      if (err.name === 'TimeoutError') {
        throw new Error('AI Face Recognition service timed out during group image recognition.');
      }
      if (err.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
        throw new Error('AI Face Recognition service is currently unreachable. Please ensure the Python service is running.');
      }
      throw err;
    }
  }
}

module.exports = new FaceServiceClient();
