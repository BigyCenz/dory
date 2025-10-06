import apiClient from './auth'
const API_BASE = 'http://localhost:5000/api';

// Recupera tutti gli schedules (codice, nome, eccezioni, intervalli)
// - Richiede: Solo token JWT
// - Risponde: Array di schedules [{ SCH_COD, SCH_NAME, ... }]
export const getSchedules = async () => {
  const token = localStorage.getItem('token');
  const res = await apiClient.get(`${API_BASE}/schedules`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
};

// Crea un nuovo schedule (solo nome)
// - Richiede: { name: sch_name }
// - Risponde: schedule creato
// NOTA: Crea uno schedule vuoto, senza eccezioni né intervalli
export const createSchedule = async ({ sch_name }) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.post(`${API_BASE}/schedules`, { name: sch_name }, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// - Richiede: { ... } (nome, eccezioni, times)
// - Risponde: schedule aggiornato
// NOTA: Aggiorna uno schedule esistente con i campi forniti (nome, eccezioni, intervalli)
export const updateSchedule = async (sch_cod, data) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.put(`${API_BASE}/schedules/${sch_cod}`, data, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};

// Elimina schedule
// - Richiede: Solo token JWT
// - Risponde: { msg: ... }
// - NOTA: Elimina uno schedule esistente
export const deleteSchedule = async (sch_cod) => {
  const token = localStorage.getItem('token');
  const res = await apiClient.delete(`${API_BASE}/schedules/${sch_cod}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });
  return res.data;
};