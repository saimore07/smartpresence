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
import { getAdminStats } from '../../services/adminService';

export default function AdminDashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async (isInitial = false) => {
    try {
      const response = await getAdminStats();
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
    Alert.alert('Logout', 'Are you sure you want to log out of Administrator Portal?', [
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
      title: 'Centralized Student Enrollment',
      subtitle: 'Enroll student once with face biometric templates',
      route: '/admin/enroll-student',
      color: '#1a73e8',
    },
    {
      icon: '👥',
      title: 'Student Directory & Management',
      subtitle: 'View, search, edit details, and toggle active status',
      route: '/admin/students',
      color: '#34a853',
    },
    {
      icon: '👨‍🏫',
      title: 'Faculty Management',
      subtitle: 'Register faculty, assign subjects, manage accounts',
      route: '/admin/faculty',
      color: '#8430ce',
    },
    {
      icon: '📚',
      title: 'Subject Allocation',
      subtitle: 'Create subjects and assign teaching faculty',
      route: '/admin/subjects',
      color: '#f29900',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>🛡️ SYSTEM ADMIN</Text>
              </View>
            </View>
            <Text style={styles.greeting}>Administrator Portal</Text>
            <Text style={styles.userName}>{user?.name || 'Administrator'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#e8f0fe' }]}>
            <Text style={[styles.statNumber, { color: '#1a73e8' }]}>
              {stats?.totalStudents ?? 0}
            </Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#f3e8fd' }]}>
            <Text style={[styles.statNumber, { color: '#8430ce' }]}>
              {stats?.totalFaculty ?? 0}
            </Text>
            <Text style={styles.statLabel}>Faculty</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#fef7e0' }]}>
            <Text style={[styles.statNumber, { color: '#b06000' }]}>
              {stats?.totalSubjects ?? 0}
            </Text>
            <Text style={styles.statLabel}>Subjects</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#e6f4ea' }]}>
            <Text style={[styles.statNumber, { color: '#1e8e3e' }]}>
              {stats?.totalSessions ?? 0}
            </Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
        </View>
      </View>

      {/* Menu Cards */}
      <ScrollView
        style={styles.menuContainer}
        contentContainerStyle={styles.menuContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        <Text style={styles.sectionTitle}>Administrative Functions</Text>

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
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  badgeRow: {
    marginBottom: 4,
  },
  adminBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.5,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
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
    lineHeight: 16,
  },
  menuArrow: {
    fontSize: 24,
    color: COLORS.textLight,
    paddingLeft: 8,
  },
});
