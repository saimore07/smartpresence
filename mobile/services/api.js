import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

const TOKEN_KEY = 'smartpresence_token';

// Get stored token
const getToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

// Build headers
const getHeaders = async (isFormData = false) => {
  const token = await getToken();
  const headers = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Native XMLHttpRequest upload for multipart/form-data.
 * React Native's XMLHttpRequest directly invokes native Android/iOS OkHttp
 * multipart body serialization for { uri, name, type }, bypassing Expo SDK 57's
 * WinterCG fetch convertFormDataAsync which throws 'Unsupported FormDataPart implementation'.
 */
const uploadMultipart = (url, method, headers, formData) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method || 'POST', url);

    // Apply headers (excluding Content-Type so native OkHttp computes boundary)
    if (headers) {
      Object.keys(headers).forEach((key) => {
        if (key.toLowerCase() !== 'content-type') {
          xhr.setRequestHeader(key, headers[key]);
        }
      });
    }

    xhr.onload = () => {
      let data = null;
      const responseText = xhr.responseText;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { success: false, message: responseText };
        }
      } else {
        data = { success: xhr.status >= 200 && xhr.status < 300 };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject({
          status: xhr.status,
          message: data?.message || `Upload failed with HTTP ${xhr.status}`,
          data,
        });
      }
    };

    xhr.onerror = () => {
      reject({
        status: 0,
        message: 'Network request failed. Please check your internet connection and server status.',
      });
    };

    xhr.ontimeout = () => {
      reject({
        status: 408,
        message: 'Upload timed out. Please check server performance and try again.',
      });
    };

    xhr.timeout = 60000; // 60 seconds for multi-image processing
    xhr.send(formData);
  });
};

// Centralized API request handler
const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', body, isFormData = false } = options;

  try {
    const headers = await getHeaders(isFormData);
    const fullUrl = `${API_BASE_URL}${endpoint}`;

    // Handle FormData uploads via native XMLHttpRequest to prevent Expo fetch serialization crashes
    if (isFormData || (body && typeof FormData !== 'undefined' && body instanceof FormData)) {
      return await uploadMultipart(fullUrl, method, headers, body);
    }

    const config = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, config);

    // Try to parse JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { success: false, message: 'Unexpected server response.' };
    }

    if (!response.ok) {
      throw {
        status: response.status,
        message: data.message || 'Something went wrong.',
        data,
      };
    }

    return data;
  } catch (error) {
    // Network error
    if (error.message === 'Network request failed') {
      throw {
        status: 0,
        message: 'Unable to connect to the server. Please check your internet connection and server status.',
      };
    }

    // Re-throw structured API errors
    if (error.status !== undefined) {
      throw error;
    }

    // Unknown error
    throw {
      status: 500,
      message: error.message || 'An unexpected error occurred.',
    };
  }
};

export { apiRequest, getToken, TOKEN_KEY };
export default apiRequest;
