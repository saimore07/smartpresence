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

        {/* Administrator Screens */}
        <Stack.Screen name="admin/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="admin/students" options={{ title: 'Student Management' }} />
        <Stack.Screen name="admin/student-details" options={{ title: 'Student Details & Edit' }} />
        <Stack.Screen name="admin/enroll-student" options={{ title: 'Enroll Student Centrally' }} />
        <Stack.Screen name="admin/faculty" options={{ title: 'Faculty Directory' }} />
        <Stack.Screen name="admin/add-faculty" options={{ title: 'Register Faculty' }} />
        <Stack.Screen name="admin/subjects" options={{ title: 'Subject Management' }} />

        {/* Faculty Screens */}
        <Stack.Screen name="faculty/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="faculty/students" options={{ title: 'Class Roster & Students' }} />
        <Stack.Screen name="faculty/enroll-student" options={{ title: 'Enroll Student' }} />
        <Stack.Screen name="faculty/student-details" options={{ title: 'Student Profile' }} />
        <Stack.Screen name="faculty/take-attendance" options={{ title: 'Take Attendance' }} />
        <Stack.Screen name="faculty/attendance-review" options={{ title: 'Attendance Review' }} />
        <Stack.Screen name="faculty/attendance-history" options={{ title: 'Attendance History' }} />

        {/* Student Portal Screens */}
        <Stack.Screen name="student/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="student/profile" options={{ title: 'Student Profile' }} />
        <Stack.Screen name="student/attendance" options={{ title: 'My Attendance' }} />
      </Stack>
    </AuthProvider>
  );
}
