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
      // Re-fetch in background without unmounting dashboard tree
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

  const menuItems = [
    {
      icon: '👤',
      title: 'Enroll Student',
      subtitle: 'Add a new student to the system',
      route: '/faculty/enroll-student',
      color: '#4285f4',
    },
    {
      icon: '👥',
      title: 'Students',
      subtitle: 'View and manage enrolled students',
      route: '/faculty/students',
      color: '#34a853',
    },
    {
      icon: '📸',
      title: 'Take Attendance',
      subtitle: 'Start an attendance session',
      route: '/faculty/take-attendance',
      color: '#fbbc04',
    },
    {
      icon: '📊',
      title: 'Attendance History',
      subtitle: 'View past attendance records',
      route: '/faculty/attendance-history',
      color: '#ea4335',
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
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#e8f0fe' }]}>
            <Text style={[styles.statNumber, { color: '#1a73e8' }]}>
              {stats?.totalStudents ?? 0}
            </Text>
            <Text style={styles.statLabel}>Total Students</Text>
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
            No attendance recorded today.
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
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  noAttendanceNote: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 12,
    fontStyle: 'italic',
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
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  menuArrow: {
    fontSize: 24,
    color: COLORS.textLight,
    paddingLeft: 8,
  },
});
