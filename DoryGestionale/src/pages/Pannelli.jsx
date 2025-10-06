import { useState, useEffect } from 'react';
import { Box, TextField, Button, MenuItem, Select, InputLabel, FormControl, Typography, Grid, Card, CardContent, CardActions, IconButton, CircularProgress, Backdrop, Chip, Tooltip, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { Delete as DeleteIcon, Settings as SettingsIcon, ListAlt as LettureIcon, WbIncandescent as LampadinaIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { getModelli, createPannello, getPannelli, pingPannello, publishConfig, deletePannello } from '../api/pannelli';
import { getClienti } from '../api/clienti';
import { getLocations } from '../api/locations';
import PannelloConfig from './PannelloConfig';
import PannelloControl from './PannelloControl';
import PannelloReadings from './PannelloReadings';
import { useAuth } from '../context/AuthContext';

const SYNC_STATUS_COLORS = {
  SYNCED: 'success',
  PENDING: 'warning',
  ERROR: 'error'
};

const SYNC_STATUS_LABELS = {
  SYNCED: 'Configurazione aggiornata',
  PENDING: 'Modifiche in attesa di invio',
  ERROR: 'Errore invio configurazione'
};

const Pannelli = () => {

  const { user } = useAuth();

  // Stati del form
  const [panName, setPanName] = useState('');
  const [modCod, setModCod] = useState('');
  const [cliCod, setCliCod] = useState('');
  const [locCod, setLocCod] = useState('');

  const [clienti, setClienti] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modelli, setModelli] = useState([]);
  const [pannelli, setPannelli] = useState([]);
  const [loading, setLoading] = useState(false);

  const [openConfig, setOpenConfig] = useState(false);
  const [openControl, setOpenControl] = useState(false);
  const [openReadings, setOpenReadings] = useState(false);
  const [selectedPannello, setSelectedPannello] = useState(null);

  const [refreshing, setRefreshing] = useState({}); 
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [loadError, setLoadError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, panCod: null });

  // Caricamento modelli e clienti all'avvio
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          getModelli().then(setModelli),
          getClienti().then(setClienti),
          fetchPannelli()
        ]);
      } catch (err) {
        console.error(err);
        setSnackbar({ open: true, message: 'Errore nel caricamento dei dati', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [user.gestore_cod]);

  // Caricamento locations quando cambia il cliente
  useEffect(() => {
    if (cliCod) {
      setLoading(true);
      getLocations(cliCod)
        .then(data => {
          setLocations(data);
          setLocCod('');
        })
        .catch(err => {
          console.error(err);
          setSnackbar({ open: true, message: 'Errore nel caricamento delle locations', severity: 'error' });
        })
        .finally(() => setLoading(false));
    }
  }, [cliCod]);

  // Aggiornamento automatico ogni 5 minuti
  useEffect(() => {
    
    const interval = setInterval(() => {
      fetchPannelli();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user.gestore_cod]);

  // Caricamento pannelli dall'API
  const fetchPannelli = async () => {
    try {
      const data = await getPannelli();
      const now = new Date();
      const processedPannelli = data.map(pannello => ({
        ...pannello,
        ...getStatusInfo(pannello.last_update, pannello.online)
      }));
      setPannelli(processedPannelli);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      setPannelli([]);
    }
  };

  // Azione pulsante sincronizzazione pannello
  const handleSync = (pan_cod, sync_status) => {
    synchronize(pan_cod, sync_status);
  };

  // Azione pulsante creazione pannello
  const handleCreate = async () => {

    if (user.role !== 'GESTORE') return;

    if (!panName || !modCod || !cliCod || !locCod) {
      setSnackbar({ open: true, message: 'Compila tutti i campi!', severity: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const nuovo = await createPannello({
        pan_name: panName,
        mod_cod: modCod,
        cli_cod: cliCod,
        loc_cod: locCod
      });
      setSnackbar({ open: true, message: 'Pannello creato con successo!', severity: 'success' });
      setPanName(''); setModCod(''); setCliCod(''); setLocCod('');
      
      const newPannello = {
        ...nuovo,
        cliente_name: clienti.find(c => c.CLI_COD === cliCod)?.CLI_NAME,
        location_name: locations.find(l => l.LOC_COD === locCod)?.LOC_NAME,
        last_update: null,
        status: 'OFFLINE',
        last_update_display: 'Mai',
        isOnline: false
      };
      setPannelli(prev => [...prev, newPannello]);
      setSelectedPannello(newPannello);
      setOpenConfig(true);
    } catch (err) {
      setSnackbar({ open: true, message: 'Errore nella creazione del pannello', severity: 'error' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Azione pulsante apertura controllo pannello
  const handleOpenControl = (p) => {
    if (!p.isOnline) {
      //setSnackbar({ open: true, message: 'Il pannello è offline: controllo non disponibile.', severity: 'warning' });
      //return;
    }
    setSelectedPannello(p);
    setOpenControl(true);
  };

  // Sincronizzazione pannello (ping e publish se necessario)
  const synchronize = async (pan_cod, sync_status) => {
    setRefreshing(r => ({ ...r, [pan_cod]: true }));
    try {
      if (sync_status === 'PENDING') {
        try {
          await publishConfig(pan_cod);
        } catch (e) {
          setSnackbar({ open: true, message: 'Errore invio configurazione a ESP32', severity: 'warning' });
        }
      }
      await pingPannello(pan_cod);
      setTimeout(async () => {
        await fetchPannelli();
        setRefreshing(r => ({ ...r, [pan_cod]: false }));
      }, 5000);
    } catch (e) {
      setRefreshing(r => ({ ...r, [pan_cod]: false }));
    }
  };

  // Determina lo stato online/offline e formatta l'ultimo aggiornamento
  const getStatusInfo = (lastUpdate, online) => {

    let lastUpdateTime = null;

    if (lastUpdate) {
      const isoUtc = lastUpdate.endsWith("Z") ? lastUpdate : lastUpdate.replace(" ", "T") + "Z";
      lastUpdateTime = new Date(isoUtc);
    }

    const now = new Date();
    const diffMinutes = lastUpdateTime ? (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60) : null;
    const isOnline = !!online && lastUpdateTime && diffMinutes <= 5;

    return {
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      last_update_display: lastUpdateTime ? formatLastUpdate(lastUpdateTime) : 'Mai',
      isOnline
    };

  };

  // Formattazione data in ora locale italiana per visualizzazione
  const formatLastUpdate = (date) => {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Rome'
    }).format(date);
  };


  // Funzione per aprire il dialog di conferma eliminazione pannello
  const handleDeletePannello = (panCod) => {
    setConfirmDelete({ open: true, panCod });
  };

  // Funzione per confermare l'eliminazione del pannello
  const handleConfirmDeletePannello = async () => {
    setLoading(true);
    try {
      await deletePannello(confirmDelete.panCod);
      setSnackbar({ open: true, message: 'Pannello eliminato', severity: 'success' });
      await fetchPannelli();
    } catch (err) {
      setSnackbar({ open: true, message: 'Errore durante eliminazione pannello', severity: 'error' });
    } finally {
      setLoading(false);
      setConfirmDelete({ open: false, panCod: null });
    }
  };

  return (

    <Box sx={{ p: 3 }}>

      <Typography variant="h5" fontWeight="bold" gutterBottom>Nuovo Pannello</Typography>

      {/* Form per la creazione di un nuovo pannello */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>

        <TextField label="Nome Pannello" value={panName} onChange={e => setPanName(e.target.value)} variant="outlined" sx={{ minWidth: 200 }} />

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="modello-label">Modello</InputLabel>
          <Select labelId="modello-label" value={modCod} label="Modello" onChange={e => setModCod(e.target.value)}>
            {modelli.map(m => <MenuItem key={m.MOD_COD} value={m.MOD_COD}>{m.MOD_NAME}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="cliente-label">Cliente</InputLabel>
          <Select labelId="cliente-label" value={cliCod} label="Cliente" onChange={e => setCliCod(e.target.value)}>
            {clienti.map(c => <MenuItem key={c.CLI_COD} value={c.CLI_COD}>{c.CLI_NAME}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="location-label">Location</InputLabel>
          <Select labelId="location-label" value={locCod} label="Location" onChange={e => setLocCod(e.target.value)} disabled={!cliCod}>
            {locations.map(l => <MenuItem key={l.LOC_COD} value={l.LOC_COD}>{l.LOC_NAME}</MenuItem>)}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="primary"
          onClick={handleCreate}
          sx={{ minWidth: 150, height: 56 }}
        >
          Crea
        </Button>

      </Box>

      <Typography variant="h5"  fontWeight="bold" gutterBottom>Pannelli esistenti</Typography>

      {/* Messaggio errore caricamento pannelli */}
      {loadError && (<Alert severity="error" sx={{ mb: 2 }}>Errore nel caricamento dei pannelli.</Alert>)}

      {/* Nessun pannello */}
      {!loadError && pannelli.length === 0 && (<Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>Nessun pannello</Typography>)}

      {/* Grid per i pannelli esistenti */}
      <Grid container spacing={2}>

        {pannelli.map(p => (

          <Grid sx={{ width: '380px' }} item xs={12} sm={6} md={4} key={p.PAN_COD}> {/* Utile per responsive, togliere width... */}

            <Card>
                
              <CardContent>

                <Box sx={{ display: 'flex', justifyContent: 'flex-start'}}>

                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">{p.nome} ({p.PAN_COD})</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: 'auto', gap: 0.5 }}>

                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: p.isOnline ? 'green' : 'red' }} />

                    <Typography variant="subtitle1">{p.status === 'ONLINE' ? 'Online' : 'Offline'}</Typography>
                    <IconButton size="small" onClick={() => handleSync(p.PAN_COD, p.sync_status)} disabled={refreshing[p.PAN_COD]} style={{ marginLeft: 8, width: 32, height: 32 }} >
                      {refreshing[p.PAN_COD] ? <CircularProgress size={20} /> : <RefreshIcon />}
                    </IconButton>

                  </Box>

                </Box>

                {/* Stato sincronizzazione */}
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Tooltip title={SYNC_STATUS_LABELS[p.sync_status] || 'Stato sconosciuto'}>
                    <Chip
                      label={SYNC_STATUS_LABELS[p.sync_status] || p.sync_status || 'Sconosciuto'}
                      color={SYNC_STATUS_COLORS[p.sync_status] || 'default'}
                      size="small"
                    />
                  </Tooltip>
                </Box>

                <Typography variant="body2" color="textSecondary">Ultimo contatto: {p.last_update_display}</Typography>

                {/* Contenuto sotto (cliente/location) */}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">Cliente: {p.cliente_name}</Typography>
                  <Typography variant="body2">Location: {p.location_name}</Typography>
                  <Typography variant="body2">Firmware: {p.firmware_ver || "Sconosciuto"}</Typography>
                </Box>

              </CardContent>

              <CardActions sx={{ justifyContent: 'flex-end' }}>
                <IconButton color="error" onClick={() => handleDeletePannello(p.PAN_COD)} disabled={user.role !== 'GESTORE'}>
                  <DeleteIcon />
                </IconButton>
                <IconButton color="primary" onClick={() => { setSelectedPannello(p); setOpenReadings(true); }}>
                  <LettureIcon />
                </IconButton>
                <IconButton
                  color="yellow"
                  onClick={() => handleOpenControl(p)}
                  disabled={user.role === 'OSSERVATORE'}
                >
                  <LampadinaIcon />
                </IconButton>
                <IconButton
                  color="secondary"
                  onClick={() => { setSelectedPannello(p); setOpenConfig(true); }}
                  disabled={user.role !== 'GESTORE'}
                >
                  <SettingsIcon />
                </IconButton>
              </CardActions>

            </Card>

          </Grid>

        ))}

      </Grid>

      {selectedPannello && (
        <PannelloConfig
          pannello={selectedPannello}
          open={openConfig}
          onClose={() => setOpenConfig(false)}
          onSave={(msg, severity = 'success') => setSnackbar({ open: true, message: msg, severity })}
          synchronize={(pan_cod) => synchronize(pan_cod, "PENDING")}
        />
      )}

      {/* Dialog configurazione pannello */}
      {selectedPannello && ( <PannelloControl pannello={selectedPannello} open={openControl} onClose={() => setOpenControl(false)} /> )}

      {/* Dialog letture pannello */}
      {selectedPannello && ( <PannelloReadings pannello={selectedPannello} open={openReadings} onClose={() => setOpenReadings(false)} /> )}

      {/* Dialog conferma eliminazione pannello */}
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false, panCod: null })}>
        <DialogTitle>Conferma eliminazione pannello</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questo pannello? L'operazione non è reversibile e tutti i dati associati verranno cancellati.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete({ open: false, panCod: null })}>Annulla</Button>
          <Button color="error" onClick={handleConfirmDeletePannello}>Elimina</Button>
        </DialogActions>
      </Dialog>

      {/* Backdrop caricamento */}
      <Backdrop open={loading} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} >
        
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>

      </Snackbar>

    </Box>
    

  );

};

export default Pannelli;