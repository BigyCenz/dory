import apiClient from './auth'
const API_BASE = 'http://localhost:5000/api';

// GET /api/letture/<pan_cod>?from=<dateFrom>&to=<dateTo>
// - Richiede: Solo token JWT
// - Risponde: array di letture [{ ... }]
export const getLetturePannello = async (pan_cod, dateFrom, dateTo) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/letture/${pan_cod}?from=${dateFrom}&to=${dateTo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};