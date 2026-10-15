import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Loading from '../../components/Loading';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import {
  getStudentById,
  getStudentImageUrl,
  updateStudent,
  deleteStudent,
  deleteFaceTemplate,
} from '../../services/studentService';
import { toggleStudentStatus } from '../../services/adminService';
import { getStudentAttendance } from '../../services/attendanceService';
import { formatDate } from '../../utils/attendance';

export default function AdminStudentDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [student, setStudent] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    rollNumber: '',
    className: '',
    department: '',
    year: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [studentRes, attendanceRes] = await Promise.all([
        getStudentById(id),
        getStudentAttendance(id),
      ]);

      if (studentRes.success && studentRes.student) {
        setStudent(studentRes.student);
        setEditForm({
          firstName: studentRes.student.firstName || '',
          lastName: studentRes.student.lastName || '',
          email: studentRes.student.email || '',
          rollNumber: studentRes.student.rollNumber || '',
          className: studentRes.student.className || '',
          department: studentRes.student.department || '',
          year: studentRes.student.year || '',
        });
      }
      if (attendanceRes.success) setStats(attendanceRes.stats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load student details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const res = await toggleStudentStatus(id);
      if (res.success) {
        setStudent((prev) => ({ ...prev, isActive: res.student.isActive }));
        Alert.alert(
          'Status Updated',
          `Student account is now ${res.student.isActive ? 'Active' : 'Inactive'}.`
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update student status.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required.');
      return;
    }
    if (!editForm.email.trim()) {
      Alert.alert('Validation Error', 'Student email is required.');
      return;
    }

    setEditLoading(true);
    try {
      const formData = new FormData();
      formData.append('firstName', editForm.firstName.trim());
      formData.append('lastName', editForm.lastName.trim());
      formData.append('name', `${editForm.firstName.trim()} ${editForm.lastName.trim()}`);
      formData.append('email', editForm.email.trim().toLowerCase());
      formData.append('className', editForm.className.trim());
      formData.append('department', editForm.department.trim());
      formData.append('year', editForm.year.trim());

      const res = await updateStudent(id, formData);
      if (res.success) {
        setShowEditModal(false);
        setStudent(res.student);
        Alert.alert('Success', 'Student information updated successfully.');
      }
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update student details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student?.name}? Historical attendance records will remain preserved in the database.`,
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
      `Are you sure you want to delete ${student?.name}'s facial biometric templates?`,
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
  const displayName = student?.name || `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
  const isActive = student?.isActive !== false;

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
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.studentName}>{displayName}</Text>
        <Text style={styles.studentClass}>
          {student?.className} • {student?.department}
        </Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, isActive ? styles.activeText : styles.inactiveText]}>
              {isActive ? '● Account Active' : '○ Account Deactivated'}
            </Text>
          </View>

          <View style={[styles.bioBadge, isBiometricEnrolled ? styles.bioEnrolled : styles.bioMissing]}>
            <Text style={[styles.bioText, isBiometricEnrolled ? styles.bioEnrolledText : styles.bioMissingText]}>
              {isBiometricEnrolled ? '✓ Biometrics Active' : '⚠ Biometrics Missing'}
            </Text>
          </View>
        </View>

        {/* Quick Admin Actions Row */}
        <View style={styles.adminActionRow}>
          <TouchableOpacity
            style={styles.actionBtnEdit}
            onPress={() => setShowEditModal(true)}
          >
            <Text style={styles.actionBtnEditText}>✏️ Edit Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnToggle, isActive ? styles.btnDeactivate : styles.btnActivate]}
            onPress={handleToggleActive}
          >
            <Text style={styles.actionBtnToggleText}>
              {isActive ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardSectionTitle}>Institutional Records</Text>
        <InfoRow label="First Name" value={student.firstName || '—'} />
        <InfoRow label="Last Name" value={student.lastName || '—'} />
        <InfoRow label="Student ID" value={student.studentId} />
        <InfoRow label="Roll Number" value={student.rollNumber} />
        <InfoRow label="Email" value={student.email || 'Not provided'} />
        <InfoRow label="Class / Division" value={student.className} />
        <InfoRow label="Department" value={student.department} />
        <InfoRow label="Year" value={student.year} />
        <InfoRow label="Registered On" value={formatDate(student.createdAt)} />
      </View>

      {/* Attendance Stats Card */}
      <View style={styles.statsCard}>
        <Text style={styles.cardSectionTitle}>Attendance Summary</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.totalClasses || 0}</Text>
            <Text style={styles.statLabel}>Total Lectures</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.present }]}>
              {stats?.presentClasses || 0}
            </Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.absent }]}>
              {stats?.absentClasses || 0}
            </Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>
              {stats?.percentage !== undefined ? `${stats.percentage}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>Rate</Text>
          </View>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Administrative Controls</Text>

        {isBiometricEnrolled && (
          <CustomButton
            title="REVOKE BIOMETRIC FACE TEMPLATE"
            onPress={handleRevokeBiometrics}
            variant="outline"
            style={styles.revokeBtn}
          />
        )}

        <CustomButton
          title="DELETE STUDENT RECORD"
          onPress={handleDelete}
          variant="outline"
          style={styles.deleteBtn}
        />
      </View>

      {/* Edit Student Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Edit Student Details</Text>
              <Text style={styles.modalSubtitle}>Update canonical student profile without re-enrollment</Text>

              <CustomInput
                label="First Name *"
                value={editForm.firstName}
                onChangeText={(t) => setEditForm((p) => ({ ...p, firstName: t }))}
              />
              <CustomInput
                label="Last Name *"
                value={editForm.lastName}
                onChangeText={(t) => setEditForm((p) => ({ ...p, lastName: t }))}
              />
              <CustomInput
                label="Email *"
                value={editForm.email}
                onChangeText={(t) => setEditForm((p) => ({ ...p, email: t }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <CustomInput
                label="Class / Division *"
                value={editForm.className}
                onChangeText={(t) => setEditForm((p) => ({ ...p, className: t }))}
              />
              <CustomInput
                label="Department *"
                value={editForm.department}
                onChangeText={(t) => setEditForm((p) => ({ ...p, department: t }))}
              />
              <CustomInput
                label="Year *"
                value={editForm.year}
                onChangeText={(t) => setEditForm((p) => ({ ...p, year: t }))}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={editLoading}
                >
                  <Text style={styles.modalSaveText}>
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOWS.small,
  },
  avatarContainer: {
    marginBottom: 14,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
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
    fontSize: 36,
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
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeText: {
    color: '#15803d',
  },
  inactiveText: {
    color: '#b91c1c',
  },
  bioBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bioEnrolled: {
    backgroundColor: '#eff6ff',
  },
  bioMissing: {
    backgroundColor: '#fef3c7',
  },
  bioText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bioEnrolledText: {
    color: '#1d4ed8',
  },
  bioMissingText: {
    color: '#b45309',
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  actionBtnEdit: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnEditText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnToggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDeactivate: {
    backgroundColor: '#fee2e2',
  },
  btnActivate: {
    backgroundColor: '#dcfce7',
  },
  actionBtnToggleText: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.text,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dangerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    ...SHADOWS.small,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 12,
  },
  revokeBtn: {
    marginBottom: 10,
    borderColor: '#f59e0b',
  },
  deleteBtn: {
    borderColor: COLORS.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    maxHeight: '85%',
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveText: {
    fontWeight: '700',
    color: '#fff',
  },
});
