import axios from 'axios';

const api = axios.create({
  // Prefer an explicit API URL, otherwise use same-origin /api for Railway and local static hosting.
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
