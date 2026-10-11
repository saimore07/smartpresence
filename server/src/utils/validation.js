const validateEmail = (email) => {
  const re = /^\S+@\S+\.\S+$/;
  return re.test(email);
};

const validateRequired = (fields) => {
  const missing = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push(key);
    }
  }
  return missing;
};

module.exports = { validateEmail, validateRequired };
