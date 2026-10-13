import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/config';
import { parse12HourTime } from '../utils/validation';

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const PRESETS = [
  { label: '09:00 AM – 10:00 AM', start: '09:00 AM', end: '10:00 AM' },
  { label: '10:00 AM – 11:00 AM', start: '10:00 AM', end: '11:00 AM' },
  { label: '11:15 AM – 12:15 PM', start: '11:15 AM', end: '12:15 PM' },
  { label: '01:00 PM – 02:00 PM', start: '01:00 PM', end: '02:00 PM' },
  { label: '02:00 PM – 03:00 PM', start: '02:00 PM', end: '03:00 PM' },
  { label: '03:15 PM – 04:15 PM', start: '03:15 PM', end: '04:15 PM' },
];

export default function SessionTimePicker({
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  error,
}) {
  // Modal state: null | 'start' | 'end'
  const [pickerTarget, setPickerTarget] = useState(null);

  // Picker temporary selection
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

  const openPicker = (target) => {
    const currentVal = target === 'start' ? startTime : endTime;
    if (currentVal) {
      const match = currentVal.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
      if (match) {
        setSelectedHour(match[1].padStart(2, '0'));
        setSelectedMinute(match[2]);
        setSelectedPeriod(match[3].toUpperCase());
      }
    } else {
      if (target === 'start') {
        setSelectedHour('09');
        setSelectedMinute('00');
        setSelectedPeriod('AM');
      } else {
        setSelectedHour('10');
        setSelectedMinute('00');
        setSelectedPeriod('AM');
      }
    }
    setPickerTarget(target);
  };

  const handleConfirmPicker = () => {
    const formatted = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
    if (pickerTarget === 'start') {
      onStartTimeChange(formatted);
    } else if (pickerTarget === 'end') {
      onEndTimeChange(formatted);
    }
    setPickerTarget(null);
  };

  const applyPreset = (preset) => {
    onStartTimeChange(preset.start);
    onEndTimeChange(preset.end);
  };

  // Compute duration
  const startMin = parse12HourTime(startTime);
  const endMin = parse12HourTime(endTime);
  let durationText = '';
  let isRangeInvalid = false;

  if (startMin !== null && endMin !== null) {
    if (endMin > startMin) {
      const diff = endMin - startMin;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      durationText = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ''} period` : `${mins} mins period`;
    } else {
      isRangeInvalid = true;
      durationText = 'End time must be after start time';
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Lecture Session Time (12-Hour AM/PM) *</Text>

      {/* Time Cards Row */}
      <View style={styles.cardsRow}>
        {/* Start Time Card */}
        <TouchableOpacity
          style={[
            styles.timeCard,
            !startTime && styles.timeCardEmpty,
            pickerTarget === 'start' && styles.timeCardActive,
          ]}
          onPress={() => openPicker('start')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>🕒</Text>
            <Text style={styles.cardHeaderText}>START TIME</Text>
          </View>
          <Text style={[styles.timeDisplay, !startTime && styles.timeDisplayEmpty]}>
            {startTime || '--:-- AM'}
          </Text>
          <Text style={styles.tapToEditHint}>Tap to choose</Text>
        </TouchableOpacity>

        <View style={styles.arrowDivider}>
          <Text style={styles.arrowIcon}>➔</Text>
        </View>

        {/* End Time Card */}
        <TouchableOpacity
          style={[
            styles.timeCard,
            !endTime && styles.timeCardEmpty,
            isRangeInvalid && styles.timeCardError,
            pickerTarget === 'end' && styles.timeCardActive,
          ]}
          onPress={() => openPicker('end')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderIcon}>🏁</Text>
            <Text style={styles.cardHeaderText}>END TIME</Text>
          </View>
          <Text style={[styles.timeDisplay, !endTime && styles.timeDisplayEmpty]}>
            {endTime || '--:-- AM'}
          </Text>
          <Text style={styles.tapToEditHint}>Tap to choose</Text>
        </TouchableOpacity>
      </View>

      {/* Live Duration Badge or Inline Warning */}
      {durationText ? (
        <View style={[styles.durationBadge, isRangeInvalid ? styles.durationBadgeError : styles.durationBadgeSuccess]}>
          <Text style={[styles.durationText, isRangeInvalid ? styles.durationTextError : styles.durationTextSuccess]}>
            {isRangeInvalid ? '⚠️ ' : '⏱️ '}
            {durationText}
          </Text>
        </View>
      ) : null}

      {/* Error message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Quick Lecture Slot Presets */}
      <View style={styles.presetSection}>
        <Text style={styles.presetHeading}>Quick Period Presets:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
          {PRESETS.map((p) => {
            const isSelected = startTime === p.start && endTime === p.end;
            return (
              <TouchableOpacity
                key={p.label}
                style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                onPress={() => applyPreset(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetChipText, isSelected && styles.presetChipTextSelected]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 12-Hour Time Picker Modal */}
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerTarget === 'start' ? 'Select Start Time' : 'Select End Time'}
              </Text>
              <Text style={styles.modalTimePreview}>
                {selectedHour}:{selectedMinute} {selectedPeriod}
              </Text>
            </View>

            {/* AM / PM Toggle */}
            <View style={styles.periodRow}>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'AM' && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod('AM')}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.periodButtonText, selectedPeriod === 'AM' && styles.periodButtonTextActive]}
                >
                  ☀️ AM (Morning)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'PM' && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod('PM')}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.periodButtonText, selectedPeriod === 'PM' && styles.periodButtonTextActive]}
                >
                  🌙 PM (Afternoon / Evening)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hour Selector Grid */}
            <Text style={styles.gridHeading}>Select Hour:</Text>
            <View style={styles.grid}>
              {HOURS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.gridCell, selectedHour === h && styles.gridCellSelected]}
                  onPress={() => setSelectedHour(h)}
                >
                  <Text style={[styles.gridCellText, selectedHour === h && styles.gridCellTextSelected]}>
                    {h}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Minute Selector Grid */}
            <Text style={styles.gridHeading}>Select Minute:</Text>
            <View style={styles.grid}>
              {MINUTES.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.gridCell, selectedMinute === m && styles.gridCellSelected]}
                  onPress={() => setSelectedMinute(m)}
                >
                  <Text style={[styles.gridCellText, selectedMinute === m && styles.gridCellTextSelected]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPickerTarget(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmPicker}
              >
                <Text style={styles.confirmButtonText}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  timeCardEmpty: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  timeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
  },
  timeCardError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHeaderIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  cardHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  timeDisplay: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginVertical: 2,
  },
  timeDisplayEmpty: {
    color: COLORS.textLight,
  },
  tapToEditHint: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  arrowDivider: {
    paddingHorizontal: 8,
  },
  arrowIcon: {
    fontSize: 18,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  durationBadge: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  durationBadgeSuccess: {
    backgroundColor: '#e6f4ea',
  },
  durationBadgeError: {
    backgroundColor: COLORS.errorLight,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationTextSuccess: {
    color: COLORS.present,
  },
  durationTextError: {
    color: COLORS.error,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 6,
  },
  presetSection: {
    marginTop: 14,
  },
  presetHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  presetChipTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.large,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalTimePreview: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  periodRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  periodButtonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  periodButtonTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  gridHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  gridCell: {
    width: '14.5%',
    aspectRatio: 1.1,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridCellSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  gridCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  gridCellTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  confirmButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});
