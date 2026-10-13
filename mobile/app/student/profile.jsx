import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS, SHADOWS, API_BASE_URL } from '../../constants/config';
import { lookupStudentPortal, getStudentPortalById } from '../../services/studentService';
import { getStudentAttendance } from '../../services/attendanceService';
import { formatDate } from '../../utils/attendance';

export default function StudentProfileScreen() {
  const params = useLocalSearchParams();
  const [studentIdInput, setStudentIdInput] = useState('');
  const [student, setStudent] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // If a studentId or id was passed directly in params
  useEffect(() => {
    if (params.id) {
      loadStudentDirectly(params.id);
    }
  }, [params.id]);

  const loadStudentDirectly = async (id) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await getStudentPortalById(id);
      if (res.success && res.student) {
        setStudent(res.student);
        await loadAttendanceStats(res.student._id);
      } else {
        setStudent(null);
      }
    } catch {
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceStats = async (mongoId) => {
    try {
      const res = await getStudentAttendance(mongoId);
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } catch {
      // Non-blocking
    }
  };

  const handleLookup = async () => {
    if (!studentIdInput.trim()) {
      Alert.alert('Required', 'Please enter your Student ID or Roll Number.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setStudent(null);
    setStats(null);

    try {
      const query = studentIdInput.trim();
      const res = await lookupStudentPortal(query);
      if (res.success && res.students && res.students.length > 0) {
        // Find closest match by studentId or rollNumber
        const matched =
          res.students.find(
            (s) =>
              s.studentId?.toLowerCase() === query.toLowerCase() ||
              s.rollNumber?.toLowerCase() === query.toLowerCase()
          ) || res.students[0];

        setStudent(matched);
        await loadAttendanceStats(matched._id);
      } else {
        setStudent(null);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to find student record.');
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const photoUrl =
    student && student.faceImageUrl
      ? `${API_BASE_URL.replace('/api', '')}${student.faceImageUrl}`
      : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Lookup Card if no student selected yet */}
        <View style={styles.lookupCard}>
          <Text style={styles.lookupTitle}>Student Portal</Text>
          <Text style={styles.lookupSubtitle}>
            Enter your Student ID or Roll Number to check your profile and attendance records
          </Text>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <CustomInput
                label="Student ID or Roll Number"
                value={studentIdInput}
                onChangeText={setStudentIdInput}
                placeholder="e.g., STU-101 or 45"
                autoCapitalize="none"
              />
            </View>
          </View>

          <CustomButton
            title="FIND STUDENT RECORD"
            onPress={handleLookup}
            loading={loading}
            style={styles.lookupBtn}
          />
        </View>

        {loading && <Loading message="Retrieving student profile..." />}

        {/* Not Found */}
        {!loading && searched && !student && (
          <EmptyState
            icon="🔍"
            title="Student Not Found"
            message={`No student matching "${studentIdInput}" was found. Please check your Student ID or contact faculty.`}
          />
        )}

        {/* Student Profile Card */}
        {!loading && student && (
          <View style={styles.profileCard}>
            {/* Header with Photo & Name */}
            <View style={styles.profileHeader}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoInitial}>
                    {student.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentIdBadge}>ID: {student.studentId}</Text>
            </View>

            {/* Attendance Percentage Badge */}
            {stats && (
              <View style={styles.statsBanner}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>
                    {stats.totalClasses > 0 ? `${stats.percentage}%` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Attendance Rate</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: COLORS.success }]}>
                    {stats.presentClasses}
                  </Text>
                  <Text style={styles.statLabel}>Classes Attended</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNumber, { color: COLORS.error }]}>
                    {stats.absentClasses}
                  </Text>
                  <Text style={styles.statLabel}>Classes Absent</Text>
                </View>
              </View>
            )}

            {/* Details Grid */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Roll Number</Text>
                <Text style={styles.infoValue}>{student.rollNumber}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Class / Division</Text>
                <Text style={styles.infoValue}>{student.className}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department</Text>
                <Text style={styles.infoValue}>{student.department}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Year</Text>
                <Text style={styles.infoValue}>{student.year}</Text>
              </View>

              {student.email ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{student.email}</Text>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Enrolled Date</Text>
                <Text style={styles.infoValue}>{formatDate(student.createdAt)}</Text>
              </View>
            </View>

            {/* View Full History Button */}
            <CustomButton
              title="VIEW ATTENDANCE DETAILS"
              onPress={() =>
                router.push({
                  pathname: '/student/attendance',
                  params: {
                    studentId: student._id,
                    studentName: student.name,
                    rollNumber: student.rollNumber,
                  },
                })
              }
              style={styles.historyBtn}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  lookupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  lookupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  lookupSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  inputRow: {
    marginBottom: 6,
  },
  lookupBtn: {
    marginTop: 8,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    ...SHADOWS.medium,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 14,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  photoInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  studentIdBadge: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  infoSection: {
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f3f4',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyBtn: {
    width: '100%',
  },
});
