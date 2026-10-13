export const validateEmail = (email) => {
  const re = /^\S+@\S+\.\S+$/;
  return re.test(email);
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

export const validateStudent = ({ name, studentId, rollNumber, department, className, year }) => {
  const errors = {};

  if (!name || !name.trim()) errors.name = 'Student name is required';
  if (!studentId || !studentId.trim()) errors.studentId = 'Student ID is required';
  if (!rollNumber || !rollNumber.trim()) errors.rollNumber = 'Roll number is required';
  if (!department || !department.trim()) errors.department = 'Department is required';
  if (!className || !className.trim()) errors.className = 'Class / Division is required';
  if (!year || !year.trim()) errors.year = 'Year is required';

  return errors;
};
