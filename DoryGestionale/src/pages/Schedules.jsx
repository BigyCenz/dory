import { useState, useEffect } from "react";
import { Box, TextField, Button, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Backdrop, Card, CardHeader, Avatar, Snackbar, Alert, DialogContentText } from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, CalendarToday as CalendarIcon } from "@mui/icons-material";
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from "../api/schedules";
import dayjs from "dayjs";
import { useAuth } from '../context/AuthContext';

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const Schedules = () => {
  // Stati principali
  const [schedules, setSchedules] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  // Dialog di modifica
  const [editing, setEditing] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [times, setTimes] = useState({}); // {DAY: [{start,end}]}

  // Conferme e snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, sch_cod: null });
  const [confirmCloseEdit, setConfirmCloseEdit] = useState(false);

  const { user } = useAuth();

  // Carica schedules all'avvio
  useEffect(() => {
    fetchSchedules();
  }, []);

  // Fetch schedules dal backend ---
  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const data = await getSchedules();
      setSchedules(data);
    } catch (err) {
      showMessage("Errore caricamento calendari", "error");
    } finally {
      setLoading(false);
    }
  };

  // Funzione di utilità per mostrare messaggi ---
  const showMessage = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  // Azione pulsante creazione nuovo schedule
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      showMessage("Inserisci un nome calendario valido", "warning");
      return;
    }
    if (schedules.some((s) => s.SCH_NAME.trim().toLowerCase() === name.toLowerCase())) {
      showMessage("Nome calendario già esistente", "warning");
      return;
    }
    setLoading(true);
    try {
      const nuovo = await createSchedule({ sch_name: name });
      setNewName("");
      showMessage("Calendario creato", "success");
      await fetchSchedules();
      // Apri automaticamente la pagina di modifica per il nuovo schedule
      setEditing(nuovo);
      setExceptions(nuovo.exceptions || []);
      setTimes(nuovo.times || {});
    } catch (err) {
      showMessage("Errore creazione calendario", "error");
    } finally {
      setLoading(false);
    }
  };

  // Azione pulsante eliminazione schedule
  const handleDelete = (sch_cod) => {
    setConfirmDelete({ open: true, sch_cod });
  };

  // Azione pulsante conferma eliminazione schedule
  const handleConfirmDelete = async () => {
    setLoading(true);
    try {
      await deleteSchedule(confirmDelete.sch_cod);
      showMessage("Calendario eliminato", "success");
      await fetchSchedules();
    } catch (err) {
      if (err.response && err.response.status === 409) {
        showMessage(err.response.data.msg || "Impossibile eliminare: almeno una porta è collegata a questo calendario.", "error");
      } else {
        showMessage("Errore eliminazione calendario", "error");
      }
    } finally {
      setLoading(false);
      setConfirmDelete({ open: false, sch_cod: null });
    }
  };
  // Azione pulsante apertura dialog modifica
  const handleOpenEditDialog = (s) => {
    setExceptions([]);
    setTimes({});
    setEditing(s);
    setExceptions(s.exceptions || []);
    setTimes(s.times || {});
  };

  // Azione pulsante chiusura dialog modifica
  const handleCloseEditDialog = () => {
    setConfirmCloseEdit(true);
  };

  // Conferma chiusura dialog modifica senza salvare
  const handleConfirmCloseEditDialog = () => {
    setEditing(null);
    setExceptions([]);
    setTimes({});
    setConfirmCloseEdit(false);
  };

  // Azione pulsante salvataggio modifica schedule
  const handleSave = async () => {
    const name = editing.SCH_NAME.trim();
    if (!name) {
      showMessage("Inserisci un nome calendario valido", "warning");
      return;
    }
    if (schedules.some((s) => s.SCH_NAME.trim().toLowerCase() === name.toLowerCase() && s.SCH_COD !== editing.SCH_COD)) {
      showMessage("Nome calendario già esistente", "warning");
      return;
    }
    setLoading(true);
    try {
      const data = {
        SCH_NAME: editing.SCH_NAME,
        exceptions,
        times,
      };
      await updateSchedule(editing.SCH_COD, data);
      showMessage("Calendario aggiornato", "success");
      handleConfirmCloseEditDialog();
      await fetchSchedules();
    } catch (err) {
      showMessage("Errore aggiornamento calendario", "error");
    } finally {
      setLoading(false);
    }
  };

  // ---- Gestione eccezioni ---- //

  // Aggiungi nuova eccezione (data odierna di default)
  const handleAddException = () => {
    setExceptions([...exceptions, dayjs().format("YYYY-MM-DD")]);
  };

  // Aggiorna eccezione in posizione idx
  const handleUpdateException = (idx, value) => {
    const newEx = [...exceptions];
    newEx[idx] = value;
    setExceptions(newEx);
  };

  // Rimuovi eccezione in posizione idx
  const handleRemoveException = (idx) => {
    const newEx = [...exceptions];
    newEx.splice(idx, 1);
    setExceptions(newEx);
  };

  // ---- Gestione intervalli ---- //

  // Aggiungi nuovo intervallo
  const handleAddTime = (day) => {
    const dayTimes = times[day] || [];
    setTimes({ ...times, [day]: [...dayTimes, { start: "08:00", end: "12:00" }] });
  };

  // Aggiorna intervallo in posizione idx
  const handleUpdateTime = (day, idx, field, value) => {
    const dayTimes = [...(times[day] || [])];
    dayTimes[idx][field] = value;
    setTimes({ ...times, [day]: dayTimes });
  };

  // Rimuovi intervallo in posizione idx
  const handleRemoveTime = (day, idx) => {
    const dayTimes = [...(times[day] || [])];
    dayTimes.splice(idx, 1);
    setTimes({ ...times, [day]: dayTimes });
  };

  return (

    <Box sx={{ p: 3 }}>

      <Typography variant="h5" gutterBottom>Nuovo calendario</Typography>
      
      {/* Nuovo Schedule */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <TextField label="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={user.role !== 'GESTORE'} />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          disabled={user.role !== 'GESTORE'}
        >
          Crea
        </Button>
      </Box>

      <Typography variant="h5" gutterBottom>Calendari esistenti</Typography>

      {/* Lista calendari */}
      <Box sx={{ display: "grid", gap: 2 }}>
        {schedules.length === 0 && (
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Nessun calendario presente
          </Typography>
        )}
        {schedules.map((s) => (

          <Card key={s.SCH_COD} sx={{ display: "flex", alignItems: "center", p: 1 }}>

            <CardHeader avatar={ <Avatar> <CalendarIcon /> </Avatar> } title={s.SCH_NAME} />

            <Box sx={{ marginLeft: "auto", pr: 2 }}>
              <IconButton color="primary" onClick={() => handleOpenEditDialog(s)} disabled={user.role !== 'GESTORE'}>
                <EditIcon />
              </IconButton>
              <IconButton color="error" onClick={() => handleDelete(s.SCH_COD)} disabled={user.role !== 'GESTORE'}>
                <DeleteIcon />
              </IconButton>
            </Box>

          </Card>

        ))}

      </Box>

      {/* Dialog di modifica */}
      <Dialog open={!!editing} onClose={handleCloseEditDialog} maxWidth="md" fullWidth>

        <DialogTitle>Modifica Schedule</DialogTitle>

        <DialogContent dividers>

          {editing && (
            <Box>

              <TextField fullWidth label="Nome" value={editing.SCH_NAME} onChange={(e) => setEditing({ ...editing, SCH_NAME: e.target.value })} sx={{ mb: 2 }} />

              {/* Eccezioni */}
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Eccezioni</Typography>
              {exceptions.map((ex, i) => (

                <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <TextField type="date" value={ex} onChange={(e) => handleUpdateException(i, e.target.value)} size="small" />
                  <Button color="error" onClick={() => handleRemoveException(i)}>Rimuovi</Button>
                </Box>

              ))}
              <Button onClick={handleAddException}>Aggiungi eccezione</Button>

              {/* Orari settimanali */}
              <Typography variant="subtitle2" sx={{ mt: 2 }}>Orari settimanali</Typography>
              {DAYS.map((day) => (

                <Box key={day} sx={{ mb: 1 }}>

                  <Typography variant="body2" fontWeight="bold">{day}</Typography>

                  {(times[day] || []).map((t, i) => (
                    <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                      <TextField type="time" value={t.start} onChange={(e) => handleUpdateTime(day, i, "start", e.target.value)} size="small" />
                      <TextField type="time" value={t.end} onChange={(e) => handleUpdateTime(day, i, "end", e.target.value)} size="small" />
                      <Button color="error" onClick={() => handleRemoveTime(day, i)}>Rimuovi</Button>
                    </Box>
                  ))}

                  <Button onClick={() => handleAddTime(day)}>Aggiungi intervallo</Button>

                </Box>

              ))}

            </Box>

          )}

        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Annulla</Button>
          <Button variant="contained" color="primary" onClick={handleSave} disabled={user.role !== 'GESTORE'}>
            Salva
          </Button>
        </DialogActions>

      </Dialog>

      {/* Conferma eliminazione */}
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false, sch_cod: null })}>

        <DialogTitle>Conferma eliminazione calendario</DialogTitle>

        <DialogContent>
          <DialogContentText>Sei sicuro di voler eliminare questo calendario? L'operazione non è reversibile.</DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmDelete({ open: false, sch_cod: null })}>Annulla</Button>
          <Button color="error" onClick={handleConfirmDelete}>Elimina</Button>
        </DialogActions>

      </Dialog>

      {/* Conferma chiusura dialog di modifica */}
      <Dialog open={confirmCloseEdit} onClose={() => setConfirmCloseEdit(false)}>

        <DialogTitle>Attenzione</DialogTitle>

        <DialogContent>
          <DialogContentText>Se chiudi ora, le modifiche al calendario non verranno salvate. Vuoi continuare?</DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmCloseEdit(false)}>Annulla</Button>
          <Button color="error" onClick={handleConfirmCloseEditDialog}>Chiudi senza salvare</Button>
        </DialogActions>

      </Dialog>

      {/* Backdrop caricamento */}
      <Backdrop open={loading} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Snackbar messaggi */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Box>

  );
};

export default Schedules;