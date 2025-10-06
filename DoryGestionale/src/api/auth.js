import axios from 'axios';
import { logout } from '../context/logoutHandler';

const API_URL = 'http://localhost:5000/api';
const apiClient = axios.create({ baseURL: API_URL });

export const loginUser = async (username, password) => {
  const response = await axios.post(`${API_URL}/login`, {
    username,
    password,
  });
  return response.data; // contiene access_token + refresh_token
};

// Inserisce il token access in ogni richiesta
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor 401 → prova refresh
apiClient.interceptors.response.use(
  
  (response) => response,
  async (error) => {
    console.log("INTERCEPTOR");
    if (error.response?.status === 401) {
      const refresh_token = localStorage.getItem('refresh_token');
      console.log(refresh_token);
      if (refresh_token) {
        try {
          // Invia il refresh token nell'header Authorization
          const res = await axios.post(
            `${API_URL}/refresh`,
            {},
            {
              headers: {
                Authorization: `Bearer ${refresh_token}`,
              },
            }
          );
          localStorage.setItem('token', res.data.access_token);
          // Aggiorna l'header Authorization della richiesta originale
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
          return apiClient.request(error.config);
        } catch (refreshError) {
          console.log("ERRORE REFRESH");
          logout();
        }
      } else {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
