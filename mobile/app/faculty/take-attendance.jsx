import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import CustomButton from '../../components/CustomButton';
import CustomInput from '../../components/CustomInput';
import { COLORS, SHADOWS } from '../../constants/config';
import { getTodayDate } from '../../utils/attendance';
import { getClassNames } from '../../services/studentService';
import { recognizeAttendanceSession } from '../../services/attendanceService';
import { setAttendanceSession, clearAttendanceSession } from '../../utils/attendanceSession';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

export default function TakeAttendanceScreen() {
  const isFocused = useIsFocused();
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [errors, setErrors] = useState({});
  const [availableClasses, setAvailableClasses] = useState([]);

  // Flow steps: 'form' | 'camera' | 'review_rows'
  const [step, setStep] = useState('form');
  const [capturedRows, setCapturedRows] = useState([]); // [{ id, uri, rowNumber }]
  const [retakeTargetIndex, setRetakeTargetIndex] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  useEffect(() => {
    clearAttendanceSession();
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const response = await getClassNames();
      if (response && response.success && response.classes) {
        setAvailableClasses(response.classes);
        if (response.classes.length > 0 && !className) {
          setClassName(response.classes[0]);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!className.trim()) errs.className = 'Class / Division is required';
    if (!subject.trim()) errs.subject = 'Subject is required';
    if (!date.trim()) errs.date = 'Date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStartAttendance = async () => {
    if (!validateForm()) return;

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to capture classroom photographs.'
        );
        return;
      }
    }

    setRetakeTargetIndex(null);
    setStep('camera');
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const result = await cameraRef.current.takePictureAsync({
          quality: 0.85,
        });

        // Resize and optimize resolution for multi-face detection
        const manipulated = await ImageManipulator.manipulateAsync(
          result.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
        );

        if (retakeTargetIndex !== null) {
          // Replace specific row photo
          setCapturedRows((prev) => {
            const updated = [...prev];
            updated[retakeTargetIndex] = {
              ...updated[retakeTargetIndex],
              uri: manipulated.uri,
            };
            return updated;
          });
          setRetakeTargetIndex(null);
        } else {
          // Add new row photo
          const nextRowNumber = capturedRows.length + 1;
          setCapturedRows((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              uri: manipulated.uri,
              rowNumber: nextRowNumber,
            },
          ]);
        }

        setStep('review_rows');
      } catch (error) {
        Alert.alert('Error', 'Failed to capture classroom photo. Please try again.');
      }
    }
  };

  const handleRetakeRow = (index) => {
    setRetakeTargetIndex(index);
    setStep('camera');
  };

  const handleDeleteRow = (index) => {
    setCapturedRows((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      // Re-number rows
      return filtered.map((r, i) => ({ ...r, rowNumber: i + 1 }));
    });
  };

  const handleCaptureNextRow = () => {
    if (capturedRows.length >= 8) {
      Alert.alert('Limit Reached', 'Maximum 8 row photographs per lecture session.');
      return;
    }
    setRetakeTargetIndex(null);
    setStep('camera');
  };

  const handleSubmitSessionForRecognition = async () => {
    if (capturedRows.length === 0) {
      Alert.alert('No Photos', 'Please capture at least one classroom row photograph.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Uploading & analyzing classroom rows with AI Engine...');

    try {
      const formData = new FormData();
      formData.append('className', className.trim());
      formData.append('subject', subject.trim());
      formData.append('date', date.trim());

      capturedRows.forEach((row, idx) => {
        const filename = `classroom_row_${idx + 1}.jpg`;
        const normalizedUri = Platform.OS === 'android' && !row.uri.startsWith('file://') && !row.uri.startsWith('content://')
          ? `file://${row.uri}`
          : row.uri;

        formData.append('classroomImages', {
          uri: normalizedUri,
          name: filename,
          type: 'image/jpeg',
        });
      });

      const response = await recognizeAttendanceSession(formData);

      if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to analyze classroom photographs.');
      }

      // Store complete structured session in memory
      setAttendanceSession({
        className: className.trim(),
        subject: subject.trim(),
        date: date.trim(),
        capturedImageUrls: response.capturedImageUrls || [],
        capturedPhotos: capturedRows,
        metrics: response.metrics,
        proposedPresent: response.proposedPresent || [],
        proposedAbsent: response.proposedAbsent || [],
        uncertainMatches: response.uncertainMatches || [],
        unknownFaces: response.unknownFaces || [],
        conflicts: response.conflicts || [],
        allDetections: response.allDetections || [],
      });

      router.push('/faculty/attendance-review');
    } catch (error) {
      Alert.alert(
        'Recognition Error',
        error.message || 'Could not process photographs. Please check the AI engine status and retry.'
      );
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // CAMERA VIEW
  if (step === 'camera') {
    const currentRowDisplay =
      retakeTargetIndex !== null ? retakeTargetIndex + 1 : capturedRows.length + 1;

    return (
      <View style={styles.cameraContainer}>
        {/* Top Header Information Bar */}
        <View style={styles.cameraHeaderBar}>
          <View style={styles.cameraHeaderBadgeRow}>
            <View style={styles.cameraRowBadge}>
              <Text style={styles.cameraRowBadgeText}>
                📸 Row {currentRowDisplay} of ~5
              </Text>
            </View>
            <Text style={styles.cameraHeaderSubject} numberOfLines={1}>
              {subject || 'Attendance'} • {className || 'Class'}
            </Text>
          </View>
          <Text style={styles.cameraHeaderTip}>
            Hold phone horizontally to frame 10–16 students in this row
          </Text>
        </View>

        {/* Large Responsive Camera Preview (flex: 1 fills ~62–68% screen height) */}
        <View style={styles.cameraViewport}>
          {isFocused && permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.cameraFill}
              facing="back"
              onCameraReady={() => setIsCameraReady(true)}
              onMountError={(e) => console.warn('CameraView mount error:', e?.message)}
            />
          ) : (
            <View style={styles.cameraLoadingBox}>
              <ActivityIndicator color="#38bdf8" size="large" />
              <Text style={styles.cameraLoadingText}>Initializing Camera Feed...</Text>
            </View>
          )}

          {/* Wide Classroom Framing Guide Overlay */}
          <View style={styles.cameraFramingGuide} pointerEvents="none">
            <View style={styles.guideCornerTL} />
            <View style={styles.guideCornerTR} />
            <View style={styles.guideCornerBL} />
            <View style={styles.guideCornerBR} />

            {/* Horizontal Alignment Guideline across desks */}
            <View style={styles.guideHorizontalLine} />

            <View style={styles.guidePill}>
              <Text style={styles.guideText}>
                Wide Row Framing Zone • Keep all student desks in view
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Control & Action Panel */}
        <View style={styles.cameraBottomPanel}>
          <View style={styles.cameraStatusRow}>
            <Text style={styles.cameraStatusText}>
              {capturedRows.length > 0
                ? `${capturedRows.length} photograph${capturedRows.length > 1 ? 's' : ''} captured so far`
                : 'First row photograph for this session'}
            </Text>
            {retakeTargetIndex !== null && (
              <Text style={styles.cameraRetakeNotice}>Retaking Row #{currentRowDisplay}</Text>
            )}
          </View>

          <View style={styles.cameraActions}>
            <CustomButton
              title="Cancel"
              onPress={() => setStep(capturedRows.length > 0 ? 'review_rows' : 'form')}
              variant="secondary"
              style={styles.actionBtn}
            />
            <CustomButton
              title={`Capture Row ${currentRowDisplay}`}
              onPress={handleCapturePhoto}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </View>
    );
  }

  // REVIEW ROWS VIEW (GALLERY & AI SUBMISSION)
  if (step === 'review_rows') {
    return (
      <ScrollView contentContainerStyle={styles.galleryContainer}>
        <View style={styles.galleryCard}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Classroom Row Photographs</Text>
            <Text style={styles.gallerySubtitle}>
              {subject} • {className} • {date}
            </Text>
            <Text style={styles.galleryCounter}>
              {capturedRows.length} photograph{capturedRows.length !== 1 ? 's' : ''} ready
            </Text>
          </View>

          {/* List of captured row photos */}
          {capturedRows.map((row, idx) => (
            <View key={row.id} style={styles.rowPhotoCard}>
              <View style={styles.rowPhotoHeader}>
                <View style={styles.rowBadge}>
                  <Text style={styles.rowBadgeText}>Row #{row.rowNumber}</Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    onPress={() => handleRetakeRow(idx)}
                    style={styles.rowActionBtn}
                  >
                    <Text style={styles.rowActionText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteRow(idx)}
                    style={[styles.rowActionBtn, styles.rowDeleteBtn]}
                  >
                    <Text style={styles.rowDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Image
                source={{ uri: row.uri }}
                style={styles.rowThumbnail}
                resizeMode="cover"
              />
            </View>
          ))}

          {/* Add more rows button */}
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={handleCaptureNextRow}
            disabled={isProcessing}
          >
            <Text style={styles.addMoreIcon}>➕</Text>
            <Text style={styles.addMoreText}>
              Capture Next Row (Row {capturedRows.length + 1})
            </Text>
          </TouchableOpacity>

          {/* AI Recognition Submission CTA */}
          <View style={styles.submitSection}>
            {isProcessing ? (
              <View style={styles.processingBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.processingText}>{processingStatus}</Text>
                <Text style={styles.processingHint}>
                  Detecting faces, running embeddings, deduplicating cross-row appearances...
                </Text>
              </View>
            ) : (
              <CustomButton
                title={`⚡ Process ${capturedRows.length} Row Photo${capturedRows.length !== 1 ? 's' : ''} with AI`}
                onPress={handleSubmitSessionForRecognition}
                style={styles.submitBtn}
              />
            )}
          </View>

          <Text style={styles.disclaimerText}>
            Privacy note: Images are processed securely on the local AI engine. Final attendance roster requires explicit faculty review.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // FORM VIEW (Step 1)
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.badgeHeader}>
            <Text style={styles.badgeIcon}>📋</Text>
            <Text style={styles.badgeTitle}>Classroom Lecture Attendance</Text>
          </View>

          <Text style={styles.title}>Start Attendance Session</Text>
          <Text style={styles.subtitle}>
            Capture 4–5 row photographs (10–16 students per row) to automatically detect and match students.
          </Text>

          {/* Class Division Quick Selector */}
          {availableClasses.length > 0 && (
            <View style={styles.quickClassContainer}>
              <Text style={styles.quickClassLabel}>Select Enrolled Class:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classChipsScroll}>
                {availableClasses.map((cls) => (
                  <TouchableOpacity
                    key={cls}
                    style={[styles.classChip, className === cls && styles.classChipSelected]}
                    onPress={() => setClassName(cls)}
                  >
                    <Text style={[styles.classChipText, className === cls && styles.classChipTextSelected]}>
                      {cls}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <CustomInput
            label="Class / Division *"
            placeholder="e.g., CS-A, IT-B, TE-Comp"
            value={className}
            onChangeText={setClassName}
            error={errors.className}
          />

          <CustomInput
            label="Subject *"
            placeholder="e.g., Machine Learning, Computer Networks"
            value={subject}
            onChangeText={setSubject}
            error={errors.subject}
          />

          <CustomInput
            label="Date *"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={setDate}
            error={errors.date}
          />

          <CustomButton
            title="Start Session & Open Camera"
            onPress={handleStartAttendance}
            style={styles.startBtn}
          />

          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>💡 Multi-Row Photo Guidance:</Text>
            <Text style={styles.infoBannerText}>
              • 80-student lecture hall: take ~5 photos from front to back, one row at a time.
            </Text>
            <Text style={styles.infoBannerText}>
              • Students appearing in multiple photos will be automatically deduplicated.
            </Text>
            <Text style={styles.infoBannerText}>
              • You will review and verify every student before saving to MongoDB.
            </Text>
          </View>
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
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    ...SHADOWS.medium,
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  quickClassContainer: {
    marginBottom: 16,
  },
  quickClassLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  classChipsScroll: {
    flexDirection: 'row',
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  classChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  classChipText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  classChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  startBtn: {
    marginTop: 12,
  },
  infoBanner: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  infoBannerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
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
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cameraLoadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  cameraLoadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  cameraFramingGuide: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  guideCornerTL: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderColor: '#38bdf8',
    borderTopLeftRadius: 6,
  },
  guideCornerTR: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderColor: '#38bdf8',
    borderTopRightRadius: 6,
  },
  guideCornerBL: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 32,
    height: 32,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderColor: '#38bdf8',
    borderBottomLeftRadius: 6,
  },
  guideCornerBR: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderColor: '#38bdf8',
    borderBottomRightRadius: 6,
  },
  guideHorizontalLine: {
    width: '88%',
    height: 1,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderStyle: 'dashed',
  },
  guidePill: {
    position: 'absolute',
    bottom: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  guideText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
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
  cameraStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cameraStatusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  cameraRetakeNotice: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
  galleryContainer: {
    padding: 20,
  },
  galleryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.medium,
  },
  galleryHeader: {
    marginBottom: 16,
  },
  galleryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  gallerySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  galleryCounter: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 6,
  },
  rowPhotoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  rowPhotoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rowBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rowActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  rowActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowDeleteBtn: {
    borderColor: '#fce8e6',
    backgroundColor: '#fce8e6',
  },
  rowDeleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  rowThumbnail: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: '#f4f8ff',
    marginVertical: 10,
  },
  addMoreIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  submitSection: {
    marginTop: 16,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#1a73e8',
  },
  processingBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
  },
  processingHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  disclaimerText: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
});
