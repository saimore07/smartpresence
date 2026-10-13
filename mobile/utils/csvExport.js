import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share, Alert } from 'react-native';

/**
 * Escapes a field for standard RFC 4180 CSV compliance
 */
const escapeCsv = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Generates formatted CSV string from one or more attendance records
 * Columns: Student Name, Roll Number, Student ID, Class, Division, Subject Name, Date, Time, Status
 */
export const buildAttendanceCsv = (recordOrRecords) => {
  const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];

  const headers = [
    'Student Name',
    'Roll Number',
    'Student ID',
    'Class',
    'Division',
    'Subject Name',
    'Date',
    'Time',
    'Status',
  ];

  const rows = [headers.map(escapeCsv).join(',')];

  records.forEach((record) => {
    if (!record) return;

    const subjectName = record.subject || '';
    const dateStr = record.date || '';

    const defaultTime = record.createdAt
      ? new Date(record.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    (record.students || []).forEach((entry) => {
      const student = entry.studentId || {};
      const studentName = student.name || entry.name || 'Unknown Student';
      const rollNumber = student.rollNumber || entry.rollNumber || '—';
      const studentId = student.studentId || entry.studentIdStr || '—';
      const studentClass = student.year || record.className || '—';
      const studentDivision = student.className || record.className || '—';
      const status = (entry.status || 'absent').toLowerCase() === 'present' ? 'Present' : 'Absent';

      let timeStr = defaultTime;
      if (entry.markedAt) {
        try {
          timeStr = new Date(entry.markedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        } catch {
          timeStr = defaultTime;
        }
      }

      rows.push([
        escapeCsv(studentName),
        escapeCsv(rollNumber),
        escapeCsv(studentId),
        escapeCsv(studentClass),
        escapeCsv(studentDivision),
        escapeCsv(subjectName),
        escapeCsv(dateStr),
        escapeCsv(timeStr),
        escapeCsv(status),
      ].join(','));
    });
  });

  return rows.join('\r\n');
};

/**
 * Exports CSV file across Web, Android, and iOS platforms.
 * - On Web: triggers browser file download.
 * - On Mobile: saves to local cache and opens system Share/Save dialog.
 */
export const exportAttendanceAsCsv = async (recordOrRecords, suggestedFilename = null) => {
  try {
    const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
    if (records.length === 0) {
      Alert.alert('No Records', 'There are no attendance records to export.');
      return { success: false };
    }

    const csvContent = buildAttendanceCsv(records);

    // Compute filename
    let filename = suggestedFilename;
    if (!filename) {
      if (records.length === 1 && records[0]) {
        const cls = (records[0].className || 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
        const sub = (records[0].subject || 'subject').replace(/[^a-zA-Z0-9_-]/g, '_');
        const dt = (records[0].date || 'date').replace(/[^a-zA-Z0-9_-]/g, '_');
        filename = `attendance_${cls}_${sub}_${dt}.csv`;
      } else {
        filename = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
      }
    }

    if (!filename.endsWith('.csv')) {
      filename += '.csv';
    }

    // 1. Web browser download handling
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, filename };
    }

    // 2. Native Mobile (Android / iOS) file export via expo-file-system and expo-sharing
    let fileUri = null;

    // Try modern File API first (Expo SDK 54+)
    try {
      if (Paths && Paths.cache && typeof File === 'function') {
        const targetFile = new File(Paths.cache, filename);
        if (!targetFile.exists) {
          targetFile.create();
        }
        targetFile.write(csvContent);
        fileUri = targetFile.uri;
      }
    } catch {
      // Fall through to legacy FileSystem
    }

    // Fallback to expo-file-system/legacy if modern File was unavailable or failed
    if (!fileUri) {
      try {
        const cacheDir = FileSystemLegacy.cacheDirectory || FileSystemLegacy.documentDirectory;
        if (cacheDir && typeof FileSystemLegacy.writeAsStringAsync === 'function') {
          fileUri = `${cacheDir}${filename}`;
          await FileSystemLegacy.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystemLegacy.EncodingType.UTF8,
          });
        }
      } catch {
        // Fall through to built-in Share
      }
    }

    // If file was successfully written, present native system share/save dialog
    if (fileUri) {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Attendance CSV',
          UTI: 'public.comma-separated-values-text',
        });
        return { success: true, filename, fileUri };
      }
    }

    // Ultimate fallback: React Native built-in Share
    await Share.share({
      title: filename,
      message: csvContent,
    });

    return { success: true, filename };
  } catch (error) {
    Alert.alert('Export Failed', error.message || 'Unable to export attendance CSV.');
    return { success: false, error };
  }
};
