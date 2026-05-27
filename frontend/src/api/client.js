import axios from 'axios';

const api = axios.create({
  // Default to local backend on 5001 during development/testing
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pl_token');
      localStorage.removeItem('pl_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
