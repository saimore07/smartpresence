import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../constants/config';
import { getAttendanceStats } from '../../services/attendanceService';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async (isInitial = false) => {
    try {
      const response = await getAttendanceStats();
      if (response && response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      // Non-blocking; keep existing stats if available
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStats(false);
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const assignedSubjects =
    (stats?.assignedSubjects && stats.assignedSubjects.length > 0)
      ? stats.assignedSubjects
      : (user?.assignedSubjects || []);

  const menuItems = [
    {
      icon: '📸',
      title: 'Take Attendance',
      subtitle: 'Start session with AI facial recognition',
      route: '/faculty/take-attendance',
      color: '#fbbc04',
    },
    {
      icon: '📊',
      title: 'Attendance History',
      subtitle: 'View past sessions for your assigned subjects',
      route: '/faculty/attendance-history',
      color: '#ea4335',
    },
    {
      icon: '👥',
      title: 'Class Roster & Students',
      subtitle: 'View centrally enrolled student profiles',
      route: '/faculty/students',
      color: '#34a853',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'Faculty'}</Text>
            <Text style={styles.departmentText}>{user?.department || 'Faculty Member'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Assigned Subjects Banner */}
        <View style={styles.subjectsBanner}>
          <Text style={styles.subjectsBannerTitle}>📚 Your Assigned Subjects:</Text>
          {assignedSubjects.length > 0 ? (
            <View style={styles.subjectChipsRow}>
              {assignedSubjects.map((sub, i) => (
                <View key={i} style={styles.subjectBadge}>
                  <Text style={styles.subjectBadgeText}>{sub}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noSubjectsWarning}>
              No subjects assigned yet. Please contact the Administrator.
            </Text>
          )}
        </View>

        {/* Stats Cards Scoped to Faculty Subjects */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#e8f0fe' }]}>
            <Text style={[styles.statNumber, { color: '#1a73e8' }]}>
              {stats?.totalStudents ?? 0}
            </Text>
            <Text style={styles.statLabel}>Roster Students</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#e6f4ea' }]}>
            <Text style={[styles.statNumber, { color: '#1e8e3e' }]}>
              {stats?.todaySessions ?? 0}
            </Text>
            <Text style={styles.statLabel}>Today's Sessions</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#fef7e0' }]}>
            <Text style={[styles.statNumber, { color: '#f9ab00' }]}>
              {stats?.averageAttendance ? `${stats.averageAttendance}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>Avg Attendance</Text>
          </View>
        </View>

        {stats && stats.todaySessions === 0 && (
          <Text style={styles.noAttendanceNote}>
            No attendance recorded today for your subjects.
          </Text>
        )}
      </View>

      {/* Menu */}
      <ScrollView
        style={styles.menuContainer}
        contentContainerStyle={styles.menuContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <Text style={styles.sectionTitle}>Lecture & Roster Actions</Text>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuCard}
            onPress={() => router.push(item.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
              <Text style={styles.menuIconText}>{item.icon}</Text>
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Centralized Enrollment Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeIcon}>ℹ️</Text>
          <View style={styles.noticeTextWrapper}>
            <Text style={styles.noticeTitle}>Centralized Student Records</Text>
            <Text style={styles.noticeBody}>
              Students are centrally registered and managed by the Administrator. You can mark attendance directly without enrolling students separately.
            </Text>
          </View>
        </View>
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
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  departmentText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  logoutBtn: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '600',
  },
  subjectsBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subjectsBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  subjectChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  noSubjectsWarning: {
    fontSize: 11,
    color: '#dc2626',
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  noAttendanceNote: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    padding: 20,
    paddingBottom: 32,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  menuIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconText: {
    fontSize: 24,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  menuArrow: {
    fontSize: 24,
    color: COLORS.textLight,
    paddingLeft: 8,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  noticeIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  noticeTextWrapper: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 3,
  },
  noticeBody: {
    fontSize: 11,
    color: '#1e40af',
    lineHeight: 16,
  },
});
