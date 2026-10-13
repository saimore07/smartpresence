import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import CustomButton from '../../components/CustomButton';
import { COLORS, SHADOWS } from '../../constants/config';
import {
  getStudentAttendanceSummary,
  getStudentAttendanceHistory,
  getStudentImageUrl,
} from '../../services/studentService';
import { formatDate } from '../../utils/attendance';

export default function StudentDashboardScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'history'

  const loadData = async () => {
    try {
      setError(null);
      const [summaryRes, historyRes] = await Promise.all([
        getStudentAttendanceSummary(),
        getStudentAttendanceHistory({ limit: 20 }),
      ]);

      if (summaryRes.success) {
        setSummaryData(summaryRes);
      } else {
        throw new Error(summaryRes.message || 'Failed to load attendance summary.');
      }

      if (historyRes.success && historyRes.history) {
        setHistoryData(historyRes.history);
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to attendance server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your student account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  if (loading) {
    return <Loading message="Loading student attendance dashboard..." />;
  }

  const student = summaryData?.student || user || {};
  const overall = summaryData?.overall || { totalClasses: 0, attendedClasses: 0, absentClasses: 0, percentage: 0 };
  const subjects = summaryData?.subjects || [];
  const imageUrl = getStudentImageUrl(student.faceImageUrl);

  // Status helper based on 75% attendance threshold standard
  const getAttendanceStatus = (pct) => {
    if (pct >= 75) return { label: 'Good Standing', color: COLORS.present, bg: '#e6f4ea' };
    if (pct >= 60) return { label: 'Attendance Warning', color: '#b06000', bg: '#fef7e0' };
    return { label: 'Critical Shortage', color: COLORS.error, bg: '#fce8e6' };
  };

  const overallStatus = getAttendanceStatus(overall.percentage);

  return (
    <View style={styles.container}>
      {/* Top Profile Header */}
      <View style={styles.header}>
        <View style={styles.headerProfileRow}>
          <View style={styles.avatarContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {student.firstName
                    ? student.firstName.charAt(0).toUpperCase()
                    : student.name
                    ? student.name.charAt(0).toUpperCase()
                    : 'S'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.headerDetails}>
            <Text style={styles.studentName} numberOfLines={1}>
              {student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'}
            </Text>
            <Text style={styles.studentEmail} numberOfLines={1}>
              {student.email}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Roll: {student.rollNumber || 'N/A'}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Class: {student.className || 'N/A'}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* View Switcher Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'summary' && styles.tabItemActive]}
            onPress={() => setActiveTab('summary')}
          >
            <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>
              📊 Subject Breakdown
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              📜 Session History ({historyData.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Error Banner */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Failed to Load Statistics</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <CustomButton title="Retry" onPress={loadData} style={styles.retryBtn} />
          </View>
        ) : null}

        {activeTab === 'summary' ? (
          <>
            {/* Overall Attendance Summary Card */}
            <View style={styles.overallCard}>
              <View style={styles.overallTopRow}>
                <View>
                  <Text style={styles.overallCardTitle}>Overall Attendance</Text>
                  <Text style={styles.overallSubtitle}>
                    All finalized subjects in {student.className || 'your class'}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: overallStatus.bg }]}>
                  <Text style={[styles.statusPillText, { color: overallStatus.color }]}>
                    {overallStatus.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metricsContainer}>
                <View style={styles.percentageBox}>
                  <Text style={[styles.percentageNumber, { color: overallStatus.color }]}>
                    {overall.percentage.toFixed(1)}%
                  </Text>
                  <Text style={styles.percentageCaption}>Weighted Aggregate</Text>
                </View>

                <View style={styles.metricsDivider} />

                <View style={styles.countsContainer}>
                  <View style={styles.countItem}>
                    <Text style={styles.countNumber}>{overall.totalClasses}</Text>
                    <Text style={styles.countLabel}>Total Sessions</Text>
                  </View>
                  <View style={styles.countItem}>
                    <Text style={[styles.countNumber, { color: COLORS.present }]}>
                      {overall.attendedClasses}
                    </Text>
                    <Text style={styles.countLabel}>Attended</Text>
                  </View>
                  <View style={styles.countItem}>
                    <Text style={[styles.countNumber, { color: COLORS.error }]}>
                      {overall.absentClasses}
                    </Text>
                    <Text style={styles.countLabel}>Absent</Text>
                  </View>
                </View>
              </View>

              {/* Visual Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, overall.percentage))}%`,
                      backgroundColor: overallStatus.color,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Subject-Wise List Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Subject-Wise Attendance</Text>
              <Text style={styles.sectionCount}>{subjects.length} Subjects</Text>
            </View>

            {subjects.length === 0 ? (
              <EmptyState
                icon="📚"
                title="No Attendance Sessions Yet"
                message={`No lecture attendance sessions have been conducted for class ${student.className || ''} yet.`}
              />
            ) : (
              subjects.map((item) => {
                const itemStatus = getAttendanceStatus(item.percentage);
                return (
                  <View key={item.subject} style={styles.subjectCard}>
                    <View style={styles.subjectTopRow}>
                      <View style={styles.subjectInfo}>
                        <Text style={styles.subjectName}>{item.subject}</Text>
                        <Text style={styles.subjectMeta}>
                          Attended {item.attended} of {item.total} eligible sessions
                        </Text>
                      </View>
                      <View style={styles.subjectPctBadge}>
                        <Text style={[styles.subjectPctNumber, { color: itemStatus.color }]}>
                          {item.percentage.toFixed(1)}%
                        </Text>
                        <Text style={[styles.subjectPctLabel, { color: itemStatus.color }]}>
                          {itemStatus.label}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.subjectProgressTrack}>
                      <View
                        style={[
                          styles.subjectProgressFill,
                          {
                            width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                            backgroundColor: itemStatus.color,
                          },
                        ]}
                      />
                    </View>

                    {/* Attendance Fraction Footer */}
                    <View style={styles.subjectFooterRow}>
                      <Text style={styles.subjectRatioText}>
                        Present: <Text style={{ color: COLORS.present, fontWeight: '700' }}>{item.attended}</Text>
                        {'  '}•{'  '}
                        Absent: <Text style={{ color: COLORS.error, fontWeight: '700' }}>{item.absent}</Text>
                      </Text>
                      <Text style={styles.subjectDenominatorText}>
                        {item.total > 0 ? `${item.total} Total Sessions Held` : 'No sessions held'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* Session History Tab */
          <View style={styles.historyContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Lecture Session History</Text>
              <Text style={styles.sectionCount}>{historyData.length} Recent Records</Text>
            </View>

            {historyData.length === 0 ? (
              <EmptyState
                icon="📜"
                title="No Session Records"
                message="No lecture sessions have been recorded for your roster."
              />
            ) : (
              historyData.map((item) => {
                const isPresent = item.status === 'present';
                return (
                  <View key={item._id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historySubject}>{item.subject}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: isPresent ? '#e6f4ea' : '#fce8e6' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: isPresent ? COLORS.present : COLORS.error },
                          ]}
                        >
                          {isPresent ? '✓ PRESENT' : '✗ ABSENT'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyMetaRow}>
                      <Text style={styles.historyMetaItem}>📅 {formatDate(item.date)}</Text>
                      {item.startTime && item.endTime ? (
                        <Text style={styles.historyMetaItem}>
                          🕒 {item.startTime} – {item.endTime}
                        </Text>
                      ) : null}
                    </View>

                    {item.faculty?.name ? (
                      <Text style={styles.historyFaculty}>Faculty: Prof. {item.faculty.name}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...SHADOWS.small,
  },
  headerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#cbd5e1',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  logoutButton: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  overallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  overallTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  overallCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  overallSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  percentageBox: {
    alignItems: 'center',
    paddingRight: 16,
  },
  percentageNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  percentageCaption: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  metricsDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#e2e8f0',
    marginRight: 16,
  },
  countsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countItem: {
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  countLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  subjectCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  subjectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subjectInfo: {
    flex: 1,
    marginRight: 12,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
  },
  subjectMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  subjectPctBadge: {
    alignItems: 'flex-end',
  },
  subjectPctNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  subjectPctLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  subjectProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    marginBottom: 10,
  },
  subjectProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  subjectFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectRatioText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  subjectDenominatorText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  historyContainer: {
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historySubject: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  historyMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  historyMetaItem: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  historyFaculty: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: COLORS.errorLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 12,
    color: COLORS.error,
    marginBottom: 12,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
