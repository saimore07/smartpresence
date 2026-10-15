import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import EmptyState from '../../components/EmptyState';
import { COLORS, SHADOWS } from '../../constants/config';
import {
  getSubjects,
  createSubject,
  deleteSubject,
  getFacultyList,
} from '../../services/adminService';

export default function AdminSubjectsScreen() {
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Subject Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    className: '',
    department: '',
    facultyIds: [],
  });
  const [createLoading, setCreateLoading] = useState(false);

  const loadData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [subjRes, facRes] = await Promise.all([
        getSubjects(),
        getFacultyList(),
      ]);

      if (subjRes.success && subjRes.subjects) {
        setSubjects(subjRes.subjects);
      }
      if (facRes.success && facRes.faculty) {
        setFacultyList(facRes.faculty);
      }
    } catch {
      // Non-blocking
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(subjects.length === 0);
    }, [])
  );

  const toggleFacultySelection = (facId) => {
    setForm((prev) => ({
      ...prev,
      facultyIds: prev.facultyIds.includes(facId)
        ? prev.facultyIds.filter((id) => id !== facId)
        : [...prev.facultyIds, facId],
    }));
  };

  const handleCreateSubject = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation Error', 'Subject name is required.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        className: form.className.trim(),
        department: form.department.trim(),
        facultyIds: form.facultyIds,
      };

      const res = await createSubject(payload);
      if (res.success) {
        setShowAddModal(false);
        setForm({ name: '', code: '', className: '', department: '', facultyIds: [] });
        loadData(false);
        Alert.alert('Success', `Subject "${form.name.trim()}" created successfully.`);
      }
    } catch (err) {
      Alert.alert('Creation Failed', err.message || 'Could not create subject.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteSubject = (subj) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subj.name}"? It will be unassigned from all faculty members. Historical attendance records will remain preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteSubject(subj._id);
              if (res.success) {
                setSubjects((prev) => prev.filter((s) => s._id !== subj._id));
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete subject.');
            }
          },
        },
      ]
    );
  };

  const renderSubjectCard = ({ item }) => {
    const assigned = item.facultyIds || [];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWrapper}>
            <Text style={styles.subjectName}>{item.name}</Text>
            <Text style={styles.metaText}>
              {item.code ? `Code: ${item.code} • ` : ''}
              Class: {item.className || 'All Classes'}
              {item.department ? ` • ${item.department}` : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.deleteIconBtn}
            onPress={() => handleDeleteSubject(item)}
          >
            <Text style={styles.deleteIconText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {/* Faculty Assignments */}
        <View style={styles.facultySection}>
          <Text style={styles.facultySectionTitle}>
            Assigned Teaching Faculty ({assigned.length}):
          </Text>

          {assigned.length > 0 ? (
            <View style={styles.facultyChips}>
              {assigned.map((f, i) => (
                <View key={f._id || i} style={styles.facultyChip}>
                  <Text style={styles.facultyChipText}>👨‍🏫 {f.name || f.email}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.unassignedText}>
              ⚠️ Unassigned — No faculty member currently assigned to this subject.
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageTitle}>Institutional Subjects</Text>
          <Text style={styles.pageSubtitle}>
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''} configured
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addBtnText}>+ Add Subject</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={subjects}
        keyExtractor={(item) => item._id}
        renderItem={renderSubjectCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(false);
            }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading && (
            <EmptyState
              icon="📚"
              title="No subjects created"
              message="Tap '+ Add Subject' to configure institutional courses and assign faculty."
            />
          )
        }
      />

      {/* Add Subject Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Create New Subject</Text>
              <Text style={styles.modalSubtitle}>Configure course details and assign teaching faculty</Text>

              <CustomInput
                label="Subject Name *"
                placeholder="e.g. Machine Learning"
                value={form.name}
                onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
              />

              <CustomInput
                label="Subject Code"
                placeholder="e.g. CS-601"
                value={form.code}
                onChangeText={(t) => setForm((p) => ({ ...p, code: t }))}
              />

              <CustomInput
                label="Class / Division"
                placeholder="e.g. CS-A, TE-Comp (or leave empty for All)"
                value={form.className}
                onChangeText={(t) => setForm((p) => ({ ...p, className: t }))}
              />

              <CustomInput
                label="Department"
                placeholder="e.g. Computer Science"
                value={form.department}
                onChangeText={(t) => setForm((p) => ({ ...p, department: t }))}
              />

              {/* Assign Faculty Checkbox List */}
              <View style={styles.facPickerWrap}>
                <Text style={styles.facPickerLabel}>Assign Faculty Members:</Text>
                {facultyList.length > 0 ? (
                  <View style={styles.facChipsList}>
                    {facultyList.map((f) => {
                      const isSelected = form.facultyIds.includes(f._id);
                      return (
                        <TouchableOpacity
                          key={f._id}
                          style={[styles.facSelectChip, isSelected && styles.facSelectChipSelected]}
                          onPress={() => toggleFacultySelection(f._id)}
                        >
                          <Text style={[styles.facSelectText, isSelected && styles.facSelectTextSelected]}>
                            {isSelected ? '✓ ' : '+ '}
                            {f.name} ({f.facultyId})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.unassignedText}>No faculty members registered yet.</Text>
                )}
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleCreateSubject}
                  disabled={createLoading}
                >
                  <Text style={styles.modalSaveText}>
                    {createLoading ? 'Saving...' : 'Create Subject'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  pageSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#f29900',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  deleteIconBtn: {
    padding: 6,
  },
  deleteIconText: {
    fontSize: 18,
  },
  facultySection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  facultySectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  facultyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  facultyChip: {
    backgroundColor: '#fef7e0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  facultyChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  unassignedText: {
    fontSize: 11,
    color: '#dc2626',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    maxHeight: '85%',
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  facPickerWrap: {
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  facPickerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  facChipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facSelectChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  facSelectChipSelected: {
    backgroundColor: '#f29900',
    borderColor: '#f29900',
  },
  facSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  facSelectTextSelected: {
    color: '#fff',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#f29900',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveText: {
    fontWeight: '700',
    color: '#fff',
  },
});
