import React, { useState, useRef, useEffect } from 'react';
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
import { router, useIsFocused } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import { validateStudent } from '../../utils/validation';
import { createStudent } from '../../services/studentService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function EnrollStudentScreen() {
  const isFocused = useIsFocused();
  // Flow steps: 'form' | 'camera' - Form first, camera opens smoothly once screen is settled
  const [step, setStep] = useState('form');
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
  // Default to 'back' camera matching working Take Attendance screen, with flip toggle
  const [facing, setFacing] = useState('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [viewportHeight, setViewportHeight] = useState(Math.round(SCREEN_HEIGHT * 0.62));
  const cameraRef = useRef(null);

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result?.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to capture student photographs.'
        );
        return;
      }
    }
    setIsCameraReady(false);
    setStep('camera');
  };

  const handleRetake = () => {
    setPhoto(null);
    handleOpenCamera();
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
          quality: 0.7,
        });

        // Optimize portrait resolution for neural face embedding extraction
        const manipulated = await ImageManipulator.manipulateAsync(
          result.uri,
          [{ resize: { width: 600 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );

        setPhoto(manipulated.uri);
        // Switch to form review step after capturing
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
      // Build FormData for multipart upload
      const formData = new FormData();
      formData.append('firstName', form.firstName.trim());
      formData.append('lastName', form.lastName.trim());
      formData.append('name', `${form.firstName.trim()} ${form.lastName.trim()}`);
      formData.append('studentId', form.studentId.trim());
      formData.append('rollNumber', form.rollNumber.trim());
      formData.append('email', form.email.trim());
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
      const tempPass = response?.activation?.temporaryPassword;
      if (tempPass) {
        Alert.alert(
          'Student Enrolled Successfully',
          `Student login credentials provisioned:\n\n📧 Email: ${form.email.trim()}\n🔑 Temporary Password: ${tempPass}\n\nPlease share this password with the student. They will set a permanent password upon first login.`,
          [{ text: 'Done', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Success', 'Student enrolled successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      Alert.alert('Enrollment Error', error.message || 'Failed to enroll student.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 1: DEDICATED LIVE CAMERA VIEW (Uses exact working architecture from Take Attendance)
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        {/* Top Header Information Bar */}
        <View style={styles.cameraHeaderBar}>
          <View style={styles.cameraHeaderBadgeRow}>
            <View style={styles.cameraRowBadge}>
              <Text style={styles.cameraRowBadgeText}>📸 Student Enrollment</Text>
            </View>
            <Text style={styles.cameraHeaderSubject} numberOfLines={1}>
              {form.firstName || form.studentId
                ? `${`${form.firstName || ''} ${form.lastName || ''}`.trim() || 'Student'} ${form.studentId ? `(${form.studentId})` : ''}`
                : 'Face Biometric Capture'}
            </Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{isCameraReady ? 'LIVE' : 'WAIT'}</Text>
            </View>
          </View>
          <Text style={styles.cameraHeaderTip} numberOfLines={1}>
            Position student's face inside the oval frame and capture
          </Text>
        </View>

        {/* Large Responsive Camera Preview (flex: 1 fills ~62–68% screen height) */}
        <View
          style={styles.cameraViewport}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== viewportHeight) {
              setViewportHeight(h);
            }
          }}
        >
          {isFocused && permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={[
                styles.cameraFill,
                viewportHeight ? { height: viewportHeight, width: '100%' } : null,
              ]}
              facing={facing}
              onCameraReady={() => setIsCameraReady(true)}
              onMountError={(e) => console.warn('CameraView mount error:', e?.message)}
            />
          ) : (
            <View style={styles.cameraLoadingBox}>
              <ActivityIndicator color="#38bdf8" size="large" />
              <Text style={styles.cameraLoadingText}>
                {permission?.granted ? 'Initializing Camera Feed...' : 'Camera Permission Required'}
              </Text>
              {!permission?.granted && (
                <CustomButton
                  title="Grant Permission"
                  onPress={requestPermission}
                  style={styles.permissionActionBtn}
                />
              )}
            </View>
          )}

          {/* Face Framing Oval Guide Overlay (pointerEvents="none") */}
          <View style={styles.cameraFramingGuide} pointerEvents="none">
            <View style={styles.faceOval} />
            <View style={styles.guidePill}>
              <Text style={styles.guideText}>Center student's face inside oval</Text>
            </View>
          </View>
        </View>

        {/* Bottom Control & Action Panel (flexShrink: 0, never overflows) */}
        <View style={styles.cameraBottomPanel}>
          <View style={styles.cameraControlRow}>
            <TouchableOpacity
              style={styles.pillControl}
              onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
              activeOpacity={0.7}
            >
              <Text style={styles.pillControlText}>
                🔄 Flip: {facing === 'back' ? 'Rear Camera' : 'Front Camera'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipToFormBtn}
              onPress={() => setStep('form')}
              activeOpacity={0.7}
            >
              <Text style={styles.skipToFormText}>Enter Details First ➔</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraActions}>
            <CustomButton
              title="Form Details"
              onPress={() => setStep('form')}
              variant="secondary"
              style={styles.actionBtn}
            />
            <CustomButton
              title="📸 Capture Photo"
              onPress={takePicture}
              disabled={!isCameraReady}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    );
  }

  // STEP 2: ENROLLMENT FORM VIEW (Scrollable with photo preview & retake option)
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          {/* Section Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Student Enrollment</Text>
            <Text style={styles.formSubtitle}>
              {photo
                ? '✓ Portrait captured. Complete student information to enroll.'
                : 'Complete student details and capture photo for facial recognition.'}
            </Text>
          </View>

          {/* Large Photo Preview Card (Responsive 210dp height) */}
          <View style={styles.photoCard}>
            {photo ? (
              <View style={styles.photoWrapper}>
                <Image source={{ uri: photo }} style={styles.photoPreview} resizeMode="cover" />
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>✓ Portrait Ready</Text>
                </View>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={handleRetake}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retakeButtonText}>↺ Retake Student Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoPlaceholder}
                onPress={handleOpenCamera}
                activeOpacity={0.8}
              >
                <View style={styles.placeholderCircle}>
                  <Text style={styles.placeholderIcon}>📷</Text>
                </View>
                <Text style={styles.placeholderTitle}>Open Live Camera Viewfinder</Text>
                <Text style={styles.placeholderSub}>
                  Take frontal face photograph with responsive live framing guide
                </Text>
                <CustomButton
                  title="Open Camera Preview"
                  onPress={handleOpenCamera}
                  style={styles.openCameraBtn}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Student Form Inputs: First & Last Name, Compulsory Email */}
          <CustomInput
            label="First Name *"
            value={form.firstName}
            onChangeText={(v) => updateField('firstName', v)}
            placeholder="e.g., Rahul"
            autoCapitalize="words"
            error={errors.firstName}
          />

          <CustomInput
            label="Last Name *"
            value={form.lastName}
            onChangeText={(v) => updateField('lastName', v)}
            placeholder="e.g., Sharma"
            autoCapitalize="words"
            error={errors.lastName}
          />

          <CustomInput
            label="Student ID *"
            value={form.studentId}
            onChangeText={(v) => updateField('studentId', v)}
            placeholder="Enter student ID (e.g., CS202401)"
            error={errors.studentId}
          />

          <CustomInput
            label="Roll Number *"
            value={form.rollNumber}
            onChangeText={(v) => updateField('rollNumber', v)}
            placeholder="Enter roll number (e.g., 101)"
            error={errors.rollNumber}
          />

          <CustomInput
            label="Student Email *"
            value={form.email}
            onChangeText={(v) => updateField('email', v)}
            placeholder="e.g., rahul.sharma@college.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <CustomInput
            label="Department *"
            value={form.department}
            onChangeText={(v) => updateField('department', v)}
            placeholder="e.g., Computer Science"
            autoCapitalize="words"
            error={errors.department}
          />

          <CustomInput
            label="Class / Division *"
            value={form.className}
            onChangeText={(v) => updateField('className', v)}
            placeholder="e.g., CS-A"
            autoCapitalize="characters"
            error={errors.className}
          />

          <CustomInput
            label="Year *"
            value={form.year}
            onChangeText={(v) => updateField('year', v)}
            placeholder="e.g., 3rd Year"
            error={errors.year}
          />

          <CustomButton
            title="ENROLL STUDENT"
            onPress={handleEnroll}
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
  // CAMERA VIEW STYLES (Identical to working Take Attendance architecture)
  cameraContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  cameraHeaderBar: {
    flexShrink: 0,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#0f172a',
  },
  cameraHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cameraRowBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cameraRowBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  cameraHeaderSubject: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700',
  },
  cameraHeaderTip: {
    color: '#94a3b8',
    fontSize: 11,
  },
  cameraViewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  cameraFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cameraLoadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  cameraLoadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  permissionActionBtn: {
    marginTop: 14,
    width: 220,
  },
  cameraFramingGuide: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  faceOval: {
    width: Math.min(SCREEN_WIDTH * 0.65, 250),
    height: Math.min(SCREEN_HEIGHT * 0.42, 320),
    borderRadius: 130,
    borderWidth: 2.5,
    borderColor: 'rgba(96, 165, 250, 0.9)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(96, 165, 250, 0.05)',
  },
  guidePill: {
    position: 'absolute',
    bottom: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  guideText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraBottomPanel: {
    flexShrink: 0,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  cameraControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pillControl: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillControlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  skipToFormBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipToFormText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
  // FORM VIEW STYLES
  formScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.medium,
  },
  formHeader: {
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  formSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  photoCard: {
    width: '100%',
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  photoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  placeholderCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeholderIcon: {
    fontSize: 26,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
  },
  placeholderSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  openCameraBtn: {
    width: '80%',
  },
  submitButton: {
    marginTop: 14,
    marginBottom: 8,
  },
});

