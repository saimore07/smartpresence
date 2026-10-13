/**
 * In-memory session store for attendance flow between Take Attendance and Attendance Review.
 */
let currentSession = null;

export const setAttendanceSession = (session) => {
  currentSession = session;
};

export const getAttendanceSession = () => {
  return currentSession;
};

export const clearAttendanceSession = () => {
  currentSession = null;
};
