import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Loading from '../../components/Loading';
import CustomButton from '../../components/CustomButton';
import { COLORS, SHADOWS } from '../../constants/config';
import { getStudentById, getStudentImageUrl, deleteStudent, deleteFaceTemplate } from '../../services/studentService';
import { getStudentAttendance } from '../../services/attendanceService';
import { formatDate } from '../../utils/attendance';

export default function StudentDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [student, setStudent] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [studentRes, attendanceRes] = await Promise.all([
        getStudentById(id),
        getStudentAttendance(id),
      ]);

      if (studentRes.success) setStudent(studentRes.student);
      if (attendanceRes.success) setStats(attendanceRes.stats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load student details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student?.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStudent(id);
              Alert.alert('Deleted', 'Student has been removed.');
              router.back();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete student.');
            }
          },
        },
      ]
    );
  };

  const handleRevokeBiometrics = () => {
    Alert.alert(
      'Revoke Biometric Face Template',
      `Are you sure you want to delete ${student?.name}'s facial biometric template? Their photo and embeddings will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Template',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFaceTemplate(id);
              Alert.alert('Revoked', 'Facial biometric template has been deleted.');
              loadData();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to revoke biometric template.');
            }
          },
        },
      ]
    );
  };

  const isBiometricEnrolled = student?.faceEnrollmentStatus === 'enrolled' || !!student?.faceTemplate;
  const rawImageUrl = student?.faceImageUrl ? getStudentImageUrl(student.faceImageUrl) : null;
  const imageUrl = typeof rawImageUrl === 'string' && rawImageUrl.trim().length > 0 ? rawImageUrl : null;
  const displayName =
    student?.name ||
    `${student?.firstName || ''} ${student?.lastName || ''}`.trim() ||
    'Student';

  if (loading || !student) {
    return <Loading message="Loading student details..." />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.studentName}>{displayName}</Text>
        <Text style={styles.studentClass}>
          {student?.className} • {student?.department}
        </Text>
      </View>

      {/* Info Cards */}
      <View style={styles.infoCard}>
        <InfoRow label="Student ID" value={student.studentId} />
        <InfoRow label="Roll Number" value={student.rollNumber} />
        <InfoRow label="Email" value={student.email || 'Not provided'} />
        <InfoRow label="Department" value={student.department} />
        <InfoRow label="Class / Division" value={student.className} />
        <InfoRow label="Year" value={student.year} />
        <InfoRow
          label="Face Biometrics"
          value={isBiometricEnrolled ? '✓ Template Enrolled' : 'Not Enrolled'}
        />
        <InfoRow label="Enrolled On" value={formatDate(student.createdAt)} />
      </View>

      {/* Attendance Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Attendance</Text>
        {stats && stats.totalClasses > 0 ? (
          <>
            <View style={styles.percentageRow}>
              <Text style={styles.percentageNumber}>
                {stats.percentage}%
              </Text>
              <Text style={styles.percentageLabel}>Overall Attendance</Text>
            </View>
            <View style={styles.statsDetails}>
              <StatItem label="Total Classes" value={stats.totalClasses} color={COLORS.primary} />
              <StatItem label="Present" value={stats.presentClasses} color={COLORS.success} />
              <StatItem label="Absent" value={stats.absentClasses} color={COLORS.error} />
            </View>
          </>
        ) : (
          <Text style={styles.noStats}>No attendance records available.</Text>
        )}
      </View>

      {/* Biometric Revocation Action */}
      {isBiometricEnrolled && (
        <CustomButton
          title="REVOKE FACE BIOMETRICS"
          onPress={handleRevokeBiometrics}
          variant="outline"
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Actions */}
      <CustomButton
        title="DELETE STUDENT"
        onPress={handleDelete}
        variant="danger"
        style={styles.deleteButton}
      />
    </ScrollView>
  );
}

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const StatItem = ({ label, value, color }) => (
  <View style={styles.statItem}>
    <Text style={[styles.statNumber, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  avatarContainer: {
    marginBottom: 14,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.background,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.primary,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  studentClass: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  percentageRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  percentageNumber: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.primary,
  },
  percentageLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statsDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  noStats: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  deleteButton: {
    marginBottom: 20,
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.error,
    fontSize: 16,
    padding: 40,
  },
});
