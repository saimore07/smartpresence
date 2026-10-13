import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

export default function Index() {
  const { isAuthenticated, isStudent, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        if (isStudent) {
          router.replace('/student/dashboard');
        } else {
          router.replace('/faculty/dashboard');
        }
      } else {
        router.replace('/auth/login');
      }
    }
  }, [loading, isAuthenticated, isStudent]);

  return <Loading message="Starting SmartPresence..." />;
}
