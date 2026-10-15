import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import { validateEmail } from '../../utils/validation';
import { createFaculty, getSubjects } from '../../services/adminService';

export default function AdminAddFacultyScreen() {
  const [name, setName] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadExistingSubjects();
  }, []);

  const loadExistingSubjects = async () => {
    try {
      const res = await getSubjects();
      if (res.success && res.subjects) {
        setAvailableSubjects(res.subjects);
      }
    } catch {
      // Non-blocking
    }
  };

  const toggleSubjectSelection = (subjectName) => {
    setAssignedSubjects((prev) =>
      prev.includes(subjectName) ? prev.filter((s) => s !== subjectName) : [...prev, subjectName]
    );
  };

  const handleAddCustomSubject = () => {
    const clean = customSubjectInput.trim();
    if (!clean) return;
    if (!assignedSubjects.includes(clean)) {
      setAssignedSubjects((prev) => [...prev, clean]);
    }
    setCustomSubjectInput('');
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!facultyId.trim()) errs.facultyId = 'Faculty ID is required';
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!validateEmail(email)) {
      errs.email = 'Please enter a valid email address';
    }
    if (!department.trim()) errs.department = 'Department is required';
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const payload = {
        name: name.trim(),
        facultyId: facultyId.trim(),
        email: email.trim().toLowerCase(),
        department: department.trim(),
        password,
        assignedSubjects,
      };

      const res = await createFaculty(payload);
      if (res.success) {
        Alert.alert(
          'Faculty Registered',
          `Faculty account for "${name.trim()}" has been created with ${assignedSubjects.length} assigned subject(s).`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Could not register faculty member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Register Faculty Member</Text>
          <Text style={styles.subtitle}>
            Create authorized faculty credentials and assign teaching subjects.
          </Text>

          <CustomInput
            label="Full Name *"
            placeholder="e.g. Dr. Jane Smith"
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          <CustomInput
            label="Faculty ID *"
            placeholder="e.g. FAC-CS-003"
            value={facultyId}
            onChangeText={setFacultyId}
            error={errors.facultyId}
          />

          <CustomInput
            label="Email Address *"
            placeholder="e.g. jane.smith@college.edu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <CustomInput
            label="Department *"
            placeholder="e.g. Computer Science & Engineering"
            value={department}
            onChangeText={setDepartment}
            error={errors.department}
          />

          <CustomInput
            label="Initial Password *"
            placeholder="Minimum 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />

          {/* Assigned Subjects Section */}
          <View style={styles.subjectsSection}>
            <Text style={styles.subjectsLabel}>Assign Teaching Subjects</Text>
            <Text style={styles.subjectsHint}>
              Faculty members can only mark attendance and view attendance history for their assigned subjects.
            </Text>

            {availableSubjects.length > 0 && (
              <View style={styles.availableChipsRow}>
                {availableSubjects.map((sub) => {
                  const isSelected = assignedSubjects.includes(sub.name);
                  return (
                    <TouchableOpacity
                      key={sub._id}
                      style={[styles.subjectChip, isSelected && styles.subjectChipSelected]}
                      onPress={() => toggleSubjectSelection(sub.name)}
                    >
                      <Text style={[styles.subjectChipText, isSelected && styles.subjectChipTextSelected]}>
                        {isSelected ? '✓ ' : '+ '}
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Custom Subject Tag Input */}
            <View style={styles.customSubjectRow}>
              <View style={styles.customInputWrap}>
                <CustomInput
                  placeholder="Or enter new subject name..."
                  value={customSubjectInput}
                  onChangeText={setCustomSubjectInput}
                  style={styles.customInput}
                />
              </View>
              <TouchableOpacity style={styles.addTagBtn} onPress={handleAddCustomSubject}>
                <Text style={styles.addTagText}>Add</Text>
              </TouchableOpacity>
            </View>

            {assignedSubjects.length > 0 && (
              <View style={styles.selectedBox}>
                <Text style={styles.selectedTitle}>Selected Subjects ({assignedSubjects.length}):</Text>
                <View style={styles.selectedChips}>
                  {assignedSubjects.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.selectedChip}
                      onPress={() => toggleSubjectSelection(s)}
                    >
                      <Text style={styles.selectedChipText}>{s} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <CustomButton
            title="REGISTER FACULTY & SAVE ASSIGNMENTS"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.medium,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 18,
    lineHeight: 18,
  },
  subjectsSection: {
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subjectsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  subjectsHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  availableChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  subjectChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  subjectChipSelected: {
    backgroundColor: '#8430ce',
    borderColor: '#8430ce',
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  subjectChipTextSelected: {
    color: '#fff',
  },
  customSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInputWrap: {
    flex: 1,
  },
  customInput: {
    marginBottom: 0,
  },
  addTagBtn: {
    backgroundColor: '#8430ce',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addTagText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  selectedBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  selectedTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectedChip: {
    backgroundColor: '#f3e8fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  selectedChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8430ce',
  },
  submitBtn: {
    marginTop: 8,
    backgroundColor: '#8430ce',
  },
});
