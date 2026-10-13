import apiRequest from './api';
import { API_BASE_URL } from '../constants/config';

export const createStudent = async (formData) => {
  return apiRequest('/students', {
    method: 'POST',
    body: formData,
    isFormData: true,
  });
};

export const getStudents = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/students?${query}` : '/students';
  return apiRequest(endpoint);
};

export const getStudentById = async (id) => {
  return apiRequest(`/students/${id}`);
};

export const lookupStudentPortal = async (query) => {
  return apiRequest(`/students/portal/lookup?query=${encodeURIComponent(query)}`);
};

export const getStudentPortalById = async (id) => {
  return apiRequest(`/students/portal/${id}`);
};

export const getClassNames = async () => {
  return apiRequest('/students/classes');
};

export const updateStudent = async (id, formData) => {
  return apiRequest(`/students/${id}`, {
    method: 'PUT',
    body: formData,
    isFormData: true,
  });
};

export const deleteStudent = async (id) => {
  return apiRequest(`/students/${id}`, {
    method: 'DELETE',
  });
};

export const deleteFaceTemplate = async (id) => {
  return apiRequest(`/students/${id}/face-template`, {
    method: 'DELETE',
  });
};

// Authenticated Student APIs
export const getStudentMe = async () => {
  return apiRequest('/students/me');
};

export const getStudentAttendanceSummary = async () => {
  return apiRequest('/students/attendance/summary');
};

export const getStudentAttendanceHistory = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/students/attendance/history?${query}` : '/students/attendance/history';
  return apiRequest(endpoint);
};

// Build the full image URL for student photos
export const getStudentImageUrl = (faceImageUrl) => {
  if (!faceImageUrl) return null;
  if (faceImageUrl.startsWith('http')) return faceImageUrl;
  // Remove /api from the base URL and append image path
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${faceImageUrl}`;
};
