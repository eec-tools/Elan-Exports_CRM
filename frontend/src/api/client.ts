import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handling — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else if (err.response?.status === 403) {
      console.error("CORS or permission error:", err.response.data);
    } else if (!err.response) {
      console.error("Network error - backend may be down:", err.message);
    }
    return Promise.reject(err);
  },
);

export default api;
