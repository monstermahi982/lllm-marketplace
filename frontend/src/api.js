const BASE_URL = '/api';

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token) => {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
};
