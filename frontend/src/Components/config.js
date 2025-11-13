// src/axiosConfig.js
import axios from 'axios';

// 1) Decide the base URL
const baseURL =
  // explicit override wins
  process.env.REACT_APP_API_BASE_URL
  // otherwise pick by NODE_ENV
  || (process.env.NODE_ENV === 'production'
      ? 'https://hrapi.guardianfueltech.com'
      : 'http://127.0.0.1:5000');

console.log(`API Base URL: ${baseURL} (NODE_ENV: ${process.env.NODE_ENV})`);

// 2) Create the client
const api = axios.create({
  baseURL,
  withCredentials: true,          // <-- send cookies if your backend uses session cookies
  headers: {
    'Content-Type': 'application/json',
  },
  // If your server uses CSRF with cookies, uncomment and match your server names:
  // xsrfCookieName: 'csrftoken',
  // xsrfHeaderName: 'X-CSRFToken',
});

// 3) Attach bearer token if you use JWTs
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token'); // or wherever you store it
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 4) Helpful console for 401/403 to see the server message
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      console.warn('Auth/Permission error:', {
        status,
        url: err.config?.url,
        method: err.config?.method,
        data: err.response?.data,
      });
    }
    return Promise.reject(err);
  }
);

export default api;
