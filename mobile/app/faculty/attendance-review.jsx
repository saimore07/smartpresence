import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import CustomButton from '../../components/CustomButton';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import { COLORS, SHADOWS, API_BASE_URL } from '../../constants/config';
import { formatDate } from '../../utils/attendance';
import {
  getAttendanceSession,
  clearAttendanceSession,
} from '../../utils/attendanceSession';
import { createAttendance } from '../../services/attendanceService';
import { RECOGNITION_THRESHOLDS } from '../../services/faceRecognitionService';
import { exportAttendanceAsCsv } from '../../utils/csvExport';

const AttendanceReviewRow = React.memo(({ student, onToggle }) => {
  const isPresent = student.status === 'present';
  const photoUrl = student.faceImageUrl
    ? `${API_BASE_URL.replace('/api', '')}${student.faceImageUrl}`
    : null;

  const matchPercentage = Math.round((student.confidence || 0) * 100);

  return (
    <TouchableOpacity
      style={[
        styles.studentCard,
        isPresent ? styles.studentCardPresent : styles.studentCardAbsent,
      ]}
      onPress={() => onToggle(student._id)}
      activeOpacity={0.7}
    >
      {/* Student Photo or Avatar */}
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.studentAvatar} />
      ) : (
        <View
          style={[
            styles.avatarFallback,
            { backgroundColor: isPresent ? '#ceead6' : '#fad2cf' },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: isPresent ? '#137333' : '#c5221f' },
            ]}
          >
            {student.name ? student.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
      )}

      {/* Details & AI Provenance */}
      <View style={styles.studentInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.studentName}>{student.name}</Text>
        </View>
        <Text style={styles.studentDetails}>
          Roll: {student.rollNumber} • ID: {student.studentId}
        </Text>

        {/* AI Recognition Badge */}
        {student.confidence >= RECOGNITION_THRESHOLDS.ACCEPTANCE_THRESHOLD ? (
          <View style={styles.aiMatchBadge}>
            <Text style={styles.aiMatchBadgeText}>
              ✓ AI Match {matchPercentage}% {student.photoIndex !== undefined ? `(Row ${student.photoIndex + 1})` : ''}
            </Text>
          </View>
        ) : student.isUncertain ? (
          <View style={styles.aiUncertainBadge}>
            <Text style={styles.aiUncertainBadgeText}>
              ⚠️ Review (Sim: {Math.round(student.uncertainScore * 100)}%)
            </Text>
          </View>
        ) : isPresent ? (
          <View style={styles.aiManualBadge}>
            <Text style={styles.aiManualBadgeText}>Manual Verified</Text>
          </View>
        ) : (
          <View style={styles.aiAbsentBadge}>
            <Text style={styles.aiAbsentBadgeText}>Not detected in photos</Text>
          </View>
        )}
      </View>

      {/* Present / Absent Status Pill */}
      <View
        style={[
          styles.statusPill,
          isPresent ? styles.statusPillPresent : styles.statusPillAbsent,
        ]}
      >
        <Text
          style={[
            styles.statusPillIcon,
            isPresent ? styles.textPresent : styles.textAbsent,
          ]}
        >
          {isPresent ? '✓' : '✗'}
        </Text>
        <Text
          style={[
            styles.statusPillText,
            isPresent ? styles.textPresent : styles.textAbsent,
          ]}
        >
          {isPresent ? 'Present' : 'Absent'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function AttendanceReviewScreen() {
  const [session, setSession] = useState(null);
  const [studentList, setStudentList] = useState([]);
  const [initialAiProposedList, setInitialAiProposedList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'present' | 'absent' | 'uncertain'

  useEffect(() => {
    const active = getAttendanceSession();
    if (!active || (!active.proposedPresent && !active.enrolledStudents)) {
      Alert.alert('Session Expired', 'No active attendance session found.', [
        { text: 'OK', onPress: () => router.replace('/faculty/take-attendance') },
      ]);
      return;
    }

    setSession(active);

    // Merge proposed present and proposed absent
    const presentList = (active.proposedPresent || []).map((p) => ({
      ...p,
      status: 'present',
      confidence: p.confidence || 0.9,
      isAutoMatched: true,
    }));

    const uncertainIdMap = new Map();
    (active.uncertainMatches || []).forEach((u) => {
      if (u.candidate_student_id) {
        uncertainIdMap.set(u.candidate_student_id, u.similarity_score);
      }
    });

    const absentList = (active.proposedAbsent || []).map((a) => ({
      ...a,
      status: 'absent',
      confidence: 0,
      isUncertain: uncertainIdMap.has(a.studentId),
      uncertainScore: uncertainIdMap.get(a.studentId) || 0,
    }));

    // If backwards compatible legacy session format
    let merged = [...presentList, ...absentList];
    if (merged.length === 0 && active.enrolledStudents) {
      merged = active.enrolledStudents.map((s, idx) => ({
        ...s,
        status: idx < (active.faceCount || 0) ? 'present' : 'absent',
        confidence: idx < (active.faceCount || 0) ? 0.85 : 0,
      }));
    }

    // Sort by roll number
    merged.sort((a, b) =>
      (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true })
    );

    setStudentList(merged);
    setInitialAiProposedList(JSON.parse(JSON.stringify(merged)));
  }, []);

  const toggleStudentStatus = useCallback((id) => {
    setStudentList((prev) =>
      prev.map((s) => {
        if (s._id === id) {
          const nextStatus = s.status === 'present' ? 'absent' : 'present';
          return {
            ...s,
            status: nextStatus,
          };
        }
        return s;
      })
    );
  }, []);

  const markAll = (status) => {
    setStudentList((prev) =>
      prev.map((s) => ({
        ...s,
        status,
      }))
    );
  };

  const resetToAiProposal = () => {
    setStudentList(JSON.parse(JSON.stringify(initialAiProposedList)));
  };

  const presentCount = useMemo(
    () => studentList.filter((s) => s.status === 'present').length,
    [studentList]
  );
  const absentCount = useMemo(
    () => studentList.filter((s) => s.status === 'absent').length,
    [studentList]
  );
  const uncertainCount = useMemo(
    () => studentList.filter((s) => s.isUncertain).length,
    [studentList]
  );
  const autoMatchedCount = useMemo(
    () => studentList.filter((s) => s.confidence >= RECOGNITION_THRESHOLDS.ACCEPTANCE_THRESHOLD).length,
    [studentList]
  );

  const filteredStudents = useMemo(() => {
    if (activeFilter === 'present') {
      return studentList.filter((s) => s.status === 'present');
    }
    if (activeFilter === 'absent') {
      return studentList.filter((s) => s.status === 'absent');
    }
    if (activeFilter === 'uncertain') {
      return studentList.filter((s) => s.isUncertain);
    }
    return studentList;
  }, [studentList, activeFilter]);

  const handleExportPreviewCsv = async () => {
    if (!session) return;
    setExporting(true);
    try {
      const recordObj = {
        className: session.className,
        subject: session.subject,
        date: session.date,
        createdAt: new Date().toISOString(),
        students: studentList.map((s) => ({
          studentId: {
            name: s.name,
            rollNumber: s.rollNumber,
            studentId: s.studentId,
            className: s.className || session.className,
            year: s.year,
          },
          status: s.status,
          markedAt: new Date().toISOString(),
        })),
      };
      await exportAttendanceAsCsv(recordObj);
    } catch (err) {
      Alert.alert('Export Error', err.message || 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!session) return;

    setSaving(true);

    try {
      const studentsPayload = studentList.map((s) => ({
        studentId: s._id,
        status: s.status,
        matchConfidence: s.confidence || (s.status === 'present' ? 1.0 : 0.0),
        detectionProvenance:
          s.status === 'present' && s.confidence >= RECOGNITION_THRESHOLDS.ACCEPTANCE_THRESHOLD
            ? 'auto_matched'
            : 'manual_faculty_verified',
      }));

      const payload = {
        className: session.className,
        subject: session.subject,
        date: session.date,
        capturedImageUrls: session.capturedImageUrls || [],
        capturedImageUrl:
          session.capturedImageUrls && session.capturedImageUrls.length > 0
            ? session.capturedImageUrls[0]
            : '',
        students: studentsPayload,
      };

      await createAttendance(payload, false);

      clearAttendanceSession();

      Alert.alert(
        'Attendance Finalized',
        `Attendance successfully saved to database for ${session.subject} (${session.className}).\n\n✓ Present: ${presentCount}\n✗ Absent: ${absentCount}\n⚡ AI Verified: ${autoMatchedCount}`,
        [
          {
            text: '📥 Export CSV',
            onPress: async () => {
              await handleExportPreviewCsv();
              router.replace('/faculty/attendance-history');
            },
          },
          {
            text: 'View History',
            onPress: () => router.replace('/faculty/attendance-history'),
          },
          {
            text: 'Dashboard',
            onPress: () => router.replace('/faculty/dashboard'),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Save Error',
        error.message || 'Unable to record attendance. Please verify network and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return <Loading message="Loading session review..." />;
  }

  const unknownFaceCount = session.unknownFaces ? session.unknownFaces.length : 0;
  const conflictCount = session.conflicts ? session.conflicts.length : 0;

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.sessionHeaderRow}>
          <View style={styles.sessionInfo}>
            <Text style={styles.subjectText}>{session.subject}</Text>
            <Text style={styles.metaText}>
              Class: {session.className} • Date: {formatDate(session.date)}
            </Text>
          </View>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeIcon}>⚡</Text>
            <Text style={styles.aiBadgeText}>
              {session.metrics?.totalPhotos || 1} Row Photos
            </Text>
          </View>
        </View>

        {/* Counter Summary */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#e6f4ea' }]}>
            <Text style={[styles.statNum, { color: '#137333' }]}>{presentCount}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#fce8e6' }]}>
            <Text style={[styles.statNum, { color: '#c5221f' }]}>{absentCount}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#e8f0fe' }]}>
            <Text style={[styles.statNum, { color: '#1a73e8' }]}>{autoMatchedCount}</Text>
            <Text style={styles.statLabel}>AI Matched</Text>
          </View>
          {uncertainCount > 0 && (
            <View style={[styles.statBox, { backgroundColor: '#fef7e0' }]}>
              <Text style={[styles.statNum, { color: '#b06000' }]}>{uncertainCount}</Text>
              <Text style={styles.statLabel}>Uncertain</Text>
            </View>
          )}
        </View>

        {/* Informational banners for Unknown Faces or Conflicts */}
        {unknownFaceCount > 0 && (
          <View style={styles.unknownBanner}>
            <Text style={styles.unknownBannerText}>
              ℹ️ {unknownFaceCount} unknown or unregistered face(s) detected in photographs.
            </Text>
          </View>
        )}
        {conflictCount > 0 && (
          <View style={[styles.unknownBanner, { backgroundColor: '#fce8e6', borderColor: '#fad2cf' }]}>
            <Text style={[styles.unknownBannerText, { color: '#c5221f' }]}>
              ⚠️ {conflictCount} potential duplicate detection resolved across classroom rows.
            </Text>
          </View>
        )}

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
              All ({studentList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'present' && styles.filterChipActive]}
            onPress={() => setActiveFilter('present')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'present' && styles.filterChipTextActive]}>
              Present ({presentCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'absent' && styles.filterChipActive]}
            onPress={() => setActiveFilter('absent')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'absent' && styles.filterChipTextActive]}>
              Absent ({absentCount})
            </Text>
          </TouchableOpacity>
          {uncertainCount > 0 && (
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'uncertain' && styles.filterChipActive]}
              onPress={() => setActiveFilter('uncertain')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'uncertain' && styles.filterChipTextActive]}>
                Uncertain ({uncertainCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Bulk Action Controls */}
        <View style={styles.bulkRow}>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => markAll('present')}>
            <Text style={styles.bulkBtnText}>✓ All Present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => markAll('absent')}>
            <Text style={styles.bulkBtnText}>✗ All Absent</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} onPress={resetToAiProposal}>
            <Text style={styles.bulkBtnText}>↺ Reset to AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Student List */}
      <FlatList
        data={filteredStudents}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <AttendanceReviewRow student={item} onToggle={toggleStudentStatus} />
        )}
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>
            Review & verify students • Tap row to toggle status:
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            icon="👥"
            title="No Students Match Filter"
            message="No students match the selected filter criteria."
          />
        }
      />

      {/* Confirmation Footer */}
      <View style={styles.footerContainer}>
        <View style={styles.footerButtonRow}>
          <TouchableOpacity
            style={[styles.exportPreviewBtn, exporting && { opacity: 0.6 }]}
            onPress={handleExportPreviewCsv}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <Text style={styles.exportPreviewIcon}>📥</Text>
            <Text style={styles.exportPreviewText}>{exporting ? '...' : 'CSV'}</Text>
          </TouchableOpacity>
          <CustomButton
            title={`CONFIRM (${presentCount} P / ${absentCount} A)`}
            onPress={handleConfirmAndSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBanner: {
    backgroundColor: COLORS.surface,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...SHADOWS.small,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 10,
  },
  subjectText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  aiBadgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  statNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  unknownBanner: {
    backgroundColor: '#fef7e0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fce8b2',
    marginBottom: 8,
  },
  unknownBannerText: {
    fontSize: 11,
    color: '#8c5b00',
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f3f4',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
    alignItems: 'center',
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    ...SHADOWS.small,
  },
  studentCardPresent: {
    borderLeftColor: COLORS.present,
  },
  studentCardAbsent: {
    borderLeftColor: COLORS.absent,
    opacity: 0.92,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  studentDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  aiMatchBadge: {
    backgroundColor: '#e6f4ea',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  aiMatchBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#137333',
  },
  aiUncertainBadge: {
    backgroundColor: '#fef7e0',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  aiUncertainBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#b06000',
  },
  aiManualBadge: {
    backgroundColor: '#e8f0fe',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  aiManualBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1a73e8',
  },
  aiAbsentBadge: {
    backgroundColor: '#f1f3f4',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  aiAbsentBadgeText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  statusPillPresent: {
    backgroundColor: '#e6f4ea',
  },
  statusPillAbsent: {
    backgroundColor: '#fce8e6',
  },
  statusPillIcon: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textPresent: {
    color: '#137333',
  },
  textAbsent: {
    color: '#c5221f',
  },
  footerContainer: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
    ...SHADOWS.medium,
  },
  footerButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f4ea',
    borderWidth: 1,
    borderColor: '#ceead6',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
  },
  exportPreviewIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  exportPreviewText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#137333',
  },
  saveBtn: {
    flex: 1,
  },
});
