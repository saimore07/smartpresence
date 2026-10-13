import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import { validateSignup } from '../../utils/validation';

export default function SignupScreen() {
  const { signup } = useAuth();
  const [form, setForm] = useState({
    name: '',
    facultyId: '',
    email: '',
    department: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const handleSignup = async () => {
    const validationErrors = validateSignup(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await signup(form);
      router.replace('/faculty/dashboard');
    } catch (error) {
      const message = error.message || 'Signup failed. Please try again.';
      Alert.alert('Signup Failed', message);
    } finally {
      setLoading(false);
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
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Create Faculty Account</Text>
          <Text style={styles.formSubtitle}>
            Fill in your details to get started
          </Text>

          <CustomInput
            label="Full Name"
            value={form.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="Enter your full name"
            autoCapitalize="words"
            error={errors.name}
          />

          <CustomInput
            label="Faculty ID"
            value={form.facultyId}
            onChangeText={(v) => updateField('facultyId', v)}
            placeholder="Enter your Faculty ID"
            error={errors.facultyId}
          />

          <CustomInput
            label="Email"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <CustomInput
            label="Department"
            value={form.department}
            onChangeText={(v) => updateField('department', v)}
            placeholder="e.g., Computer Science"
            autoCapitalize="words"
            error={errors.department}
          />

          <CustomInput
            label="Password"
            value={form.password}
            onChangeText={(v) => updateField('password', v)}
            placeholder="Minimum 6 characters"
            secureTextEntry
            error={errors.password}
          />

          <CustomInput
            label="Confirm Password"
            value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)}
            placeholder="Re-enter your password"
            secureTextEntry
            error={errors.confirmPassword}
          />

          <CustomButton
            title="CREATE ACCOUNT"
            onPress={handleSignup}
            loading={loading}
            style={styles.submitButton}
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
    flexGrow: 1,
    padding: 24,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    ...SHADOWS.medium,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  submitButton: {
    marginTop: 8,
  },
});
