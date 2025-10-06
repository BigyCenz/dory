import apiClient from './auth'
const API_BASE = 'http://localhost:5000/api';

// GET /api/espansioni
// - Richiede: Solo token JWT
// - Risponde: [{ EXP_COD, EXP_NAME }, ...]
// - NOTA: Recupera tutte le espansioni disponibili
export const getEspansioni = async () => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/espansioni`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data; // array di oggetti {EXP_COD, EXP_NAME}
};

// GET /api/espansioni/pannello/<pan_cod>
// - Richiede: Solo token JWT
// - Risponde: [{ EXP_COD, EXP_NAME, i2cAddr }, ...]
// - NOTA: Recupera le espansioni già associate a un pannello
export const getEspansioniPannello = async (pan_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/espansioni/pannello/${pan_cod}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};


// POST /api/espansioni/pannelli/<pan_cod>
// - Richiede: { exp_cod, i2cAddr }
// - Risponde: espansione aggiunta
// - NOTA: Associa un'espansione ad un pannello
export const addEspansionePannello = async (pan_cod, exp_cod, i2cAddr) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/espansioni/pannelli/${pan_cod}`, { exp_cod, i2cAddr }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};


// DELETE /api/espansioni/pannelli/<pan_cod>
// - Richiede: { exp_cod, i2cAddr }
// - Risponde: espansione rimossa
// - NOTA: Rimuove l'associazione di un'espansione da un pannello
export const removeEspansionePannello = async (pan_cod, exp_cod, i2cAddr) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.delete(`${API_BASE}/espansioni/pannelli/${pan_cod}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: { exp_cod, i2cAddr }
  });
  return res.data;
};