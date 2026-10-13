export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-IN', options);
};

export const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};

export const getAttendancePercentage = (present, total) => {
  if (total === 0) return 0;
  return parseFloat(((present / total) * 100).toFixed(1));
};

export const getStatusColor = (status) => {
  return status === 'present' ? '#1e8e3e' : '#d93025';
};

export const getStatusLabel = (status) => {
  return status === 'present' ? 'Present' : 'Absent';
};
