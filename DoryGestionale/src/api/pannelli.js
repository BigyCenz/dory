import apiClient from './auth'
const API_BASE = 'http://localhost:5000/api';

// GET /api/modelli
// - Richiede: Solo token JWT
// - Risponde: [{ MOD_COD, MOD_NAME }, ...]
// - NOTA: Recupera i modelli disponibili
export const getModelli = async () => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/modelli`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// GET /api/pannelli
// - Richiede: Solo token JWT
// - Risponde: Array di pannelli [{ PAN_COD, nome, cliente_name, location_name, last_update, status }, ...]
// - NOTA: Recupera tutti i pannelli del gestore (dal JWT)
export const getPannelli = async () => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/pannelli`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// POST /api/pannelli
// - Richiede: { pan_name, mod_cod, cli_cod, loc_cod }
// - Risponde: ritorna il pannello creato
// - NOTA: Crea un nuovo pannello per il gestore (dal JWT)
export const createPannello = async ({ pan_name, mod_cod, cli_cod, loc_cod }) => {
  const token = localStorage.getItem('token');
  console.log("Creating pannello with cli_cod: ", cli_cod);
  console.log("Creating pannello with loc_cod: ", loc_cod);
  const res = await apiClient.post(`${API_BASE}/pannelli`, { pan_name, mod_cod, cli_cod, loc_cod }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// PUT /api/pannelli/<pan_cod>
// - Richiede: { pan_name, mod_cod, cli_cod, loc_cod }
// - Risponde: { msg: "Pannello aggiornato" }
// - NOTA: Aggiorna nome, cliente e location di un pannello
export const updatePannello = async (pan_cod, { pan_name, mod_cod, cli_cod, loc_cod }) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.put(`${API_BASE}/pannelli/${pan_cod}`, { pan_name, mod_cod, cli_cod, loc_cod }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// DELETE /api/pannelli/<pan_cod>
// - Risponde: { msg: 'Pannello eliminato' }
// - NOTA: Elimina un pannello
export const deletePannello = async (pan_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.delete(`${API_BASE}/pannelli/${pan_cod}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// GET /api/pannelli/<pan_cod>/porte/disponibili
// - Richiede: Solo token JWT
// - Risponde: array di porte disponibili per il pannello
export const getPorteDisponibili = async (pan_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/pannelli/${pan_cod}/porte/disponibili`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// GET /api/pannelli/<pan_cod>/porte
// - Richiede: Solo token JWT
// - Risponde: array di porte configurate per il pannello
export const getPortePannello = async (pan_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/pannelli/${pan_cod}/porte`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// POST /api/pannelli/<pan_cod>/porte
// - Richiede: { porte: [...] }
// - Risponde: conferma salvataggio porte
export const savePortePannello = async (pan_cod, porte) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/pannelli/${pan_cod}/porte`, { porte }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// POST /api/pannelli/<pan_cod>/control
// - Richiede: { address, pin, value, save }
// - Risponde: { msg: ... }
// - NOTA: Invia comando di controllo porta via MQTT (accensione/spegnimento, valore analogico, ecc)
export const controlPort = async (pan_cod, { address, pin, value, save }) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/pannelli/${pan_cod}/control`, { address, pin, value, save }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// POST /api/pannelli/<pan_cod>/ping
// - Richiede: Solo token JWT
// - Risponde: stato del pannello
export async function pingPannello(pan_cod) {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/pannelli/${pan_cod}/ping`, {}, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return res.data;
}

// POST /api/pannelli/<pan_cod>/set_offline
// - Richiede: Solo token JWT
// - Risponde: conferma set offline
export async function setPannelloOffline(pan_cod) {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/pannelli/${pan_cod}/set_offline`, {}, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return res.data;
}

// POST /api/pannelli/<pan_cod>/publish_config
// - Richiede: Solo token JWT
// - Risponde: conferma invio configurazione
export const publishConfig = async (pan_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/pannelli/${pan_cod}/publish_config`, {}, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return res.data;
};
