import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import CustomInput from '../../components/CustomInput';
import EmptyState from '../../components/EmptyState';
import { COLORS, SHADOWS } from '../../constants/config';
import { getFacultyList, toggleFacultyStatus } from '../../services/adminService';

export default function AdminFacultyScreen() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);

  const loadFaculty = async (searchQuery = '', showFullLoading = false) => {
    if (showFullLoading) setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const response = await getFacultyList(params);
      if (response && response.success) {
        setFaculty(response.faculty);
      }
    } catch (error) {
      setFaculty([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFaculty(search, faculty.length === 0);
    }, [search])
  );

  const handleSearch = (text) => {
    setSearch(text);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      loadFaculty(text, false);
    }, 300);
  };

  const handleToggleStatus = (member) => {
    const action = member.isActive === false ? 'activate' : 'deactivate';
    Alert.alert(
      `${action === 'activate' ? 'Activate' : 'Deactivate'} Faculty`,
      `Are you sure you want to ${action} ${member.name}? ${
        action === 'deactivate' ? 'Their attendance history will remain completely preserved.' : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'activate' ? 'Activate' : 'Deactivate',
          style: action === 'activate' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await toggleFacultyStatus(member._id);
              if (res.success) {
                setFaculty((prev) =>
                  prev.map((f) => (f._id === member._id ? { ...f, isActive: !f.isActive } : f))
                );
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to update faculty status.');
            }
          },
        },
      ]
    );
  };

  const renderFacultyCard = ({ item }) => {
    const isActive = item.isActive !== false;
    const subjects = item.assignedSubjects || [];

    return (
      <View style={[styles.card, !isActive && styles.inactiveCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {item.name ? item.name.charAt(0).toUpperCase() : 'F'}
            </Text>
          </View>

          <View style={styles.infoWrapper}>
            <Text style={styles.facultyName}>{item.name}</Text>
            <Text style={styles.idText}>
              ID: {item.facultyId} • {item.department}
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

        {/* Assigned Subjects Chips */}
        <View style={styles.subjectsSection}>
          <Text style={styles.subjectsTitle}>
            Assigned Subjects ({subjects.length}):
          </Text>
          {subjects.length > 0 ? (
            <View style={styles.chipsRow}>
              {subjects.map((sub, i) => (
                <View key={i} style={styles.subjectChip}>
                  <Text style={styles.subjectChipText}>{sub}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noSubjectsText}>No subjects assigned yet.</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchWrapper}>
          <CustomInput
            placeholder="Search faculty by name, ID, department..."
            value={search}
            onChangeText={handleSearch}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/admin/add-faculty')}
        >
          <Text style={styles.addBtnText}>+ Register</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>
        {faculty.length} faculty member{faculty.length !== 1 ? 's' : ''} registered
      </Text>

      <FlatList
        data={faculty}
        keyExtractor={(item) => item._id}
        renderItem={renderFacultyCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadFaculty(search, false);
            }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="👨‍🏫"
              title="No faculty registered"
              message={
                search.trim()
                  ? 'No faculty members match your search.'
                  : 'Tap "+ Register" to add a new faculty member.'
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
    backgroundColor: '#8430ce',
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
  card: {
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3e8fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8430ce',
  },
  infoWrapper: {
    flex: 1,
    paddingRight: 6,
  },
  facultyName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  idText: {
    fontSize: 12,
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
  subjectsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  subjectsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subjectChipText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '500',
  },
  noSubjectsText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
});
