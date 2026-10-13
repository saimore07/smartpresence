import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { COLORS } from '../constants/config';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.surface,
          },
          headerTintColor: COLORS.text,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: COLORS.background,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/signup" options={{ title: 'Create Faculty Account' }} />
        <Stack.Screen name="faculty/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="faculty/students" options={{ title: 'Students' }} />
        <Stack.Screen name="faculty/enroll-student" options={{ title: 'Enroll Student' }} />
        <Stack.Screen name="faculty/student-details" options={{ title: 'Student Details' }} />
        <Stack.Screen name="faculty/take-attendance" options={{ title: 'Take Attendance' }} />
        <Stack.Screen name="faculty/attendance-review" options={{ title: 'Attendance Review' }} />
        <Stack.Screen name="faculty/attendance-history" options={{ title: 'Attendance History' }} />
        <Stack.Screen name="student/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="student/profile" options={{ title: 'Student Profile' }} />
        <Stack.Screen name="student/attendance" options={{ title: 'My Attendance' }} />
      </Stack>
    </AuthProvider>
  );
}
