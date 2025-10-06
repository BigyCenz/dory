import { useEffect, useState } from "react";
import { Box, TextField, Button, Card, CardHeader, Avatar, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Backdrop, Snackbar, Alert, Typography, DialogContentText } from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon, Person as PersonIcon, LocationOn as LocationIcon } from "@mui/icons-material";
import { getClienti, createCliente, updateCliente, deleteCliente } from "../api/clienti";
import { getLocations, createLocation, deleteLocation } from "../api/locations";
import { useAuth } from '../context/AuthContext';

export default function Clienti() {

  // Dati clienti
  const [clienti, setClienti] = useState([]);

  // Nuovo cliente
  const [newCliente, setNewCliente] = useState("");

  // Dialog modifica cliente
  const [editDialog, setEditDialog] = useState({ open: false, cliente: null });
  const [editName, setEditName] = useState("");

  // Dialog eliminazione cliente
  const [confirmDeleteCliente, setConfirmDeleteCliente] = useState({ open: false, cliCod: null });

  // Dialog location
  const [locationDialog, setLocationDialog] = useState({ open: false, cliente: null });
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState("");
  const [localLocations, setLocalLocations] = useState([]);
  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState({ open: false, locCod: null });
  const [confirmCloseLocations, setConfirmCloseLocations] = useState(false);

  // Caricamento e messaggi
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const { user } = useAuth();



  // Carica clienti all'avvio
  useEffect(() => {
    fetchClienti();
  }, []);

  // Caricamento clienti del gestore da API
  const fetchClienti = async () => {
    setLoading(true);
    try {
      const data = await getClienti();
      setClienti(data);
    } catch (err) {
      showMessage("Errore nel caricamento clienti", "error");
    } finally {
      setLoading(false);
    }
  };




  // Azione pulsante aggiunta cliente e salvataggio
  const handleAddCliente = async () => {
    const name = newCliente.trim();
    if (!name) {
      showMessage("Inserisci un nome cliente valido", "warning");
      return;
    }
    if (clienti.some(c => c.CLI_NAME.trim().toLowerCase() === name.toLowerCase())) {
      showMessage("Nome cliente già esistente", "warning");
      return;
    }
    setLoading(true);
    try {
      const nuovo = await createCliente({ cli_name: name });
      showMessage("Cliente aggiunto con successo", "success");
      setNewCliente("");
      await fetchClienti();
      setLocationDialog({ open: true, cliente: nuovo });
    } catch (err) {
      console.log(err);
      showMessage("Errore durante l'aggiunta", "error");
    } finally {
      setLoading(false);
    }
  };

  // Azione pulsante salva modifiche cliente
  const handleEditCliente = async () => {
    const name = editName.trim();
    if (!name) {
      showMessage("Inserisci un nome cliente valido", "warning");
      return;
    }
    if (clienti.some(c => c.CLI_NAME.trim().toLowerCase() === name.toLowerCase() && c.CLI_COD !== editDialog.cliente.CLI_COD)) {
      showMessage("Nome cliente già esistente", "warning");
      return;
    }
    setLoading(true);
    try {
      await updateCliente(editDialog.cliente.CLI_COD, { cli_name: name });
      showMessage("Cliente aggiornato", "success");
      setEditDialog({ open: false, cliente: null });
      fetchClienti();
    } catch (err) {
      showMessage("Errore durante l'aggiornamento", "error");
    } finally {
      setLoading(false);
    }
  };

  // Azione pulsante elimina cliente
  const handleDeleteCliente = (cliCod) => {
    setConfirmDeleteCliente({ open: true, cliCod });
  };

  // Azione pulsante conferma elimina cliente
  const handleConfirmDeleteCliente = async () => {
    setLoading(true);
    try {
      await deleteCliente(confirmDeleteCliente.cliCod);
      showMessage("Cliente eliminato", "success");
      fetchClienti();
    } catch (err) {
      if (err.response && err.response.status === 409) {
        showMessage(
          err.response.data.msg ||
            "Impossibile eliminare: esistono pannelli associati a questo cliente.",
          "error"
        );
      } else {
        showMessage("Errore durante l'eliminazione", "error");
      }
    } finally {
      setLoading(false);
      setConfirmDeleteCliente({ open: false, cliCod: null });
    }
  };

  // Azione pulsante aggiunta location in locale
  const handleAddLocation = () => {
    const name = newLocation.trim();
    if (!name) {
      showMessage("Inserisci un nome luogo valido", "warning");
      return;
    }
    if (localLocations.some(l => l.LOC_NAME.trim().toLowerCase() === name.toLowerCase())) {
      showMessage("Nome luogo già esistente", "warning");
      return;
    }
    setLocalLocations(prev => [...prev, { LOC_COD: `temp_${Date.now()}`, LOC_NAME: name, isNew: true }]);
    setNewLocation("");
    showMessage("Luogo aggiunto in locale. Premi Salva per confermare.", "info");
  };

  // Azione pulsante elimina location in locale
  const handleDeleteLocation = (locCod) => {
    setConfirmDeleteLocation({ open: true, locCod });
  };

  // Apertura dialog location cliente
  const handleOpenLocationDialog = async (cliente) => {
    setLocationDialog({ open: true, cliente });
    setNewLocation("");
    setLoading(true);
    try {
      const data = await getLocations(cliente.CLI_COD);
      setLocations(data);
      setLocalLocations(data); // lavora in locale
    } catch (err) {
      showMessage("Errore nel caricamento location", "error");
    } finally {
      setLoading(false);
    }
  };

  // Azione pulsante conferma eliminazione location in locale
  const handleConfirmDeleteLocation = () => {
    setLocalLocations(prev => prev.filter(loc => loc.LOC_COD !== confirmDeleteLocation.locCod));
    setConfirmDeleteLocation({ open: false, locCod: null });
    showMessage("Luogo rimosso in locale. Premi Salva per confermare.", "info");
  };

  // Azione pulsante salva locations (aggiunte e rimosse)
  const handleSaveLocations = async () => {
    setLoading(true);
    try {
      // Aggiungi nuovi
      for (const loc of localLocations.filter(l => l.isNew)) {
        await createLocation({ loc_name: loc.LOC_NAME, cli_cod: locationDialog.cliente.CLI_COD });
      }
      // Elimina rimossi (quelli presenti su server ma non più in localLocations)
      for (const loc of locations) {
        if (!localLocations.some(l => l.LOC_COD === loc.LOC_COD)) {
          await deleteLocation(loc.LOC_COD);
        }
      }
      showMessage("Luoghi aggiornati con successo", "success");
      setLocationDialog({ open: false, cliente: null });
      setLocations([]);
      setLocalLocations([]);
      setNewLocation("");
    } catch (err) {
      showMessage("Errore durante il salvataggio dei luoghi", "error");
    } finally {
      setLoading(false);
    }
  };

  // Azione pulsante chiusura dialog location
  const handleCloseLocationDialog = () => {
    setConfirmCloseLocations(true);
  };

  // Conferma chiusura dialog locations senza salvare
  const handleConfirmCloseLocationsDialog = () => {
    setLocationDialog({ open: false, cliente: null });
    setLocations([]);
    setLocalLocations([]);
    setNewLocation("");
    setConfirmCloseLocations(false);
  };




  // Messaggi di feedback
  const showMessage = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };



  // Render grafico della pagina
  return (

    <Box sx={{ p: 3 }}>

      {/* Form creazione */}
      <Typography variant="h5" gutterBottom>Nuovo cliente</Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <TextField label="Nome Cliente" value={newCliente} onChange={(e) => setNewCliente(e.target.value)} fullWidth disabled={user.role !== 'GESTORE'} />
        <Button variant="contained" onClick={handleAddCliente} disabled={user.role !== 'GESTORE'}> Aggiungi </Button>
      </Box>

      {/* Lista clienti */}
      <Typography variant="h5" gutterBottom>Clienti esistenti</Typography>
      {clienti.length === 0 && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Nessun cliente presente
        </Typography>
      )}
      <Box sx={{ display: "grid", gap: 2 }}>
        {clienti.map((c) => (
          <Card key={c.CLI_COD} sx={{ display: "flex", alignItems: "center", p: 1 }}>
            <CardHeader avatar={ <Avatar> <PersonIcon /> </Avatar> } title={c.CLI_NAME} />
            <Box sx={{ marginLeft: "auto", pr: 2 }}>
              <IconButton color="info" onClick={() => handleOpenLocationDialog(c)} title="Gestisci luoghi" disabled={user.role !== 'GESTORE'}> <LocationIcon /> </IconButton>
              <IconButton color="primary" onClick={() => { setEditDialog({ open: true, cliente: c }); setEditName(c.CLI_NAME); }} disabled={user.role !== 'GESTORE'}><EditIcon /></IconButton>
              <IconButton color="error" onClick={() => handleDeleteCliente(c.CLI_COD)} disabled={user.role !== 'GESTORE'}> <DeleteIcon /> </IconButton>
            </Box>
          </Card>
        ))}
      </Box>

      {/* Dialog modifica */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, cliente: null })}>
        <DialogTitle>Modifica Cliente</DialogTitle>
        <DialogContent>
          <TextField label="Nome Cliente" value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth sx={{ marginTop: 2 }} disabled={user.role !== 'GESTORE'} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, cliente: null })}>Annulla</Button>
          <Button variant="contained" onClick={handleEditCliente} disabled={user.role !== 'GESTORE'}>Salva</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog gestione location */}
      <Dialog open={locationDialog.open} onClose={handleCloseLocationDialog} maxWidth="sm" fullWidth>

        <DialogTitle>
          Luoghi di {locationDialog.cliente?.CLI_NAME}
        </DialogTitle>
        
        <DialogContent>

          {/* Form aggiunta nuova location */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, mt: 1 }}>
            <TextField label="Nome Luogo" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} fullWidth size="small" disabled={user.role !== 'GESTORE'} />
            <Button variant="contained" onClick={handleAddLocation} size="medium" disabled={user.role !== 'GESTORE'}> Aggiungi </Button>
          </Box>

          {/* Lista location esistenti */}
          <Box sx={{ display: "grid", gap: 1, maxHeight: 300, overflowY: "auto" }}>
            {localLocations.map((loc) => (
              <Card key={loc.LOC_COD} sx={{ display: "flex", alignItems: "center", p: 1 }}>
                <Box sx={{ flexGrow: 1, pl: 1 }}>
                  <Typography variant="body1">{loc.LOC_NAME}</Typography>
                </Box>
                <IconButton color="error" size="small" onClick={() => handleDeleteLocation(loc.LOC_COD)} disabled={user.role !== 'GESTORE'}> <DeleteIcon /> </IconButton>
              </Card>
            ))}

            {localLocations.length === 0 && (
              <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: "center" }}>
                Nessun luogo trovato
              </Typography>
            )}

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLocationDialog}>Chiudi</Button>
          <Button variant="contained" color="primary" onClick={handleSaveLocations} disabled={user.role !== 'GESTORE'}>Salva</Button>
        </DialogActions>
      </Dialog>

      {/* Conferma eliminazione cliente */}
      <Dialog open={confirmDeleteCliente.open} onClose={() => setConfirmDeleteCliente({ open: false, cliCod: null })}>
        <DialogTitle>Conferma eliminazione cliente</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questo cliente? L'operazione non è reversibile.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteCliente({ open: false, cliCod: null })}>Annulla</Button>
          <Button color="error" onClick={handleConfirmDeleteCliente}>Elimina</Button>
        </DialogActions>
      </Dialog>

      {/* Conferma eliminazione location */}
      <Dialog open={confirmDeleteLocation.open} onClose={() => setConfirmDeleteLocation({ open: false, locCod: null })}>
        <DialogTitle>Conferma eliminazione luogo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questo luogo?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteLocation({ open: false, locCod: null })}>Annulla</Button>
          <Button color="error" onClick={handleConfirmDeleteLocation}>Elimina</Button>
        </DialogActions>
      </Dialog>

      {/* Conferma chiusura dialog locations */}
      <Dialog open={confirmCloseLocations} onClose={() => setConfirmCloseLocations(false)}>
        <DialogTitle>Attenzione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se chiudi ora, le modifiche ai luoghi non verranno salvate. Vuoi continuare?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCloseLocations(false)}>Annulla</Button>
          <Button color="error" onClick={handleConfirmCloseLocationsDialog}>Chiudi senza salvare</Button>
        </DialogActions>
      </Dialog>

      {/* Backdrop caricamento */}
      <Backdrop open={loading} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Snackbar messaggi */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

    </Box>

  );

}