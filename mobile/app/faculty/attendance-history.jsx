import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import AttendanceCard from '../../components/AttendanceCard';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import CustomButton from '../../components/CustomButton';
import { COLORS, SHADOWS, API_BASE_URL } from '../../constants/config';
import { getAttendance } from '../../services/attendanceService';
import { formatDate } from '../../utils/attendance';
import { exportAttendanceAsCsv } from '../../utils/csvExport';

export default function AttendanceHistoryScreen() {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [exportingSession, setExportingSession] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const fetchRecords = async () => {
    try {
      const response = await getAttendance();
      if (response.success && response.records) {
        setRecords(response.records);
        applyFilter(response.records, searchQuery);
      } else {
        setRecords([]);
        setFilteredRecords([]);
      }
    } catch (error) {
      setRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  const applyFilter = (list, query) => {
    if (!query.trim()) {
      setFilteredRecords(list);
      return;
    }
    const q = query.toLowerCase();
    const filtered = list.filter(
      (r) =>
        (r.subject && r.subject.toLowerCase().includes(q)) ||
        (r.className && r.className.toLowerCase().includes(q)) ||
        (r.date && r.date.includes(q))
    );
    setFilteredRecords(filtered);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    applyFilter(records, text);
  };

  const stats = React.useMemo(() => {
    let totalSessions = records.length;
    let totalPresent = 0;
    let totalStudentRecords = 0;

    records.forEach((rec) => {
      if (rec.students && Array.isArray(rec.students)) {
        rec.students.forEach((s) => {
          totalStudentRecords++;
          if (s.status === 'present') totalPresent++;
        });
      }
    });

    const overallPercentage =
      totalStudentRecords > 0
        ? ((totalPresent / totalStudentRecords) * 100).toFixed(1)
        : '0';

    return { totalSessions, totalPresent, overallPercentage };
  }, [records]);

  const handleSelectRecord = React.useCallback((rec) => {
    setSelectedRecord(rec);
  }, []);

  const handleExportSessionCsv = async () => {
    if (!selectedRecord) return;
    setExportingSession(true);
    try {
      await exportAttendanceAsCsv(selectedRecord);
    } catch (err) {
      Alert.alert('Export Failed', err.message || 'Unable to export attendance CSV.');
    } finally {
      setExportingSession(false);
    }
  };

  const handleExportAllCsv = async () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      Alert.alert('No Records', 'There are no attendance records to export.');
      return;
    }
    setExportingAll(true);
    try {
      const filename = searchQuery.trim()
        ? `attendance_${searchQuery.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
        : `attendance_history_${new Date().toISOString().split('T')[0]}.csv`;
      await exportAttendanceAsCsv(filteredRecords, filename);
    } catch (err) {
      Alert.alert('Export Failed', err.message || 'Unable to export attendance CSV.');
    } finally {
      setExportingAll(false);
    }
  };

  const renderAttendanceItem = React.useCallback(
    ({ item }) => <AttendanceCard record={item} onPress={handleSelectRecord} />,
    [handleSelectRecord]
  );

  const keyExtractor = React.useCallback((item) => item._id, []);

  if (loading && records.length === 0) {
    return <Loading message="Loading attendance history..." />;
  }

  return (
    <View style={styles.container}>
      {/* Top Stats Overview */}
      <View style={styles.statsBanner}>
        <View style={styles.statCol}>
          <Text style={styles.statVal}>{stats.totalSessions}</Text>
          <Text style={styles.statLbl}>Sessions</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={[styles.statVal, { color: COLORS.success }]}>{stats.totalPresent}</Text>
          <Text style={styles.statLbl}>Total Present</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={[styles.statVal, { color: COLORS.primary }]}>
            {stats.totalSessions > 0 ? `${stats.overallPercentage}%` : '—'}
          </Text>
          <Text style={styles.statLbl}>Avg Attendance</Text>
        </View>
      </View>

      {/* Search & Export Bar */}
      <View style={styles.actionRow}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by subject, class, date..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.exportAllBtn, exportingAll && { opacity: 0.6 }]}
          onPress={handleExportAllCsv}
          disabled={exportingAll}
          activeOpacity={0.7}
        >
          <Text style={styles.exportAllIcon}>📥</Text>
          <Text style={styles.exportAllText}>{exportingAll ? '...' : 'Export'}</Text>
        </TouchableOpacity>
      </View>

      {/* Attendance List */}
      <FlatList
        data={filteredRecords}
        keyExtractor={keyExtractor}
        renderItem={renderAttendanceItem}
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
        ListEmptyComponent={
          <EmptyState
            icon="📊"
            title="No Attendance"
            message="No attendance records available."
          />
        }
      />

      {/* Detailed Attendance Modal */}
      <Modal
        visible={!!selectedRecord}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedRecord && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalSubject}>{selectedRecord.subject}</Text>
                    <Text style={styles.modalMeta}>
                      Class: {selectedRecord.className} • Date: {formatDate(selectedRecord.date)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedRecord(null)}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Classroom Image if recorded */}
                {selectedRecord.capturedImageUrl && (
                  <View style={styles.modalImageContainer}>
                    <Image
                      source={{
                        uri: `${API_BASE_URL.replace('/api', '')}${selectedRecord.capturedImageUrl}`,
                      }}
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.imageCaption}>Classroom Photograph</Text>
                  </View>
                )}

                {/* Summary Pill */}
                <View style={styles.modalSummaryPill}>
                  <Text style={styles.modalSummaryText}>
                    Present:{' '}
                    {
                      selectedRecord.students.filter((s) => s.status === 'present').length
                    }{' '}
                    | Absent:{' '}
                    {
                      selectedRecord.students.filter((s) => s.status === 'absent').length
                    }{' '}
                    | Total: {selectedRecord.students.length}
                  </Text>
                </View>

                {/* Student Attendance List */}
                <ScrollView style={styles.modalRoster}>
                  {selectedRecord.students.map((entry, idx) => {
                    const studentObj = entry.studentId || {};
                    const isPresent = entry.status === 'present';
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.rosterRow,
                          isPresent ? styles.rosterRowPresent : styles.rosterRowAbsent,
                        ]}
                      >
                        <View style={styles.rosterInfo}>
                          <Text style={styles.rosterName}>
                            {studentObj.name || `Student (${studentObj.rollNumber || '—'})`}
                          </Text>
                          <Text style={styles.rosterSub}>
                            Roll: {studentObj.rollNumber || '—'} • ID: {studentObj.studentId || '—'}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.rosterBadge,
                            isPresent ? styles.rosterBadgePresent : styles.rosterBadgeAbsent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.rosterBadgeText,
                              isPresent ? styles.textPresent : styles.textAbsent,
                            ]}
                          >
                            {isPresent ? '✓ Present' : '✗ Absent'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <CustomButton
                  title={exportingSession ? 'Exporting CSV...' : '📥 Export Attendance CSV'}
                  onPress={handleExportSessionCsv}
                  loading={exportingSession}
                  style={styles.modalExportBtn}
                />

                <CustomButton
                  title="Close"
                  onPress={() => setSelectedRecord(null)}
                  variant="secondary"
                  style={styles.modalDoneBtn}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLbl: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  exportAllIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  exportAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  clearBtn: {
    fontSize: 14,
    color: COLORS.textLight,
    paddingHorizontal: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalSubject: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalImageContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  imageCaption: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  modalSummaryPill: {
    backgroundColor: '#e8f0fe',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  modalSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalRoster: {
    maxHeight: 280,
    marginBottom: 16,
  },
  rosterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
  },
  rosterRowPresent: {
    backgroundColor: '#f6fbf7',
    borderColor: '#ceead6',
  },
  rosterRowAbsent: {
    backgroundColor: '#fdf7f6',
    borderColor: '#fad2cf',
  },
  rosterInfo: {
    flex: 1,
  },
  rosterName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  rosterSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rosterBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rosterBadgePresent: {
    backgroundColor: '#e6f4ea',
  },
  rosterBadgeAbsent: {
    backgroundColor: '#fce8e6',
  },
  rosterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textPresent: {
    color: '#137333',
  },
  textAbsent: {
    color: '#c5221f',
  },
  modalExportBtn: {
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: '#1b8045',
  },
  modalDoneBtn: {
    marginTop: 4,
  },
});
