import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import CustomInput from '../../components/CustomInput';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS, SHADOWS } from '../../constants/config';
import { getStudents } from '../../services/studentService';
import { toggleStudentStatus } from '../../services/adminService';

export default function AdminStudentsScreen() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);

  const loadStudents = async (searchQuery = '', showFullLoading = false) => {
    if (showFullLoading) setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const response = await getStudents(params);
      if (response && response.success) {
        setStudents(response.students);
      }
    } catch (error) {
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStudents(search, students.length === 0);
    }, [search])
  );

  const handleSearch = (text) => {
    setSearch(text);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      loadStudents(text, false);
    }, 300);
  };

  const handleToggleStatus = (student) => {
    const action = student.isActive === false ? 'activate' : 'deactivate';
    Alert.alert(
      `${action === 'activate' ? 'Activate' : 'Deactivate'} Student`,
      `Are you sure you want to ${action} ${student.name}? ${
        action === 'deactivate' ? 'Historical attendance records will remain preserved.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'activate' ? 'Activate' : 'Deactivate',
          style: action === 'activate' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await toggleStudentStatus(student._id);
              if (res.success) {
                setStudents((prev) =>
                  prev.map((s) => (s._id === student._id ? { ...s, isActive: !s.isActive } : s))
                );
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to update student status.');
            }
          },
        },
      ]
    );
  };

  const handleStudentPress = (student) => {
    router.push({
      pathname: '/admin/student-details',
      params: { id: student._id },
    });
  };

  const renderStudentItem = ({ item }) => {
    const isEnrolled = item.faceEnrollmentStatus === 'enrolled' || !!item.faceTemplate;
    const isActive = item.isActive !== false;

    return (
      <TouchableOpacity
        style={[styles.studentCard, !isActive && styles.inactiveCard]}
        onPress={() => handleStudentPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.nameSection}>
            <Text style={styles.studentName}>{item.name}</Text>
            <Text style={styles.studentIdText}>
              Roll: {item.rollNumber} • ID: {item.studentId}
            </Text>
            <Text style={styles.emailText}>{item.email}</Text>
          </View>

          <TouchableOpacity
            style={[styles.statusBadge, isActive ? styles.activeBadge : styles.inactiveBadge]}
            onPress={() => handleToggleStatus(item)}
          >
            <Text style={[styles.statusBadgeText, isActive ? styles.activeBadgeText : styles.inactiveBadgeText]}>
              {isActive ? '● Active' : '○ Inactive'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.classBadge}>
            <Text style={styles.classBadgeText}>{item.className}</Text>
          </View>
          <Text style={styles.departmentText} numberOfLines={1}>
            {item.department}
          </Text>

          <View style={[styles.bioPill, isEnrolled ? styles.bioPillEnrolled : styles.bioPillMissing]}>
            <Text style={[styles.bioPillText, isEnrolled ? styles.bioTextEnrolled : styles.bioTextMissing]}>
              {isEnrolled ? '✓ Face Enrolled' : '⚠ No Biometrics'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchWrapper}>
          <CustomInput
            placeholder="Search student by name, roll, ID, email..."
            value={search}
            onChangeText={handleSearch}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/admin/enroll-student')}
        >
          <Text style={styles.addBtnText}>+ Enroll</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>
        {students.length} canonical student{students.length !== 1 ? 's' : ''} registered
      </Text>

      <FlatList
        data={students}
        keyExtractor={(item) => item._id}
        renderItem={renderStudentItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStudents(search, false);
            }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="👥"
              title="No students found"
              message={
                search.trim()
                  ? 'No students match your query. Try searching by roll number or email.'
                  : 'No students enrolled yet. Tap "+ Enroll" to enroll students.'
              }
            />
          )
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  searchWrapper: {
    flex: 1,
  },
  searchInput: {
    marginBottom: 0,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 6,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 32,
    flexGrow: 1,
  },
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  inactiveCard: {
    opacity: 0.65,
    backgroundColor: '#f8fafc',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  nameSection: {
    flex: 1,
    paddingRight: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  studentIdText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emailText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeBadgeText: {
    color: '#15803d',
  },
  inactiveBadgeText: {
    color: '#b91c1c',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 8,
  },
  classBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  departmentText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bioPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bioPillEnrolled: {
    backgroundColor: '#f0fdf4',
  },
  bioPillMissing: {
    backgroundColor: '#fef3c7',
  },
  bioPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bioTextEnrolled: {
    color: '#16a34a',
  },
  bioTextMissing: {
    color: '#d97706',
  },
});
