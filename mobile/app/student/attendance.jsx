import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS, SHADOWS } from '../../constants/config';
import { getStudentAttendance } from '../../services/attendanceService';
import { formatDate } from '../../utils/attendance';

export default function StudentAttendanceScreen() {
  const params = useLocalSearchParams();
  const { studentId, studentName, rollNumber } = params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);

  const loadData = async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      const response = await getStudentAttendance(studentId);
      if (response.success) {
        setStats(response.stats);
        setRecords(response.attendance || []);
      }
    } catch {
      setStats(null);
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return <Loading message="Loading attendance records..." />;
  }

  return (
    <View style={styles.container}>
      {/* Student Banner */}
      <View style={styles.studentBanner}>
        <Text style={styles.studentName}>{studentName || 'Student Attendance'}</Text>
        {rollNumber ? (
          <Text style={styles.rollBadge}>Roll No: {rollNumber}</Text>
        ) : null}
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#e8f0fe' }]}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>
              {stats?.totalClasses ?? 0}
            </Text>
            <Text style={styles.statLabel}>Total Classes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#e6f4ea' }]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              {stats?.presentClasses ?? 0}
            </Text>
            <Text style={styles.statLabel}>Classes Attended</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#fce8e6' }]}>
            <Text style={[styles.statValue, { color: COLORS.error }]}>
              {stats?.absentClasses ?? 0}
            </Text>
            <Text style={styles.statLabel}>Classes Absent</Text>
          </View>
        </View>

        {/* Big Percentage Card */}
        <View style={styles.percentageCard}>
          <Text style={styles.percentageLabel}>Overall Attendance Percentage</Text>
          <Text
            style={[
              styles.percentageValue,
              {
                color:
                  (stats?.percentage ?? 0) >= 75
                    ? COLORS.success
                    : (stats?.percentage ?? 0) >= 60
                    ? '#f9ab00'
                    : COLORS.error,
              },
            ]}
          >
            {stats && stats.totalClasses > 0 ? `${stats.percentage}%` : '0%'}
          </Text>
          <Text style={styles.formulaNote}>
            Formula: present classes / total classes × 100
          </Text>
        </View>
      </View>

      {/* History Records List */}
      <FlatList
        data={records}
        keyExtractor={(item, index) => item._id || String(index)}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        renderItem={({ item }) => {
          const isPresent = item.status === 'present';
          return (
            <View
              style={[
                styles.recordCard,
                isPresent ? styles.recordPresent : styles.recordAbsent,
              ]}
            >
              <View style={styles.recordLeft}>
                <Text style={styles.subjectText}>{item.subject}</Text>
                <Text style={styles.metaText}>
                  {item.className} • {formatDate(item.date)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isPresent ? styles.badgePresent : styles.badgeAbsent,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isPresent ? styles.textPresent : styles.textAbsent,
                  ]}
                >
                  {isPresent ? '✓ Present' : '✗ Absent'}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="📊"
            title="No Attendance"
            message="No attendance records available."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  studentBanner: {
    backgroundColor: COLORS.surface,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    ...SHADOWS.small,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  rollBadge: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statsContainer: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  percentageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  percentageLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  percentageValue: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 4,
  },
  formulaNote: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  recordPresent: {
    borderColor: '#ceead6',
  },
  recordAbsent: {
    borderColor: '#fad2cf',
  },
  recordLeft: {
    flex: 1,
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgePresent: {
    backgroundColor: '#e6f4ea',
  },
  badgeAbsent: {
    backgroundColor: '#fce8e6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textPresent: {
    color: '#137333',
  },
  textAbsent: {
    color: '#c5221f',
  },
});
