import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from '../services/api';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app start
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
        // Verify token by fetching user
        const response = await authService.getMe();
        if (response.success && response.user) {
          setUser(response.user);
        } else {
          // Invalid token
          await AsyncStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      }
    } catch {
      // Token expired or invalid
      await AsyncStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loginFaculty = async (email, password) => {
    const response = await authService.login(email, password);
    if (response.success) {
      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser({ ...response.user, role: 'faculty' });
    }
    return response;
  };

  const loginStudent = async (email, password) => {
    const response = await authService.studentLogin(email, password);
    if (response.success) {
      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser({ ...response.user, role: 'student', mustChangePassword: response.mustChangePassword });
    }
    return response;
  };

  const signupUser = async (data) => {
    const response = await authService.facultySignup(data);
    if (response.success) {
      await AsyncStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser({ ...response.user, role: 'faculty' });
    }
    return response;
  };

  const updateUserSession = (updatedUser, newToken = null) => {
    if (newToken) {
      AsyncStorage.setItem(TOKEN_KEY, newToken).catch(() => {});
      setToken(newToken);
    }
    if (updatedUser) {
      setUser((prev) => ({ ...(prev || {}), ...updatedUser }));
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    isFaculty: user?.role === 'faculty',
    isStudent: user?.role === 'student',
    login: loginFaculty,
    studentLogin: loginStudent,
    signup: signupUser,
    updateUser: updateUserSession,
    logout,
    restoreSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
