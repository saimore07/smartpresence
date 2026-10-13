/**
 * SmartPresence Comprehensive Feature Enhancements & Security Test Suite
 * Tests:
 * - Feature A: First & last name separation, compulsory unique email, credential provisioning
 * - Feature B: Student login, first-login password change, strict role-based access control
 * - Feature C: Subject-wise attendance calculation, denominator rules, overall aggregate, zero-session safety
 * - Feature D: 12-hour session time picker, time range validation, distinct same-day sessions, duplicate prevention
 * - Feature E: Backward compatibility with legacy records
 */

const mongoose = require('mongoose');
const http = require('http');
const app = require('../src/app');
const Faculty = require('../src/models/Faculty');
const Student = require('../src/models/Student');
const Attendance = require('../src/models/Attendance');
const runMigrations = require('../src/migrations/migrateDatabase');

const TEST_PORT = 5089;
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/smartpresence_test';

let server;
let facultyToken = '';
let facultyUser = null;

const makeRequest = (path, method = 'GET', body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

const runTests = async () => {
  console.log('🧪 Starting SmartPresence Feature Enhancements & Security Test Suite...\n');

  try {
    await mongoose.connect(TEST_DB_URI);
    console.log('✅ Connected to Test Database:', TEST_DB_URI);

    // Apply database migration to test DB (drop obsolete indexes, ensure new compound indexes)
    await runMigrations();

    // Clean test records
    await Faculty.deleteMany({ email: /@enhancement\.test$/ });
    await Student.deleteMany({ studentId: /^ENH-/ });
    await Attendance.deleteMany({ subject: /^ENH-/ });

    server = app.listen(TEST_PORT);
    console.log(`✅ Test server running on port ${TEST_PORT}\n`);

    // Setup: Create Faculty account for enrollment and session management
    console.log('--- SETUP: Faculty Authentication ---');
    const facRes = await makeRequest('/api/auth/faculty/signup', 'POST', {
      name: 'Prof. Alan Turing',
      facultyId: 'FAC-ENH-001',
      email: 'alan.turing@enhancement.test',
      department: 'Computer Science',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    });
    assert(facRes.status === 201, `Faculty signup failed: ${JSON.stringify(facRes.body)}`);
    facultyToken = facRes.body.token;
    facultyUser = facRes.body.user;
    console.log('Passed: Test Faculty account created.\n');

    // ==========================================
    // FEATURE A TESTS: ENROLLMENT ENHANCEMENTS
    // ==========================================
    console.log('--- FEATURE A: Student Enrollment Enhancements ---');

    // A1. Valid enrollment with first name, last name, and compulsory email
    const student1Payload = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      studentId: 'ENH-STU-001',
      rollNumber: 'CS-ENH-01',
      email: 'ada.lovelace@enhancement.test',
      department: 'Computer Science',
      className: 'CS-ENH-A',
      year: '3rd Year',
    };
    const s1Res = await makeRequest('/api/students', 'POST', student1Payload, facultyToken);
    assert(s1Res.status === 201, `Enrollment failed: ${JSON.stringify(s1Res.body)}`);
    assert(s1Res.body.student.firstName === 'Ada', 'First name mismatch');
    assert(s1Res.body.student.lastName === 'Lovelace', 'Last name mismatch');
    assert(s1Res.body.student.name === 'Ada Lovelace', 'Derived full name mismatch');
    assert(s1Res.body.student.email === 'ada.lovelace@enhancement.test', 'Email mismatch');
    assert(!s1Res.body.student.passwordHash, 'SECURITY VIOLATION: passwordHash exposed in response!');
    assert(s1Res.body.activation, 'Activation credential missing from enrollment response');
    assert(s1Res.body.activation.temporaryPassword, 'Temporary password missing from activation');
    assert(s1Res.body.activation.mustChangePassword === true, 'mustChangePassword should be true');
    const student1 = s1Res.body.student;
    const student1TempPass = s1Res.body.activation.temporaryPassword;
    console.log('Passed A1: Enrollment with firstName, lastName, email, and auto-generated temporary password.\n');

    // A2. Reject missing first name
    const missingFirstRes = await makeRequest(
      '/api/students',
      'POST',
      { ...student1Payload, studentId: 'ENH-STU-002', rollNumber: 'CS-ENH-02', email: 'ada2@enhancement.test', firstName: '' },
      facultyToken
    );
    assert(missingFirstRes.status === 400, `Expected 400 for missing firstName, got ${missingFirstRes.status}`);
    console.log('Passed A2: Rejected enrollment with empty first name.\n');

    // A3. Reject missing last name
    const missingLastRes = await makeRequest(
      '/api/students',
      'POST',
      { ...student1Payload, studentId: 'ENH-STU-003', rollNumber: 'CS-ENH-03', email: 'ada3@enhancement.test', lastName: '   ' },
      facultyToken
    );
    assert(missingLastRes.status === 400, `Expected 400 for whitespace-only lastName, got ${missingLastRes.status}`);
    console.log('Passed A3: Rejected enrollment with whitespace-only last name.\n');

    // A4. Reject missing email
    const missingEmailRes = await makeRequest(
      '/api/students',
      'POST',
      { ...student1Payload, studentId: 'ENH-STU-004', rollNumber: 'CS-ENH-04', email: '' },
      facultyToken
    );
    assert(missingEmailRes.status === 400, `Expected 400 for missing email, got ${missingEmailRes.status}`);
    console.log('Passed A4: Rejected enrollment with missing compulsory email.\n');

    // A5. Reject invalid email format
    const invalidEmailRes = await makeRequest(
      '/api/students',
      'POST',
      { ...student1Payload, studentId: 'ENH-STU-005', rollNumber: 'CS-ENH-05', email: 'invalid-email-no-at' },
      facultyToken
    );
    assert(invalidEmailRes.status === 400, `Expected 400 for invalid email, got ${invalidEmailRes.status}`);
    console.log('Passed A5: Rejected enrollment with invalid email format.\n');

    // A6. Reject duplicate email (case-insensitive)
    const dupEmailRes = await makeRequest(
      '/api/students',
      'POST',
      { ...student1Payload, studentId: 'ENH-STU-006', rollNumber: 'CS-ENH-06', email: 'ADA.LOVELACE@ENHANCEMENT.TEST' },
      facultyToken
    );
    assert(dupEmailRes.status === 409, `Expected 409 for duplicate email, got ${dupEmailRes.status}`);
    console.log('Passed A6: Prevented duplicate email enrollment (case-normalized).\n');

    // A7. Unicode and hyphenated name support
    const unicodeStudentPayload = {
      firstName: 'José-Maria',
      lastName: 'Nuñez',
      studentId: 'ENH-STU-007',
      rollNumber: 'CS-ENH-07',
      email: 'jose.nunez@enhancement.test',
      department: 'Computer Science',
      className: 'CS-ENH-A',
      year: '3rd Year',
    };
    const unicodeRes = await makeRequest('/api/students', 'POST', unicodeStudentPayload, facultyToken);
    assert(unicodeRes.status === 201, `Failed to enroll unicode student: ${JSON.stringify(unicodeRes.body)}`);
    assert(unicodeRes.body.student.name === 'José-Maria Nuñez', 'Unicode/hyphen name corrupted');
    const student2 = unicodeRes.body.student;
    const student2TempPass = unicodeRes.body.activation.temporaryPassword;
    console.log('Passed A7: Unicode, hyphens, and spaces supported in student names.\n');

    // ==========================================
    // FEATURE B TESTS: STUDENT LOGIN & SECURITY
    // ==========================================
    console.log('--- FEATURE B: Student Login & Role Authorization ---');

    // B1. Student login with valid credentials (email & temporary password)
    const stuLoginRes = await makeRequest('/api/auth/student/login', 'POST', {
      email: 'ada.lovelace@enhancement.test',
      password: student1TempPass,
    });
    assert(stuLoginRes.status === 200, `Student login failed: ${JSON.stringify(stuLoginRes.body)}`);
    assert(stuLoginRes.body.token, 'Student login did not issue a JWT token');
    assert(stuLoginRes.body.user.role === 'student', 'User role should be student');
    assert(stuLoginRes.body.mustChangePassword === true, 'mustChangePassword flag should be true on first login');
    const studentToken = stuLoginRes.body.token;
    console.log('Passed B1: Student logged in successfully with temporary credential.\n');

    // B2. Student login with incorrect password
    const badPassRes = await makeRequest('/api/auth/student/login', 'POST', {
      email: 'ada.lovelace@enhancement.test',
      password: 'WrongPassword999',
    });
    assert(badPassRes.status === 401, `Expected 401 for wrong password, got ${badPassRes.status}`);
    assert(badPassRes.body.message === 'Invalid email or password.', 'Generic failure message expected');
    console.log('Passed B2: Incorrect student password rejected with generic error.\n');

    // B3. Student login with non-existent email
    const unknownEmailRes = await makeRequest('/api/auth/student/login', 'POST', {
      email: 'ghost.user@enhancement.test',
      password: 'SomePassword123',
    });
    assert(unknownEmailRes.status === 401, `Expected 401 for unknown email, got ${unknownEmailRes.status}`);
    assert(unknownEmailRes.body.message === 'Invalid email or password.', 'Generic failure message expected');
    console.log('Passed B3: Non-existent email rejected without revealing account non-existence.\n');

    // B4. Enforcement: Student cannot access protected attendance before mandatory password change
    const prematureAttRes = await makeRequest('/api/students/attendance/summary', 'GET', null, studentToken);
    assert(prematureAttRes.status === 403, `Expected 403 before password change, got ${prematureAttRes.status}`);
    assert(prematureAttRes.body.mustChangePassword === true, 'Response should indicate mustChangePassword required');
    console.log('Passed B4: Access to attendance blocked until mandatory password change is completed.\n');

    // B5. Mandatory password change flow
    const changePassRes = await makeRequest(
      '/api/auth/student/change-password',
      'POST',
      {
        oldPassword: student1TempPass,
        newPassword: 'MyNewPermanentPassword123!',
        confirmPassword: 'MyNewPermanentPassword123!',
      },
      studentToken
    );
    assert(changePassRes.status === 200, `Password change failed: ${JSON.stringify(changePassRes.body)}`);
    assert(changePassRes.body.token, 'Password change should refresh authenticated token');
    assert(changePassRes.body.mustChangePassword === false, 'mustChangePassword should now be false');
    const activeStudentToken = changePassRes.body.token;
    console.log('Passed B5: Mandatory password change completed and updated credential.\n');

    // B6. Old temporary password no longer works
    const oldLoginRes = await makeRequest('/api/auth/student/login', 'POST', {
      email: 'ada.lovelace@enhancement.test',
      password: student1TempPass,
    });
    assert(oldLoginRes.status === 401, 'Old temporary password should no longer authenticate');
    console.log('Passed B6: Old temporary password revoked.\n');

    // B7. New permanent password works
    const newLoginRes = await makeRequest('/api/auth/student/login', 'POST', {
      email: 'ada.lovelace@enhancement.test',
      password: 'MyNewPermanentPassword123!',
    });
    assert(newLoginRes.status === 200, 'New permanent password failed to authenticate');
    assert(newLoginRes.body.mustChangePassword === false, 'mustChangePassword should remain false');
    console.log('Passed B7: New permanent password verified.\n');

    // B8. Role Security: Student token CANNOT access faculty endpoints
    const stuUnauthorizedRes = await makeRequest(
      '/api/students',
      'POST',
      { ...student1Payload, studentId: 'ROGUE-001', rollNumber: 'ROGUE-01', email: 'rogue@enhancement.test' },
      activeStudentToken
    );
    assert(stuUnauthorizedRes.status === 403, `Expected 403 for student accessing faculty enrollment, got ${stuUnauthorizedRes.status}`);

    const stuAttendanceTakeRes = await makeRequest(
      '/api/attendance',
      'POST',
      { className: 'CS-ENH-A', subject: 'ENH-CyberSecurity', date: '2026-10-13', students: [] },
      activeStudentToken
    );
    assert(stuAttendanceTakeRes.status === 403, `Expected 403 for student attempting to create attendance, got ${stuAttendanceTakeRes.status}`);
    console.log('Passed B8: Role guard strictly blocked student token from faculty administrative APIs.\n');

    // B9. Role Security: Faculty token CANNOT impersonate student endpoints
    const facImpersonateRes = await makeRequest('/api/students/attendance/summary', 'GET', null, facultyToken);
    assert(facImpersonateRes.status === 403, `Expected 403 for faculty token calling student endpoint, got ${facImpersonateRes.status}`);
    console.log('Passed B9: Faculty token prevented from calling student-only APIs.\n');

    // ==========================================
    // FEATURE D TESTS: 12-HOUR TIME PICKER & SESSIONS
    // ==========================================
    console.log('--- FEATURE D: 12-Hour Session Time Validation & Persistence ---');

    // D1. Valid session with 12-hour AM/PM start and end time (09:00 AM to 10:00 AM)
    const session1Payload = {
      className: 'CS-ENH-A',
      subject: 'ENH-Algorithms',
      date: '2026-10-13',
      startTime: '09:00 AM',
      endTime: '10:00 AM',
      students: [
        { studentId: student1._id, status: 'present' },
        { studentId: student2._id, status: 'absent' },
      ],
    };
    const sess1Res = await makeRequest('/api/attendance', 'POST', session1Payload, facultyToken);
    assert(sess1Res.status === 201, `Session 1 creation failed: ${JSON.stringify(sess1Res.body)}`);
    assert(sess1Res.body.attendance.startTime === '09:00 AM', 'Start time not persisted');
    assert(sess1Res.body.attendance.endTime === '10:00 AM', 'End time not persisted');
    assert(sess1Res.body.attendance.sessionSlot === '09:00 AM - 10:00 AM', 'sessionSlot mismatch');
    console.log('Passed D1: Session 1 saved with 12-hour start and end times (09:00 AM - 10:00 AM).\n');

    // D2. Multiple legitimate sessions on SAME DATE with different time slots (02:00 PM to 03:00 PM)
    const session2Payload = {
      className: 'CS-ENH-A',
      subject: 'ENH-Algorithms',
      date: '2026-10-13',
      startTime: '02:00 PM',
      endTime: '03:00 PM',
      students: [
        { studentId: student1._id, status: 'present' },
        { studentId: student2._id, status: 'present' },
      ],
    };
    const sess2Res = await makeRequest('/api/attendance', 'POST', session2Payload, facultyToken);
    assert(sess2Res.status === 201, `Second session on same date failed: ${JSON.stringify(sess2Res.body)}`);
    assert(sess2Res.body.attendance.sessionSlot === '02:00 PM - 03:00 PM', 'Session 2 slot mismatch');
    console.log('Passed D2: Multiple legitimate sessions on same date with distinct time slots recorded successfully.\n');

    // D3. Prevent duplicate submission for exact SAME class + subject + date + time slot
    const dupSessRes = await makeRequest('/api/attendance', 'POST', session1Payload, facultyToken);
    assert(dupSessRes.status === 409, `Expected 409 for duplicate time slot session, got ${dupSessRes.status}`);
    console.log('Passed D3: Prevented duplicate session submission for the same time slot.\n');

    // D4. Reject session where end time is earlier than start time (04:00 PM to 03:00 PM)
    const badRangePayload = {
      className: 'CS-ENH-A',
      subject: 'ENH-Algorithms',
      date: '2026-10-14',
      startTime: '04:00 PM',
      endTime: '03:00 PM',
      students: [{ studentId: student1._id, status: 'present' }],
    };
    const badRangeRes = await makeRequest('/api/attendance', 'POST', badRangePayload, facultyToken);
    assert(badRangeRes.status === 400, `Expected 400 for inverted time range, got ${badRangeRes.status}`);
    assert(badRangeRes.body.message.includes('later than start time'), 'Error message mismatch');
    console.log('Passed D4: End time earlier than start time rejected with validation message.\n');

    // D5. Reject invalid time string format
    const badFormatPayload = {
      className: 'CS-ENH-A',
      subject: 'ENH-Algorithms',
      date: '2026-10-14',
      startTime: '25:99',
      endTime: '10:00 AM',
      students: [{ studentId: student1._id, status: 'present' }],
    };
    const badFormatRes = await makeRequest('/api/attendance', 'POST', badFormatPayload, facultyToken);
    assert(badFormatRes.status === 400, `Expected 400 for malformed time string, got ${badFormatRes.status}`);
    console.log('Passed D5: Malformed time strings rejected.\n');

    // D6. Record a 2nd subject session for subject-wise calculation testing
    const sessionSubject2Payload = {
      className: 'CS-ENH-A',
      subject: 'ENH-Distributed-Systems',
      date: '2026-10-13',
      startTime: '11:00 AM',
      endTime: '12:00 PM',
      students: [
        { studentId: student1._id, status: 'absent' },
        { studentId: student2._id, status: 'present' },
      ],
    };
    const sessSub2Res = await makeRequest('/api/attendance', 'POST', sessionSubject2Payload, facultyToken);
    assert(sessSub2Res.status === 201, `Subject 2 session creation failed: ${JSON.stringify(sessSub2Res.body)}`);
    console.log('Passed D6: Recorded session for second subject (Distributed Systems).\n');

    // ==========================================
    // FEATURE C TESTS: ATTENDANCE DASHBOARD
    // ==========================================
    console.log('--- FEATURE C: Subject-Wise Attendance Calculation & Dashboard ---');

    // C1. Authenticated Student fetches attendance summary
    const summaryRes = await makeRequest('/api/students/attendance/summary', 'GET', null, activeStudentToken);
    assert(summaryRes.status === 200, `Summary request failed: ${JSON.stringify(summaryRes.body)}`);
    assert(summaryRes.body.student.email === 'ada.lovelace@enhancement.test', 'Student profile mismatch');
    assert(Array.isArray(summaryRes.body.subjects), 'Subjects should be an array');
    assert(summaryRes.body.subjects.length === 2, `Expected 2 subjects, got ${summaryRes.body.subjects.length}`);

    // Verify Subject 1: ENH-Algorithms (Ada attended 2 out of 2 sessions -> 100.0%)
    const algoSub = summaryRes.body.subjects.find((s) => s.subject === 'ENH-Algorithms');
    assert(algoSub, 'ENH-Algorithms subject missing');
    assert(algoSub.total === 2, `Expected 2 total sessions for Algorithms, got ${algoSub.total}`);
    assert(algoSub.attended === 2, `Expected 2 attended sessions for Algorithms, got ${algoSub.attended}`);
    assert(algoSub.percentage === 100, `Expected 100% for Algorithms, got ${algoSub.percentage}`);

    // Verify Subject 2: ENH-Distributed-Systems (Ada attended 0 out of 1 sessions -> 0.0%)
    const distSub = summaryRes.body.subjects.find((s) => s.subject === 'ENH-Distributed-Systems');
    assert(distSub, 'ENH-Distributed-Systems subject missing');
    assert(distSub.total === 1, `Expected 1 total session for Distributed Systems, got ${distSub.total}`);
    assert(distSub.attended === 0, `Expected 0 attended sessions for Distributed Systems, got ${distSub.attended}`);
    assert(distSub.percentage === 0, `Expected 0% for Distributed Systems, got ${distSub.percentage}`);

    // Verify Overall Calculation formula: (2 + 0) / (2 + 1) = 2/3 = 66.67%
    assert(summaryRes.body.overall.totalClasses === 3, `Expected 3 total classes overall, got ${summaryRes.body.overall.totalClasses}`);
    assert(summaryRes.body.overall.attendedClasses === 2, `Expected 2 attended classes overall, got ${summaryRes.body.overall.attendedClasses}`);
    assert(summaryRes.body.overall.percentage === 66.67, `Expected 66.67% overall, got ${summaryRes.body.overall.percentage}`);
    console.log('Passed C1: Subject-wise calculations and aggregate formula verified (Algorithms 100%, Distributed Systems 0%, Overall 66.67%).\n');

    // C2. Authenticated Student fetches attendance history with pagination
    const histRes = await makeRequest('/api/students/attendance/history?page=1&limit=5', 'GET', null, activeStudentToken);
    assert(histRes.status === 200, `History request failed: ${JSON.stringify(histRes.body)}`);
    assert(histRes.body.history.length === 3, `Expected 3 history sessions, got ${histRes.body.history.length}`);
    assert(histRes.body.history[0].startTime, 'startTime missing from history session');
    assert(histRes.body.history[0].endTime, 'endTime missing from history session');
    console.log('Passed C2: Student session history retrieved with time periods and pagination.\n');

    // ==========================================
    // FEATURE E: BACKWARD COMPATIBILITY
    // ==========================================
    console.log('--- FEATURE E: Legacy Records & Zero Division Handling ---');

    // E1. Enroll a fresh student with 0 sessions
    const freshStudentPayload = {
      firstName: 'Charles',
      lastName: 'Babbage',
      studentId: 'ENH-STU-008',
      rollNumber: 'CS-ENH-08',
      email: 'charles.babbage@enhancement.test',
      department: 'Computer Science',
      className: 'CS-ENH-EMPTY', // empty class with no sessions
      year: '1st Year',
    };
    const freshRes = await makeRequest('/api/students', 'POST', freshStudentPayload, facultyToken);
    assert(freshRes.status === 201, 'Fresh student enrollment failed');
    const freshStudent = freshRes.body.student;
    const freshTempPass = freshRes.body.activation.temporaryPassword;

    // Login and activate
    const freshLogin = await makeRequest('/api/auth/student/login', 'POST', {
      email: 'charles.babbage@enhancement.test',
      password: freshTempPass,
    });
    const freshPassChange = await makeRequest(
      '/api/auth/student/change-password',
      'POST',
      { oldPassword: freshTempPass, newPassword: 'FreshPermanentPassword1!', confirmPassword: 'FreshPermanentPassword1!' },
      freshLogin.body.token
    );
    const freshToken = freshPassChange.body.token;

    // E2. Zero division safety check: No sessions held
    const zeroRes = await makeRequest('/api/students/attendance/summary', 'GET', null, freshToken);
    assert(zeroRes.status === 200, 'Zero session summary request failed');
    assert(zeroRes.body.overall.totalClasses === 0, 'Total classes should be 0');
    assert(zeroRes.body.overall.percentage === 0, 'Percentage should be 0, not NaN or Infinity');
    assert(!isNaN(zeroRes.body.overall.percentage), 'Percentage returned NaN!');
    assert(isFinite(zeroRes.body.overall.percentage), 'Percentage returned Infinity!');
    console.log('Passed E1-E2: Zero division safety verified (0 total classes returns 0%, not NaN or Infinity).\n');

    // E3. Legacy student record directly in MongoDB without separate firstName/lastName
    const legacyStudentDoc = await Student.create({
      name: 'Grace Hopper',
      studentId: 'ENH-STU-LEGACY',
      rollNumber: 'CS-ENH-99',
      email: 'grace.hopper@enhancement.test',
      department: 'Computer Science',
      className: 'CS-ENH-A',
      year: '4th Year',
      createdBy: facultyUser._id,
    });
    assert(legacyStudentDoc.firstName === 'Grace', 'Legacy hook should populate firstName');
    assert(legacyStudentDoc.lastName === 'Hopper', 'Legacy hook should populate lastName');

    // Search legacy student via API
    const legacySearchRes = await makeRequest('/api/students?search=Grace', 'GET', null, facultyToken);
    assert(legacySearchRes.status === 200, 'Legacy search failed');
    assert(legacySearchRes.body.students.length === 1, 'Legacy student search should find 1 record');
    assert(legacySearchRes.body.students[0].name === 'Grace Hopper', 'Legacy student name mismatch');
    console.log('Passed E3: Legacy student records without separate firstName/lastName handled transparently.\n');

    // Clean up
    console.log('--- CLEANUP: Removing Test Records ---');
    await Faculty.deleteMany({ email: /@enhancement\.test$/ });
    await Student.deleteMany({ studentId: /^ENH-/ });
    await Attendance.deleteMany({ subject: /^ENH-/ });
    console.log('Passed: Cleaned up enhancement test records.\n');

    console.log('🎉 ALL FEATURE ENHANCEMENT & SECURITY TESTS PASSED PERFECTLY! 🚀');
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

runTests();
