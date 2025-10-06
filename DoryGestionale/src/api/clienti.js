import apiClient from './auth'
const API_BASE = 'http://localhost:5000/api';

// GET /api/clienti
// - Richiede: Solo token JWT
// - Risponde: [{ CLI_COD, CLI_NAME }, ...]
// - NOTA: Recupera tutti i clienti del gestore (dal JWT)
export const getClienti = async () => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/clienti`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// POST /api/clienti
// - Richiede: { cli_name }
// - Risponde: { CLI_COD, CLI_NAME }
// - NOTA: Crea un nuovo cliente per il gestore (dal JWT)
export const createCliente = async ({ cli_name }) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/clienti`, { cli_name }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// PUT /api/clienti/<cli_cod>
// - Richiede: { cli_name }
// - Risponde: { CLI_COD, CLI_NAME }
// - NOTA: Aggiorna il nome di un cliente
export const updateCliente = async (cli_cod, { cli_name }) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.put(`${API_BASE}/clienti/${cli_cod}`, { cli_name }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// DELETE /api/clienti/<cli_cod>
// - Richiede: nessun body
// - Risponde: { msg: 'Cliente eliminato' }
// - NOTA: Elimina un cliente
export const deleteCliente = async (cli_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.delete(`${API_BASE}/clienti/${cli_cod}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};