/**
 * SmartPresence End-to-End API Test Suite
 * Tests full authentication, centralized student enrollment, faculty subject scoping,
 * and attendance workflows.
 */

const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const Faculty = require('../src/models/Faculty');
const Student = require('../src/models/Student');
const Attendance = require('../src/models/Attendance');
const Admin = require('../src/models/Admin');
const Subject = require('../src/models/Subject');
const runMigrations = require('../src/migrations/migrateDatabase');

const TEST_PORT = 5088;
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/smartpresence_test';

let server;
let adminToken = '';
let authToken = '';
let facultyUser = null;
let testStudent = null;

// HTTP Helper
const makeRequest = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, body: data });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

const runTests = async () => {
  console.log('🧪 Starting SmartPresence Automated API Test Suite...\n');

  try {
    // Connect to test database
    await mongoose.connect(TEST_DB_URI);
    console.log('✅ Connected to Test Database:', TEST_DB_URI);

    // Apply database migrations and bootstrap initial admin
    await runMigrations();

    // Clean test DB
    await Faculty.deleteMany({ email: /@test\.edu$/ });
    await Student.deleteMany({ studentId: /^TEST-/ });
    await Attendance.deleteMany({ subject: { $in: ['Test Subject AI', 'Distributed Systems', 'Unassigned Subject X'] } });
    await Subject.deleteMany({ name: { $in: ['Test Subject AI', 'Distributed Systems', 'Unassigned Subject X'] } });

    // Start test server
    server = app.listen(TEST_PORT);
    console.log(`✅ Test server running on port ${TEST_PORT}\n`);

    // TEST 1: Health Check
    console.log('--- TEST 1: Health Check ---');
    const health = await makeRequest('/api/health');
    assert(health.status === 200, `Health check returned ${health.status}`);
    assert(health.body.success === true, 'Health check success was false');
    console.log('Passed: Health endpoint works.\n');

    // TEST 1b: Admin Login & Bootstrap Verification
    console.log('--- TEST 1b: Administrator Login & Credential Verification ---');
    const adminLoginRes = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@smartpresence.com',
      password: 'admin@123',
    });
    assert(adminLoginRes.status === 200, `Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    assert(adminLoginRes.body.token, 'Admin login did not return a JWT token');
    assert(adminLoginRes.body.user.role === 'admin', 'User role is not admin');
    assert(!adminLoginRes.body.user.passwordHash, 'SECURITY VIOLATION: passwordHash exposed in admin login!');
    adminToken = adminLoginRes.body.token;

    // Verify password is stored as bcrypt hash in DB
    const adminDoc = await Admin.findOne({ email: 'admin@smartpresence.com' });
    assert(adminDoc, 'Admin document not found in DB');
    assert(adminDoc.passwordHash !== 'admin@123', 'SECURITY VIOLATION: Admin password stored in plaintext!');
    assert(adminDoc.passwordHash.startsWith('$2'), 'Admin password is not a bcrypt hash');
    console.log('Passed: Admin login succeeded and password hash securely verified.\n');

    // TEST 1c: Reject Invalid Admin Credentials
    console.log('--- TEST 1c: Reject Invalid Admin Credentials ---');
    const badAdminRes = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@smartpresence.com',
      password: 'wrongpassword',
    });
    assert(badAdminRes.status === 401, `Expected 401 for wrong admin password, got ${badAdminRes.status}`);
    console.log('Passed: Invalid admin credentials correctly rejected.\n');

    // TEST 2: Faculty Signup
    console.log('--- TEST 2: Faculty Signup ---');
    const signupData = {
      name: 'Dr. Jane Smith',
      facultyId: 'FAC-TEST-001',
      email: 'jane.smith@test.edu',
      department: 'Computer Science',
      password: 'password123',
      confirmPassword: 'password123',
    };
    const signupRes = await makeRequest('/api/auth/faculty/signup', 'POST', signupData);
    assert(signupRes.status === 201, `Signup failed with status ${signupRes.status}: ${JSON.stringify(signupRes.body)}`);
    assert(signupRes.body.token, 'Signup did not return a JWT token');
    assert(signupRes.body.user, 'Signup did not return user info');
    assert(!signupRes.body.user.passwordHash, 'SECURITY VIOLATION: passwordHash was returned!');
    authToken = signupRes.body.token;
    facultyUser = signupRes.body.user;
    console.log('Passed: Faculty signup created user & returned valid token without exposing passwordHash.\n');

    // TEST 3: Duplicate Faculty Signup Prevention
    console.log('--- TEST 3: Prevent Duplicate Faculty ---');
    const dupSignupRes = await makeRequest('/api/auth/faculty/signup', 'POST', signupData);
    assert(dupSignupRes.status === 409, `Expected status 409 for duplicate signup, got ${dupSignupRes.status}`);
    console.log('Passed: Duplicate faculty signup correctly rejected.\n');

    // TEST 4: Faculty Login (Success)
    console.log('--- TEST 4: Faculty Login (Valid Credentials) ---');
    const loginRes = await makeRequest('/api/auth/login', 'POST', {
      email: 'jane.smith@test.edu',
      password: 'password123',
    });
    assert(loginRes.status === 200, `Login failed with status ${loginRes.status}`);
    assert(loginRes.body.token, 'Login did not return token');
    assert(!loginRes.body.user.passwordHash, 'SECURITY VIOLATION: passwordHash exposed on login!');
    authToken = loginRes.body.token;
    console.log('Passed: Faculty login verified and returned JWT.\n');

    // TEST 5: Faculty Login (Invalid Password)
    console.log('--- TEST 5: Faculty Login (Invalid Password) ---');
    const badPassRes = await makeRequest('/api/auth/login', 'POST', {
      email: 'jane.smith@test.edu',
      password: 'wrongpassword',
    });
    assert(badPassRes.status === 401, `Expected status 401 for bad password, got ${badPassRes.status}`);
    console.log('Passed: Wrong password rejected.\n');

    // TEST 6: Verify Auth Session (GET /api/auth/me)
    console.log('--- TEST 6: Session Verification (GET /api/auth/me) ---');
    const meRes = await makeRequest('/api/auth/me', 'GET', null, authToken);
    assert(meRes.status === 200, `GET /api/auth/me failed with status ${meRes.status}`);
    assert(meRes.body.user.email === 'jane.smith@test.edu', 'User profile mismatch');
    console.log('Passed: Session restored & validated via JWT token.\n');

    // TEST 7a: Enforce Faculty Cannot Enroll Students
    console.log('--- TEST 7a: Faculty Enrollment Prohibition ---');
    const studentData = {
      firstName: 'Alex',
      lastName: 'Johnson',
      name: 'Alex Johnson',
      studentId: 'TEST-STU-001',
      rollNumber: 'CS-01',
      email: 'alex@test.edu',
      department: 'Computer Science',
      className: 'CS-A',
      year: '3rd Year',
    };
    const facEnrollAttempt = await makeRequest('/api/students', 'POST', studentData, authToken);
    assert(facEnrollAttempt.status === 403, `Expected 403 for faculty enrollment, got ${facEnrollAttempt.status}`);
    assert(
      facEnrollAttempt.body.message.includes('Administrator privileges required'),
      'Unexpected forbidden message'
    );
    console.log('Passed: Faculty blocked from creating student profiles (403 Forbidden).\n');

    // TEST 7b: Enforce Faculty Cannot Access Admin Endpoints
    console.log('--- TEST 7b: Faculty Cannot Access Admin Endpoints ---');
    const adminRouteAttempt = await makeRequest('/api/admin/stats', 'GET', null, authToken);
    assert(adminRouteAttempt.status === 403, `Expected 403 for faculty accessing admin stats, got ${adminRouteAttempt.status}`);
    console.log('Passed: Faculty blocked from accessing admin dashboard routes.\n');

    // TEST 7c: Centralized Admin Student Enrollment
    console.log('--- TEST 7c: Centralized Admin Student Enrollment ---');
    const createStudentRes = await makeRequest('/api/students', 'POST', studentData, adminToken);
    assert(createStudentRes.status === 201, `Admin student enrollment failed: ${JSON.stringify(createStudentRes.body)}`);
    assert(createStudentRes.body.student._id, 'Student not created');
    testStudent = createStudentRes.body.student;
    console.log('Passed: Admin enrolled student centrally in canonical database.\n');

    // TEST 8: Prevent Duplicate Student ID
    console.log('--- TEST 8: Prevent Duplicate Student ID ---');
    const dupStudentIdRes = await makeRequest(
      '/api/students',
      'POST',
      { ...studentData, rollNumber: 'CS-99', email: 'alex2@test.edu' },
      adminToken
    );
    assert(dupStudentIdRes.status === 409, `Expected 409 for duplicate studentId, got ${dupStudentIdRes.status}`);
    console.log('Passed: Duplicate student ID rejected.\n');

    // TEST 8b: Prevent Duplicate Student Email
    console.log('--- TEST 8b: Prevent Duplicate Student Email ---');
    const dupEmailRes = await makeRequest(
      '/api/students',
      'POST',
      { ...studentData, studentId: 'TEST-STU-999', rollNumber: 'CS-99' },
      adminToken
    );
    assert(dupEmailRes.status === 409, `Expected 409 for duplicate student email, got ${dupEmailRes.status}`);
    console.log('Passed: Duplicate student email rejected.\n');

    // TEST 9: Prevent Duplicate Roll Number in Same Class
    console.log('--- TEST 9: Prevent Duplicate Roll Number in Same Class ---');
    const dupRollRes = await makeRequest(
      '/api/students',
      'POST',
      { ...studentData, studentId: 'TEST-STU-002', email: 'alex3@test.edu' },
      adminToken
    );
    assert(dupRollRes.status === 409, `Expected 409 for duplicate roll in class, got ${dupRollRes.status}`);
    console.log('Passed: Duplicate roll number in same class rejected.\n');

    // TEST 10: Enroll a 2nd Student for Attendance Testing
    console.log('--- TEST 10: Enroll Second Student ---');
    const student2Data = {
      firstName: 'Bethany',
      lastName: 'Williams',
      name: 'Bethany Williams',
      studentId: 'TEST-STU-002',
      rollNumber: 'CS-02',
      email: 'bethany@test.edu',
      department: 'Computer Science',
      className: 'CS-A',
      year: '3rd Year',
    };
    const student2Res = await makeRequest('/api/students', 'POST', student2Data, adminToken);
    assert(student2Res.status === 201, 'Failed to enroll second student');
    const student2 = student2Res.body.student;
    console.log('Passed: Second student enrolled centrally.\n');

    // TEST 10b: Admin Assigns Subjects to Faculty
    console.log('--- TEST 10b: Admin Assigns Subjects to Faculty ---');
    const assignRes = await makeRequest(`/api/admin/faculty/${facultyUser._id}`, 'PUT', {
      assignedSubjects: ['Test Subject AI', 'Distributed Systems'],
    }, adminToken);
    assert(assignRes.status === 200, `Failed to assign subjects: ${JSON.stringify(assignRes.body)}`);
    assert(assignRes.body.faculty.assignedSubjects.includes('Test Subject AI'), 'Assigned subject not in faculty profile');
    console.log('Passed: Admin assigned subjects ["Test Subject AI", "Distributed Systems"] to Faculty.\n');

    // TEST 11: Get Student List & Search (Accessible to Faculty)
    console.log('--- TEST 11: Student Search ---');
    const searchRes = await makeRequest('/api/students?search=Alex', 'GET', null, authToken);
    assert(searchRes.status === 200, 'Search request failed');
    assert(searchRes.body.students.length === 1, `Expected 1 match for Alex, got ${searchRes.body.students.length}`);
    assert(searchRes.body.students[0].name === 'Alex Johnson', 'Search match name incorrect');
    console.log('Passed: Student search by name works.\n');

    // TEST 12: Get Student Details
    console.log('--- TEST 12: Student Details by ID ---');
    const getByIdRes = await makeRequest(`/api/students/${testStudent._id}`, 'GET', null, authToken);
    assert(getByIdRes.status === 200, `GET /api/students/:id failed with status ${getByIdRes.status}`);
    assert(getByIdRes.body.student.rollNumber === 'CS-01', 'Roll number mismatch');
    console.log('Passed: Student details retrieved.\n');

    // TEST 12b: Get Distinct Class Names (Optimized Roster API)
    console.log('--- TEST 12b: Distinct Class Names ---');
    const classesRes = await makeRequest('/api/students/classes', 'GET', null, authToken);
    assert(classesRes.status === 200, `GET /api/students/classes failed with status ${classesRes.status}`);
    assert(Array.isArray(classesRes.body.classes), 'Classes response should be an array');
    assert(classesRes.body.classes.includes('CS-A'), 'Classes should contain CS-A');
    console.log('Passed: Lightweight class names API verified.\n');

    // TEST 12c: Student Pagination
    console.log('--- TEST 12c: Student Pagination ---');
    const pageRes = await makeRequest('/api/students?page=1&limit=1', 'GET', null, authToken);
    assert(pageRes.status === 200, `GET /api/students with pagination failed: ${pageRes.status}`);
    assert(pageRes.body.students.length === 1, `Expected 1 paginated student, got ${pageRes.body.students.length}`);
    console.log('Passed: Student pagination works.\n');

    // TEST 13a: Prevent Attendance for Unassigned Subject
    console.log('--- TEST 13a: Prevent Attendance for Unassigned Subject ---');
    const today = new Date().toISOString().split('T')[0];
    const unassignedAttendancePayload = {
      className: 'CS-A',
      subject: 'Unassigned Subject X',
      date: today,
      students: [
        { studentId: testStudent._id, status: 'present' },
      ],
    };
    const unassignedAttRes = await makeRequest('/api/attendance', 'POST', unassignedAttendancePayload, authToken);
    assert(unassignedAttRes.status === 403, `Expected 403 for unassigned subject, got ${unassignedAttRes.status}`);
    assert(unassignedAttRes.body.message.includes('not authorized to record attendance'), 'Unexpected error message');
    console.log('Passed: Attendance creation for unassigned subject blocked with 403 Forbidden.\n');

    // TEST 13b: Create Attendance Session for Assigned Subject
    console.log('--- TEST 13b: Record Attendance for Authorized Subject ---');
    const attendancePayload = {
      className: 'CS-A',
      subject: 'Test Subject AI',
      date: today,
      students: [
        { studentId: testStudent._id, status: 'present' },
        { studentId: student2._id, status: 'absent' },
      ],
    };
    const attRes = await makeRequest('/api/attendance', 'POST', attendancePayload, authToken);
    assert(attRes.status === 201, `Failed to record attendance: ${JSON.stringify(attRes.body)}`);
    assert(attRes.body.attendance.students.length === 2, 'Attendance roster length mismatch');
    console.log('Passed: Attendance session recorded and saved to MongoDB for assigned subject.\n');

    // TEST 14: Prevent Duplicate Attendance for Same Class + Subject + Date
    console.log('--- TEST 14: Prevent Duplicate Attendance ---');
    const dupAttRes = await makeRequest('/api/attendance', 'POST', attendancePayload, authToken);
    assert(dupAttRes.status === 409, `Expected 409 for duplicate attendance, got ${dupAttRes.status}`);
    assert(
      dupAttRes.body.message === 'Attendance has already been recorded for this class and subject today.',
      `Unexpected duplicate message: ${dupAttRes.body.message}`
    );
    console.log('Passed: Duplicate attendance prevented with required message.\n');

    // TEST 15a: Faculty Scoped Attendance History
    console.log('--- TEST 15a: Faculty Scoped Attendance History ---');
    const historyRes = await makeRequest('/api/attendance', 'GET', null, authToken);
    assert(historyRes.status === 200, 'Failed to fetch attendance history');
    assert(historyRes.body.records.length >= 1, 'Expected at least 1 attendance record');
    assert(
      historyRes.body.records.every((r) => ['Test Subject AI', 'Distributed Systems'].includes(r.subject)),
      'Records contained unassigned subjects!'
    );
    console.log(`Passed: Retrieved ${historyRes.body.records.length} records, strictly matching assigned subjects.\n`);

    // TEST 15b: Reject Attendance History for Unassigned Subject Query
    console.log('--- TEST 15b: Reject History Query for Unassigned Subject ---');
    const unauthHistoryRes = await makeRequest('/api/attendance?subject=Unassigned%20Subject%20X', 'GET', null, authToken);
    assert(unauthHistoryRes.status === 403, `Expected 403 for unassigned subject history, got ${unauthHistoryRes.status}`);
    console.log('Passed: Faculty query for unassigned subject history rejected with 403 Forbidden.\n');

    // TEST 15c: Export Attendance as CSV
    console.log('--- TEST 15c: Export Attendance as CSV ---');
    const csvExportRes = await makeRequest(`/api/attendance/${attRes.body.attendance._id}/export-csv`, 'GET', null, authToken);
    assert(csvExportRes.status === 200, 'Failed to export attendance CSV');
    assert(typeof csvExportRes.body === 'string' && csvExportRes.body.includes('Student Name'), 'CSV header missing');
    assert(csvExportRes.body.includes('Present') && csvExportRes.body.includes('Absent'), 'CSV status values missing');
    assert(csvExportRes.body.includes('Alex Johnson'), 'Student name missing from CSV');
    assert(csvExportRes.body.includes('Test Subject AI'), 'Subject name missing from CSV');
    console.log('Passed: Attendance CSV export endpoint generated and validated with all required columns.\n');

    // TEST 16: Student Attendance Statistics
    console.log('--- TEST 16: Student Attendance Statistics Calculation ---');
    const stuAttRes = await makeRequest(`/api/attendance/student/${testStudent._id}`, 'GET', null, authToken);
    assert(stuAttRes.status === 200, 'Failed to fetch student attendance');
    assert(stuAttRes.body.stats.totalClasses === 1, `Expected 1 total class, got ${stuAttRes.body.stats.totalClasses}`);
    assert(stuAttRes.body.stats.presentClasses === 1, 'Expected 1 present class');
    assert(stuAttRes.body.stats.percentage === 100, `Expected 100% attendance, got ${stuAttRes.body.stats.percentage}`);
    console.log('Passed: Student attendance stats calculation verified: 100% for 1/1 present.\n');

    const stu2AttRes = await makeRequest(`/api/attendance/student/${student2._id}`, 'GET', null, authToken);
    assert(stu2AttRes.body.stats.percentage === 0, `Expected 0% attendance for absent student, got ${stu2AttRes.body.stats.percentage}`);
    console.log('Passed: Student 2 attendance stats calculation verified: 0% for 0/1 present.\n');

    // TEST 17: Dashboard Attendance Statistics Scoped to Faculty
    console.log('--- TEST 17: Dashboard Attendance Statistics Scoped to Faculty ---');
    const statsRes = await makeRequest('/api/attendance/stats', 'GET', null, authToken);
    assert(statsRes.status === 200, 'Failed to fetch stats');
    assert(statsRes.body.stats.totalStudents >= 2, 'Total students count incorrect');
    assert(statsRes.body.stats.todaySessions >= 1, 'Today sessions count incorrect');
    assert(Array.isArray(statsRes.body.stats.assignedSubjects), 'assignedSubjects not in stats response');
    console.log('Passed: Dashboard statistics verified with real MongoDB counts scoped to faculty subjects.\n');

    // TEST 19: Biometric Face Template Association
    console.log('--- TEST 19: Biometric Face Template Association ---');
    const FaceTemplate = require('../src/models/FaceTemplate');
    const dummyEmbedding = new Array(128).fill(0.05);
    dummyEmbedding[0] = 0.95;
    const templateDoc = await FaceTemplate.create({
      studentId: testStudent._id,
      modelIdentifier: 'opencv_yunet_sface_v1',
      embedding: dummyEmbedding,
      qualityScore: 0.88,
    });
    assert(templateDoc._id, 'FaceTemplate record not created');

    const studentWithTmpl = await makeRequest(`/api/students/${testStudent._id}`, 'GET', null, authToken);
    assert(studentWithTmpl.status === 200, 'Failed to fetch student details');
    assert(studentWithTmpl.body.student.faceTemplate, 'FaceTemplate was not returned on student profile');
    assert(studentWithTmpl.body.student.faceTemplate.modelIdentifier === 'opencv_yunet_sface_v1', 'Model identifier mismatch');
    console.log('Passed: Biometric template associated and retrieved with student.\n');

    // TEST 20: Revoke and Delete Face Biometric Template (Admin only)
    console.log('--- TEST 20: Revoke and Delete Face Biometric Template (Admin Only) ---');
    // Faculty attempt should fail
    const facDelTmpl = await makeRequest(`/api/students/${testStudent._id}/face-template`, 'DELETE', null, authToken);
    assert(facDelTmpl.status === 403, `Expected 403 for faculty deleting template, got ${facDelTmpl.status}`);

    // Admin attempt succeeds
    const deleteTmplRes = await makeRequest(`/api/students/${testStudent._id}/face-template`, 'DELETE', null, adminToken);
    assert(deleteTmplRes.status === 200, `Delete face-template failed: ${deleteTmplRes.status}`);
    const remainingTmpl = await FaceTemplate.findOne({ studentId: testStudent._id });
    assert(!remainingTmpl, 'Face template was not deleted from database');
    console.log('Passed: Face biometric template revoked and deleted by Admin.\n');

    // TEST 21: Attendance with Multiple Photos & Audit Provenance
    console.log('--- TEST 21: Multi-Photo Attendance & Audit Provenance ---');
    const multiPhotoPayload = {
      className: 'CS-B',
      subject: 'Distributed Systems',
      date: '2026-10-12',
      capturedImageUrls: ['/uploads/row_1.jpg', '/uploads/row_2.jpg'],
      students: [
        {
          studentId: testStudent._id,
          status: 'present',
          matchConfidence: 0.94,
          detectionProvenance: 'auto_matched',
        },
      ],
    };
    const multiPhotoRes = await makeRequest('/api/attendance', 'POST', multiPhotoPayload, authToken);
    assert(multiPhotoRes.status === 201, `Multi-photo attendance save failed: ${JSON.stringify(multiPhotoRes.body)}`);
    assert(multiPhotoRes.body.attendance.capturedImageUrls.length === 2, 'capturedImageUrls length mismatch');
    assert(multiPhotoRes.body.attendance.students[0].detectionProvenance === 'auto_matched', 'detectionProvenance not saved');
    console.log('Passed: Multi-photo attendance and detection provenance audit verified.\n');

    // TEST 22: Clean Up Test Records
    console.log('--- TEST 22: Clean Up Test Records ---');
    await Student.deleteMany({ studentId: /^TEST-/ });
    await Attendance.deleteMany({ subject: { $in: ['Test Subject AI', 'Distributed Systems'] } });
    await Faculty.deleteMany({ email: 'jane.smith@test.edu' });
    await FaceTemplate.deleteMany({});
    console.log('Passed: Cleaned up test data.\n');

    console.log('🎉 ALL AUTOMATED E2E & ROLE AUTHORIZATION TESTS PASSED SUCCESSFULLY! 🚀');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test Failure:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

runTests();
