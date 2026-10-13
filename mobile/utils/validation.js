export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^\S+@\S+\.\S+$/;
  return re.test(email.trim());
};

export const validateRequired = (fields) => {
  const errors = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      errors[key] = `${label} is required`;
    }
  }
  return errors;
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
};

export const validateSignup = ({ name, facultyId, email, department, password, confirmPassword }) => {
  const errors = {};

  if (!name || !name.trim()) errors.name = 'Full name is required';
  if (!facultyId || !facultyId.trim()) errors.facultyId = 'Faculty ID is required';
  if (!email || !email.trim()) {
    errors.email = 'Email is required';
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email';
  }
  if (!department || !department.trim()) errors.department = 'Department is required';

  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  return errors;
};

export const validateStudent = ({
  firstName,
  lastName,
  name,
  studentId,
  rollNumber,
  email,
  department,
  className,
  year,
}) => {
  const errors = {};

  // Support separate First Name & Last Name (Feature A)
  if (!firstName || !firstName.trim()) {
    if (!name || !name.trim()) {
      errors.firstName = 'First name is required';
    }
  } else if (firstName.trim().length > 50) {
    errors.firstName = 'First name cannot exceed 50 characters';
  }

  if (!lastName || !lastName.trim()) {
    if (!name || !name.trim() || !name.trim().includes(' ')) {
      errors.lastName = 'Last name is required';
    }
  } else if (lastName.trim().length > 50) {
    errors.lastName = 'Last name cannot exceed 50 characters';
  }

  // Student email is compulsory (Feature A.2)
  if (!email || !email.trim()) {
    errors.email = 'Student email is required';
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!studentId || !studentId.trim()) errors.studentId = 'Student ID is required';
  if (!rollNumber || !rollNumber.trim()) errors.rollNumber = 'Roll number is required';
  if (!department || !department.trim()) errors.department = 'Department is required';
  if (!className || !className.trim()) errors.className = 'Class / Division is required';
  if (!year || !year.trim()) errors.year = 'Year is required';

  return errors;
};

/**
 * Validates and parses 12-hour AM/PM time formatted string (e.g., "09:00 AM", "12:30 PM").
 * Returns minutes elapsed from midnight (0..1439) or null if invalid.
 */
export const parse12HourTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

/**
 * Validates session start time and end time.
 * Returns { valid: boolean, error: string | null, durationMinutes: number }
 */
export const validateSessionTime = (startTime, endTime) => {
  if (!startTime || !startTime.trim()) {
    return { valid: false, error: 'Start time is required', durationMinutes: 0 };
  }
  if (!endTime || !endTime.trim()) {
    return { valid: false, error: 'End time is required', durationMinutes: 0 };
  }

  const startMinutes = parse12HourTime(startTime);
  const endMinutes = parse12HourTime(endTime);

  if (startMinutes === null) {
    return {
      valid: false,
      error: 'Start time must be formatted as 12-hour time (e.g. 09:00 AM)',
      durationMinutes: 0,
    };
  }

  if (endMinutes === null) {
    return {
      valid: false,
      error: 'End time must be formatted as 12-hour time (e.g. 10:00 AM)',
      durationMinutes: 0,
    };
  }

  if (endMinutes <= startMinutes) {
    return {
      valid: false,
      error: 'End time must be later than start time for a regular class period',
      durationMinutes: 0,
    };
  }

  const durationMinutes = endMinutes - startMinutes;
  return { valid: true, error: null, durationMinutes };
};
