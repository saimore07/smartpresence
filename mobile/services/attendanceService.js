import apiRequest from './api';

export const recognizeAttendanceSession = async (formData) => {
  return apiRequest('/attendance/recognize-session', {
    method: 'POST',
    body: formData,
    isFormData: true,
  });
};

export const createAttendance = async (data, isFormData = false) => {
  return apiRequest('/attendance', {
    method: 'POST',
    body: data,
    isFormData,
  });
};

export const getAttendance = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/attendance?${query}` : '/attendance';
  return apiRequest(endpoint);
};

export const getAttendanceById = async (id) => {
  return apiRequest(`/attendance/${id}`);
};

export const getStudentAttendance = async (studentId) => {
  return apiRequest(`/attendance/student/${studentId}`);
};

export const getAttendanceStats = async () => {
  return apiRequest('/attendance/stats');
};

export const getAttendanceCsvUrl = (id = null, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const base = id ? `/attendance/${id}/export-csv` : '/attendance/export-csv';
  return query ? `${base}?${query}` : base;
};

