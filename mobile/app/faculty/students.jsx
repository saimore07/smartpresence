import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import CustomInput from '../../components/CustomInput';
import StudentCard from '../../components/StudentCard';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { COLORS } from '../../constants/config';
import { getStudents } from '../../services/studentService';

export default function StudentsScreen() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);

  const loadStudents = async (searchQuery = '', showFullLoading = false) => {
    if (showFullLoading) setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const response = await getStudents(params);
      if (response && response.success) {
        setStudents(response.students);
      }
    } catch (error) {
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // If we don't have any students loaded yet, show initial loading; otherwise refresh smoothly
      loadStudents(search, students.length === 0);
    }, [search])
  );

  const handleSearch = (text) => {
    setSearch(text);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    // Debounce API requests by 300ms to avoid hammering backend on every keystroke
    searchDebounceRef.current = setTimeout(() => {
      loadStudents(text, false);
    }, 300);
  };

  const handleStudentPress = useCallback((student) => {
    router.push({
      pathname: '/faculty/student-details',
      params: { id: student._id },
    });
  }, []);

  const renderStudentItem = useCallback(
    ({ item }) => <StudentCard student={item} onPress={handleStudentPress} />,
    [handleStudentPress]
  );

  const keyExtractor = useCallback((item) => item._id, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents(search, false);
  };

  if (loading && students.length === 0) {
    return <Loading message="Loading students..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <CustomInput
          placeholder="Search by name, roll number, or ID..."
          value={search}
          onChangeText={handleSearch}
          style={styles.searchInput}
        />
        <Text style={styles.count}>
          {students.length} student{students.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={keyExtractor}
        renderItem={renderStudentItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          search.trim() ? (
            <EmptyState
              icon="🔍"
              title="No students found"
              message="Try adjusting your search query."
            />
          ) : (
            <EmptyState
              icon="👥"
              title="No students enrolled yet"
              message="Tap the Enroll Student option on the dashboard to add students."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInput: {
    marginBottom: 4,
  },
  count: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    paddingLeft: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    flexGrow: 1,
  },
});
