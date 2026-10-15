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
  // Role tab: 'student' | 'faculty' | 'admin'
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
        const response = await login(email.trim(), password);
        if (response.user?.role === 'admin' || role === 'admin') {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/faculty/dashboard');
        }
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

  const getFormTitle = () => {
    if (role === 'admin') return 'Administrator Sign In';
    if (role === 'faculty') return 'Faculty Sign In';
    return 'Student Attendance Portal';
  };

  const getEmailPlaceholder = () => {
    if (role === 'admin') return 'e.g. admin@smartpresence.com';
    if (role === 'faculty') return 'e.g. prof.sharma@college.edu';
    return 'e.g. rahul.sharma@college.edu';
  };

  const getPasswordPlaceholder = () => {
    if (role === 'admin') return 'Enter administrator password';
    if (role === 'faculty') return 'Enter faculty password';
    return 'Enter permanent or temporary password';
  };

  const getSubmitButtonTitle = () => {
    if (role === 'admin') return 'SIGN IN AS ADMINISTRATOR';
    if (role === 'faculty') return 'SIGN IN AS FACULTY';
    return 'SIGN IN AS STUDENT';
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

            <TouchableOpacity
              style={[styles.tabButton, role === 'admin' && styles.tabButtonActive]}
              onPress={() => {
                setRole('admin');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabButtonText, role === 'admin' && styles.tabButtonTextActive]}>
                🛡️ Admin
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formTitle}>{getFormTitle()}</Text>

          <CustomInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder={getEmailPlaceholder()}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <CustomInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={getPasswordPlaceholder()}
            secureTextEntry
            error={errors.password}
          />

          <CustomButton
            title={getSubmitButtonTitle()}
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          {role === 'faculty' && (
            <CustomButton
              title="CREATE FACULTY ACCOUNT"
              onPress={() => router.push('/auth/signup')}
              variant="outline"
              style={styles.signupButton}
            />
          )}

          {role === 'admin' && (
            <View style={styles.adminNoteBox}>
              <Text style={styles.adminNoteTitle}>🛡️ Centralized Management</Text>
              <Text style={styles.adminNoteText}>
                Log in to centrally enroll students, manage faculty accounts, and configure subject allocations.
              </Text>
            </View>
          )}

          {role === 'student' && (
            <View style={styles.studentNoteBox}>
              <Text style={styles.studentNoteTitle}>💡 First Time Logging In?</Text>
              <Text style={styles.studentNoteText}>
                Use your registered email and the temporary password provided by your institution during enrollment.
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderIcon}>🔐</Text>
              <Text style={styles.modalTitle}>Set Permanent Password</Text>
              <Text style={styles.modalSubtitle}>
                This is your first login. For security, please choose a permanent password of at least 6 characters.
              </Text>
            </View>

            <CustomInput
              label="Temporary Password"
              value={changeForm.oldPassword}
              onChangeText={(text) =>
                setChangeForm((prev) => ({ ...prev, oldPassword: text }))
              }
              placeholder="Enter current/temporary password"
              secureTextEntry
              error={changeErrors.oldPassword}
            />

            <CustomInput
              label="New Permanent Password"
              value={changeForm.newPassword}
              onChangeText={(text) =>
                setChangeForm((prev) => ({ ...prev, newPassword: text }))
              }
              placeholder="Enter new secure password (min 6 chars)"
              secureTextEntry
              error={changeErrors.newPassword}
            />

            <CustomInput
              label="Confirm New Password"
              value={changeForm.confirmPassword}
              onChangeText={(text) =>
                setChangeForm((prev) => ({ ...prev, confirmPassword: text }))
              }
              placeholder="Re-type new password"
              secureTextEntry
              error={changeErrors.confirmPassword}
            />

            <CustomButton
              title="SET PASSWORD & ACCESS DASHBOARD"
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
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    width: 72,
    height: 72,
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
    fontSize: 13,
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
  adminNoteBox: {
    marginTop: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  adminNoteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  adminNoteText: {
    fontSize: 12,
    color: '#1e40af',
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
