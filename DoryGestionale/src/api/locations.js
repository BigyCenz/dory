import apiClient from './auth'
const API_BASE = 'http://localhost:5000/api';

// GET /api/locations?cliente=<cli_cod>
// - Richiede: header Authorization (JWT), query param clienteCod
// - Risponde: [{ LOC_COD, LOC_NAME }, ...]
// - NOTA: Restituisce le locations associate a un cliente
export const getLocations = async (cli_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/locations?cliente=${cli_cod}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// POST /api/locations
// - Richiede: { loc_name, cli_cod }
// - Risponde: { LOC_COD, LOC_NAME }
// - NOTA: Restituisce la location creata
export const createLocation = async ({ loc_name, cli_cod }) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/locations`, { loc_name, cli_cod }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// DELETE /api/locations/<loc_cod>
// - Richiede: nessun body
// - Risponde: { msg: 'Location eliminata' }
export const deleteLocation = async (loc_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.delete(`${API_BASE}/locations/${loc_cod}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};