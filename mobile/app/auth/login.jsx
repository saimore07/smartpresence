import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import { validateEmail, validatePassword } from '../../utils/validation';
import * as authService from '../../services/authService';

export default function LoginScreen() {
  const { login, studentLogin, updateUser } = useAuth();
  // Role tab: 'student' | 'faculty'
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Mandatory first-login password change state
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [changeForm, setChangeForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changeErrors, setChangeErrors] = useState({});
  const [changingPassword, setChangingPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      if (role === 'student') {
        const response = await studentLogin(email.trim(), password);
        if (response.mustChangePassword) {
          // Pre-populate oldPassword with current password for convenience
          setChangeForm({
            oldPassword: password,
            newPassword: '',
            confirmPassword: '',
          });
          setShowPasswordChangeModal(true);
        } else {
          router.replace('/student/dashboard');
        }
      } else {
        await login(email.trim(), password);
        router.replace('/faculty/dashboard');
      }
    } catch (error) {
      const message = error.message || 'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async () => {
    const errs = {};
    if (!changeForm.oldPassword) errs.oldPassword = 'Current password is required';
    const pwdErr = validatePassword(changeForm.newPassword);
    if (pwdErr) errs.newPassword = pwdErr;
    if (changeForm.newPassword !== changeForm.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }
    if (changeForm.oldPassword === changeForm.newPassword) {
      errs.newPassword = 'New password must be different from temporary password';
    }

    if (Object.keys(errs).length > 0) {
      setChangeErrors(errs);
      return;
    }

    setChangingPassword(true);
    setChangeErrors({});

    try {
      const res = await authService.studentChangePassword(
        changeForm.oldPassword,
        changeForm.newPassword,
        changeForm.confirmPassword
      );

      if (res.success) {
        updateUser(res.user, res.token);
        setShowPasswordChangeModal(false);
        Alert.alert(
          'Password Set Successfully',
          'Your permanent password has been saved. Welcome to your SmartPresence dashboard!',
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace('/student/dashboard'),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert('Password Change Failed', err.message || 'Could not update password. Please retry.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* App Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>📋</Text>
          </View>
          <Text style={styles.title}>SmartPresence</Text>
          <Text style={styles.subtitle}>AI-Powered Classroom Attendance Platform</Text>
        </View>

        {/* Login Container Card */}
        <View style={styles.formCard}>
          {/* Role Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, role === 'student' && styles.tabButtonActive]}
              onPress={() => {
                setRole('student');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, role === 'student' && styles.tabButtonTextActive]}>
                🎓 Student
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, role === 'faculty' && styles.tabButtonActive]}
              onPress={() => {
                setRole('faculty');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, role === 'faculty' && styles.tabButtonTextActive]}>
                👨‍🏫 Faculty
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formTitle}>
            {role === 'student' ? 'Student Attendance Portal' : 'Faculty Sign In'}
          </Text>

          <CustomInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder={role === 'student' ? 'e.g. rahul.sharma@college.edu' : 'e.g. prof.sharma@college.edu'}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <CustomInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={role === 'student' ? 'Enter permanent or temporary password' : 'Enter your password'}
            secureTextEntry
            error={errors.password}
          />

          <CustomButton
            title={role === 'student' ? 'SIGN IN AS STUDENT' : 'SIGN IN AS FACULTY'}
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          {role === 'faculty' ? (
            <CustomButton
              title="CREATE FACULTY ACCOUNT"
              onPress={() => router.push('/auth/signup')}
              variant="outline"
              style={styles.signupButton}
            />
          ) : (
            <View style={styles.studentNoteBox}>
              <Text style={styles.studentNoteTitle}>💡 First Time Logging In?</Text>
              <Text style={styles.studentNoteText}>
                Use your registered email and the temporary password provided by your faculty during enrollment.
                You will be required to create your personal password upon signing in.
              </Text>
            </View>
          )}
        </View>

        {/* Quick Portal Lookup Option for guests */}
        <View style={styles.legacyLookupSection}>
          <TouchableOpacity
            style={styles.legacyLookupBtn}
            onPress={() => router.push('/student/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.legacyLookupText}>🔍 Public Student Roll Number Search ➔</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mandatory First-Login Password Change Modal */}
      <Modal
        visible={showPasswordChangeModal}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderIcon}>🔐</Text>
              <Text style={styles.modalTitle}>Set Your Permanent Password</Text>
              <Text style={styles.modalSubtitle}>
                Welcome to SmartPresence! For security, your account requires a permanent password before accessing attendance records.
              </Text>
            </View>

            <CustomInput
              label="Temporary / Current Password *"
              value={changeForm.oldPassword}
              onChangeText={(val) => setChangeForm((prev) => ({ ...prev, oldPassword: val }))}
              placeholder="Enter temporary password"
              secureTextEntry
              error={changeErrors.oldPassword}
            />

            <CustomInput
              label="New Password * (min 6 characters)"
              value={changeForm.newPassword}
              onChangeText={(val) => setChangeForm((prev) => ({ ...prev, newPassword: val }))}
              placeholder="Enter new permanent password"
              secureTextEntry
              error={changeErrors.newPassword}
            />

            <CustomInput
              label="Confirm New Password *"
              value={changeForm.confirmPassword}
              onChangeText={(val) => setChangeForm((prev) => ({ ...prev, confirmPassword: val }))}
              placeholder="Re-enter new password"
              secureTextEntry
              error={changeErrors.confirmPassword}
            />

            <CustomButton
              title="SET PERMANENT PASSWORD & CONTINUE"
              onPress={handleChangePasswordSubmit}
              loading={changingPassword}
              style={styles.modalSubmitBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...SHADOWS.medium,
  },
  logoIcon: {
    fontSize: 38,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    ...SHADOWS.medium,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.small,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 18,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 8,
  },
  signupButton: {
    marginTop: 12,
  },
  studentNoteBox: {
    marginTop: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentNoteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  studentNoteText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  legacyLookupSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  legacyLookupBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legacyLookupText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    ...SHADOWS.large,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalSubmitBtn: {
    marginTop: 12,
  },
});
