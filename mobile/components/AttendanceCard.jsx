import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../constants/config';
import { formatDate } from '../utils/attendance';

const AttendanceCard = ({ record, onPress }) => {
  const presentCount = record.students
    ? record.students.filter((s) => s.status === 'present').length
    : 0;
  const absentCount = record.students
    ? record.students.filter((s) => s.status === 'absent').length
    : 0;
  const totalCount = record.students ? record.students.length : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(record)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.subject} numberOfLines={1}>
          {record.subject}
        </Text>
        <Text style={styles.date}>{formatDate(record.date)}</Text>
      </View>

      <Text style={styles.className}>{record.className}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.statText}>Present: {presentCount}</Text>
        </View>
        <View style={styles.statBadge}>
          <View style={[styles.dot, { backgroundColor: COLORS.error }]} />
          <Text style={styles.statText}>Absent: {absentCount}</Text>
        </View>
        <View style={styles.statBadge}>
          <Text style={styles.statText}>Total: {totalCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subject: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  date: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  className: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

export default React.memo(AttendanceCard);
