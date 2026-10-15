import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import { validateStudent } from '../../utils/validation';
import { createStudent } from '../../services/studentService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AdminEnrollStudentScreen() {
  const [step, setStep] = useState('form'); // 'form' | 'camera'
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    rollNumber: '',
    email: '',
    department: '',
    className: '',
    year: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [facing, setFacing] = useState('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result?.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to capture student photographs for facial recognition.'
        );
        return;
      }
    }
    setIsCameraReady(false);
    setStep('camera');
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const result = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });

        // Optimize portrait resolution for neural face embedding extraction
        const manipulated = await ImageManipulator.manipulateAsync(
          result.uri,
          [{ resize: { width: 600 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );

        setPhoto(manipulated.uri);
        setStep('form');
      } catch (error) {
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const handleEnroll = async () => {
    const validationErrors = validateStudent(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const formData = new FormData();
      formData.append('firstName', form.firstName.trim());
      formData.append('lastName', form.lastName.trim());
      formData.append('name', `${form.firstName.trim()} ${form.lastName.trim()}`);
      formData.append('studentId', form.studentId.trim());
      formData.append('rollNumber', form.rollNumber.trim());
      formData.append('email', form.email.trim().toLowerCase());
      formData.append('department', form.department.trim());
      formData.append('className', form.className.trim());
      formData.append('year', form.year.trim());

      if (photo) {
        const rawFilename = photo.split('/').pop() || 'portrait.jpg';
        const cleanName = rawFilename.includes('.') ? rawFilename : `${rawFilename}.jpg`;
        const normalizedUri =
          Platform.OS === 'android' && !photo.startsWith('file://') && !photo.startsWith('content://')
            ? `file://${photo}`
            : photo;

        formData.append('faceImage', {
          uri: normalizedUri,
          name: cleanName,
          type: 'image/jpeg',
        });
      }

      const response = await createStudent(formData);

      setPhoto(null);
      setForm({
        firstName: '',
        lastName: '',
        studentId: '',
        rollNumber: '',
        email: '',
        department: '',
        className: '',
        year: '',
      });

      const tempPass = response.activation?.temporaryPassword;
      Alert.alert(
        'Student Enrolled Centrally',
        `Student "${response.student?.name || form.firstName}" has been registered in the canonical database.\n\n${
          tempPass
            ? `Initial Temporary Password: ${tempPass}\n\nThe student must log in using their email and change this password.`
            : 'Account is ready for faculty attendance taking.'
        }`,
        [
          {
            text: 'View Students',
            onPress: () => router.replace('/admin/students'),
          },
          {
            text: 'Enroll Another',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      Alert.alert('Enrollment Failed', error.message || 'Could not enroll student.');
    } finally {
      setLoading(false);
    }
  };

  // Camera Step
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <Text style={styles.cameraTitle}>Front Face Portrait</Text>
          <Text style={styles.cameraSubtitle}>Center the face within the portrait guide</Text>
        </View>

        <View style={styles.cameraViewWrapper}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            onCameraReady={() => setIsCameraReady(true)}
          />
          {/* Portrait Oval Overlay Guide */}
          <View style={styles.overlayCenter}>
            <View style={styles.faceGuideOval} />
          </View>
        </View>

        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setStep('form')}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, !isCameraReady && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={!isCameraReady}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.flipButtonText}>🔄 Flip</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Form Step
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.badgeHeader}>
            <Text style={styles.badgeText}>🛡️ Centralized Admin Enrollment</Text>
          </View>

          <Text style={styles.title}>Enroll Canonical Student</Text>
          <Text style={styles.subtitle}>
            Enter student details and photograph once. All authorized faculty will automatically have access for classroom attendance.
          </Text>

          {/* Photo Capture Section */}
          <View style={styles.photoSection}>
            {photo ? (
              <View style={styles.photoPreviewWrapper}>
                <Image source={{ uri: photo }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.retakeButton} onPress={handleOpenCamera}>
                  <Text style={styles.retakeText}>📷 Retake Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.photoPlaceholder} onPress={handleOpenCamera}>
                <Text style={styles.photoPlaceholderIcon}>📸</Text>
                <Text style={styles.photoPlaceholderText}>Capture Portrait for AI Recognition</Text>
                <Text style={styles.photoPlaceholderSubtext}>Click to open camera</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Form Fields */}
          <View style={styles.nameRow}>
            <View style={styles.halfInput}>
              <CustomInput
                label="First Name *"
                placeholder="e.g. Ada"
                value={form.firstName}
                onChangeText={(val) => updateField('firstName', val)}
                error={errors.firstName}
              />
            </View>
            <View style={styles.halfInput}>
              <CustomInput
                label="Last Name *"
                placeholder="e.g. Lovelace"
                value={form.lastName}
                onChangeText={(val) => updateField('lastName', val)}
                error={errors.lastName}
              />
            </View>
          </View>

          <CustomInput
            label="Compulsory Student Email *"
            placeholder="e.g. ada.lovelace@college.edu"
            value={form.email}
            onChangeText={(val) => updateField('email', val)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <CustomInput
            label="Institutional Student ID *"
            placeholder="e.g. STU-2026-001"
            value={form.studentId}
            onChangeText={(val) => updateField('studentId', val)}
            error={errors.studentId}
          />

          <CustomInput
            label="Roll Number *"
            placeholder="e.g. CS-01"
            value={form.rollNumber}
            onChangeText={(val) => updateField('rollNumber', val)}
            error={errors.rollNumber}
          />

          <CustomInput
            label="Class / Division *"
            placeholder="e.g. CS-A, IT-B"
            value={form.className}
            onChangeText={(val) => updateField('className', val)}
            error={errors.className}
          />

          <CustomInput
            label="Department *"
            placeholder="e.g. Computer Science & Engineering"
            value={form.department}
            onChangeText={(val) => updateField('department', val)}
            error={errors.department}
          />

          <CustomInput
            label="Academic Year *"
            placeholder="e.g. 3rd Year, B.Tech 2026"
            value={form.year}
            onChangeText={(val) => updateField('year', val)}
            error={errors.year}
          />

          <CustomButton
            title="ENROLL STUDENT CANONICALLY"
            onPress={handleEnroll}
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
  badgeHeader: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
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
  photoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoPreviewWrapper: {
    alignItems: 'center',
  },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  retakeButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
  },
  retakeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  photoPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  photoPlaceholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  photoPlaceholderSubtext: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  submitBtn: {
    marginTop: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  cameraSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  cameraViewWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuideOval: {
    width: 220,
    height: 280,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderStyle: 'dashed',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
  },
  flipButton: {
    padding: 12,
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
