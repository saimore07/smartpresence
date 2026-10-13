import apiRequest from './api';

export const facultySignup = async (data) => {
  return apiRequest('/auth/faculty/signup', {
    method: 'POST',
    body: data,
  });
};

export const login = async (email, password) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
};

export const getMe = async () => {
  return apiRequest('/auth/me');
};
