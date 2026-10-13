import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Environment-configurable API URL & fallback PC LAN IP
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;
const ENV_BACKEND_IP = process.env.EXPO_PUBLIC_BACKEND_IP;
const PC_LAN_IP = ENV_BACKEND_IP || '192.168.149.180';
const PORT = process.env.EXPO_PUBLIC_PORT || '5000';

const getApiBaseUrl = () => {
  // 0. Explicit environment variable override
  if (ENV_API_URL) {
    return ENV_API_URL.replace(/\/$/, '');
  }

  // 1. Web running in local browser
  if (Platform.OS === 'web') {
    return `http://localhost:${PORT}/api`;
  }

  // 2. Attempt to dynamically obtain host IP from Expo Metro bundler (if on LAN IPv4)
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  const metroHost = hostUri ? hostUri.split(':')[0] : null;

  if (metroHost && /^\d+\.\d+\.\d+\.\d+$/.test(metroHost) && metroHost !== '127.0.0.1') {
    return `http://${metroHost}:${PORT}/api`;
  }

  // 3. Android Studio emulator (host localhost mapped to 10.0.2.2)
  if (Platform.OS === 'android' && (metroHost === 'localhost' || metroHost === '127.0.0.1')) {
    return `http://10.0.2.2:${PORT}/api`;
  }

  // 4. Fallback for physical device on LAN
  return `http://${PC_LAN_IP}:${PORT}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const COLORS = {
  primary: '#1a73e8',
  primaryDark: '#1557b0',
  primaryLight: '#e8f0fe',
  accent: '#4285f4',
  background: '#f5f7fa',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#202124',
  textSecondary: '#5f6368',
  textLight: '#9aa0a6',
  border: '#e0e0e0',
  error: '#d93025',
  errorLight: '#fce8e6',
  success: '#16e04fff',
  successLight: '#e6f4ea',
  warning: '#f9ab00',
  warningLight: '#fef7e0',
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  present: '#1e8e3e',
  absent: '#d93025',
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.text },
  medium: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  semibold: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  bold: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 20, fontWeight: '600', color: COLORS.text },
  caption: { fontSize: 12, color: COLORS.textSecondary },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};
