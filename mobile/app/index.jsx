import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.replace('/faculty/dashboard');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [loading, isAuthenticated]);

  return <Loading message="Starting SmartPresence..." />;
}
