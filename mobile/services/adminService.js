import apiRequest from './api';

// Admin System Statistics
export const getAdminStats = async () => {
  return apiRequest('/admin/stats');
};

// Faculty Management
export const getFacultyList = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/admin/faculty?${query}` : '/admin/faculty';
  return apiRequest(endpoint);
};

export const getFacultyById = async (id) => {
  return apiRequest(`/admin/faculty/${id}`);
};

export const createFaculty = async (data) => {
  return apiRequest('/admin/faculty', {
    method: 'POST',
    body: data,
  });
};

export const updateFaculty = async (id, data) => {
  return apiRequest(`/admin/faculty/${id}`, {
    method: 'PUT',
    body: data,
  });
};

export const toggleFacultyStatus = async (id) => {
  return apiRequest(`/admin/faculty/${id}/status`, {
    method: 'PATCH',
  });
};

// Subject Management & Faculty Assignments
export const getSubjects = async () => {
  return apiRequest('/admin/subjects');
};

export const createSubject = async (data) => {
  return apiRequest('/admin/subjects', {
    method: 'POST',
    body: data,
  });
};

export const updateSubject = async (id, data) => {
  return apiRequest(`/admin/subjects/${id}`, {
    method: 'PUT',
    body: data,
  });
};

export const deleteSubject = async (id) => {
  return apiRequest(`/admin/subjects/${id}`, {
    method: 'DELETE',
  });
};

// Student Active/Inactive Status Toggle
export const toggleStudentStatus = async (id) => {
  return apiRequest(`/admin/students/${id}/status`, {
    method: 'PATCH',
  });
};
