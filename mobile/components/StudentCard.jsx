import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../constants/config';
import { getStudentImageUrl } from '../services/studentService';

const StudentCard = ({ student, onPress }) => {
  const imageUrl = getStudentImageUrl(student.faceImageUrl);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(student)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {student.name ? student.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {student.name}
        </Text>
        <Text style={styles.detail}>
          Roll: {student.rollNumber}
        </Text>
        <Text style={styles.detail}>
          {student.className} • {student.department}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  avatarContainer: {
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.background,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  detail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  arrow: {
    fontSize: 24,
    color: COLORS.textLight,
    paddingLeft: 8,
  },
});

export default React.memo(StudentCard);
