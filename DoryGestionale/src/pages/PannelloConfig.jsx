import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, TextField, MenuItem, Typography, CircularProgress, Backdrop, Snackbar, Alert, FormControl, InputLabel, Select, Dialog as MuiDialog, DialogContentText } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { getEspansioni, getEspansioniPannello, addEspansionePannello, removeEspansionePannello } from '../api/espansioni'; 
import { getPorteDisponibili, getPortePannello, savePortePannello, updatePannello } from '../api/pannelli';
import { getSchedules } from '../api/schedules';
import { getClienti } from '../api/clienti';
import { getLocations } from '../api/locations';
import { useAuth } from '../context/AuthContext';

const PannelloConfig = ({ pannello, open, onClose, onSave, synchronize }) => {

  // Utenza
  const { user } = useAuth();

  // Generali
  const [panelName, setPanelName] = useState('');
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [clienti, setClienti] = useState([]);
  const [locations, setLocations] = useState([]);
  const [activeTab, setActiveTab] = useState('generali');

  // Espansioni
  const [availableExp, setAvailableExp] = useState([]);
  const [panelExp, setPanelExp] = useState([]);
  const [selectedExp, setSelectedExp] = useState('');
  const [i2cAddr, setI2cAddr] = useState('');

  // Porte
  const [availablePorts, setAvailablePorts] = useState([]);
  const [panelPorts, setPanelPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState(null);
  const [selectedPortTitle, setSelectedPortTitle] = useState('');

  // Calendari
  const [schedules, setSchedules] = useState([]);

  // Conferma
  const [confirmDeletePort, setConfirmDeletePort] = useState({ open: false, port: null });
  const [confirmDeleteExp, setConfirmDeleteExp] = useState({ open: false, exp_cod: null, addr: null });
  const [confirmClose, setConfirmClose] = useState(false);

  // Caricamenti e messaggi
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // Caricamento iniziale
  useEffect(() => {

    if (!open) {
      setActiveTab('generali');
      return;
    }

    // Pulizia dati precedenti
    setAvailableExp([]);
    setPanelExp([]);
    setSelectedExp('');
    setI2cAddr('');
    setPanelName('');
    setSelectedCliente('');
    setSelectedLocation('');
    setClienti([]);
    setLocations([]);

    const fetchData = async () => {

      setLoading(true);

      try {

        // Dati generali
        setPanelName(pannello.nome);

        // Carica clienti
        const clientiData = await getClienti();
        setClienti(clientiData);

        // Imposta cliente selezionato dal DB (attenzione: tipo stringa/numero)
        let cliCod = pannello.cliente_cod !== undefined && pannello.cliente_cod !== null
          ? String(pannello.cliente_cod)
          : (clientiData.length > 0 ? String(clientiData[0].CLI_COD) : '');
        setSelectedCliente(cliCod);

        // Carica locations se c'è un cliente
        let locationsData = [];
        if (cliCod) {
          locationsData = await getLocations(cliCod); // CORRETTO: passa cli_cod
          setLocations(locationsData);
        } else {
          setLocations([]);
        }

        // Imposta location selezionata dal DB (attenzione: tipo stringa/numero)
        let locCod = pannello.location_cod !== undefined && pannello.location_cod !== null
          ? String(pannello.location_cod)
          : (locationsData.length > 0 ? String(locationsData[0].LOC_COD) : '');
        setSelectedLocation(locCod);

        // Dati di tutte le espansioni
        const allExp = await getEspansioni();
        setAvailableExp(allExp);

        // Dati espansioni associate al pannello
        const panelE = await getEspansioniPannello(pannello.PAN_COD);
        setPanelExp(panelE);

      } catch (err) {
        console.error(err);
        showMessage("Errore nel caricamento dati", "error");
      } finally {
        setLoading(false);
      }

    };

    fetchData();

  }, [open, pannello.PAN_COD, user.gestore_cod]);

  // Caricamento porte quando si apre o cambia pannello
  useEffect(() => {

    if (!open) return;

    // Pulisci i dati precedenti delle porte
    setAvailablePorts([]);
    setPanelPorts([]);
    setSelectedPort(null);
    setSchedules([]);

    const fetchPorte = async () => {

      setLoading(true);

      try {

        const allPorts = await getPorteDisponibili(pannello.PAN_COD);
        const enabled = await getPortePannello(pannello.PAN_COD);

        // Filtra le porte disponibili rimuovendo quelle già abilitate
        const filteredPorts = allPorts.filter(ap =>
          !enabled.some(ep =>
            ep.SRC === ap.SRC &&
            ep.MOD_EXP === ap.MOD_EXP &&
            ep.ADDR === ap.ADDR &&
            ep.PRT === ap.PRT
          )
        );

        // Ordina le porte: prima modelli, poi espansioni, dentro ciascun gruppo per nome
        const sortedPorts = sortPorte(filteredPorts);
        setAvailablePorts(sortedPorts);
        setPanelPorts(enabled);

        const sch = await getSchedules();
        setSchedules(sch);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPorte();

  }, [open, pannello.PAN_COD]);

  // Caricamento locations quando cambia cliente
  useEffect(() => {
    if (selectedCliente && open) {
      const fetchLocations = async () => {
        try {
          const locationsData = await getLocations(selectedCliente);
          setLocations(locationsData);

          // Reset location se non più valida
          if (selectedLocation && !locationsData.find(l => String(l.LOC_COD) === String(selectedLocation))) {
            setSelectedLocation('');
          }
        } catch (err) {
          console.error(err);
          showMessage("Errore nel caricamento locations", "error");
        }
      };
      fetchLocations();
    } else {
      setLocations([]);
      setSelectedLocation('');
    }
  }, [selectedCliente, open]);

  // Cambio modalità manuale/automatica
  const handleChangePort = (idx, field, value) => {
    setPanelPorts(prev => {
      const updated = [...prev];
      if (field === 'MAN') {
        updated[idx][field] = value === true || value === 'Manuale';
        // Se passo a manuale, azzera schedule
        if (updated[idx][field]) updated[idx]['SCH'] = null;
      } else {
        updated[idx][field] = value;
      }
      return updated;
    });
  };

  // Aggiungi Porta: no nomi duplicati, no nomi vuoti, warning se errore
  const handleAddPort = () => {
    
    if (!selectedPort) {
      showMessage("Seleziona una porta da aggiungere", "warning");
      return;
    }
    // evita duplicati
    const exists = panelPorts.some(p =>
      p.SRC === selectedPort.SRC &&
      p.MOD_EXP === selectedPort.MOD_EXP &&
      p.ADDR === selectedPort.ADDR &&
      p.PRT === selectedPort.PRT
    );
    if (exists) {
      showMessage("Porta già aggiunta", "warning");
      return;
    }
    // nome obbligatorio e non vuoto
    if (!selectedPortTitle || !selectedPortTitle.trim()) {
      showMessage("Inserisci un nome per la porta", "warning");
      return;
    }
    // evita nomi duplicati (case insensitive, ignora vuoti)
    if (
      selectedPortTitle &&
      panelPorts.some(
        p => p.TITLE && p.TITLE.trim().toLowerCase() === selectedPortTitle.trim().toLowerCase()
      )
    ) {
      showMessage("Nome porta già utilizzato", "warning");
      return;
    }
    // default manuale per output
    let newPort = { ...selectedPort, MAN: null, SCH: null, TITLE: selectedPortTitle };
    if (selectedPort.TYPE && selectedPort.TYPE.endsWith('OUT')) {
      newPort.MAN = true;
    }
    setPanelPorts([
      ...panelPorts,
      newPort
    ]);
    const filteredPorts = availablePorts.filter(p => !(p.SRC === selectedPort.SRC && p.MOD_EXP === selectedPort.MOD_EXP && p.ADDR === selectedPort.ADDR && p.PRT === selectedPort.PRT));
    const sortedPorts = sortPorte(filteredPorts);
    setAvailablePorts(sortedPorts);
    setSelectedPort(null);
    setSelectedPortTitle('');
  };

  // Azione pulsante eliminazione porta
  const handleRemovePort = (port) => {
    setConfirmDeletePort({ open: true, port });
  };

  // Azione pulsante conferma eliminazione porta
  const confirmRemovePort = () => {
    const port = confirmDeletePort.port;
    setPanelPorts(panelPorts.filter(p =>
      !(p.SRC === port.SRC && p.MOD_EXP === port.MOD_EXP && p.ADDR === port.ADDR && p.PRT === port.PRT)
    ));
    const sortedPorts = sortPorte(availablePorts.concat(port));
    setAvailablePorts(sortedPorts);
    setConfirmDeletePort({ open: false, port: null });
  };

  // Espansioni: warning se campi non validi, fix allineamento bottone
  const handleAddExp = () => {
    if (!selectedExp) {
      showMessage("Seleziona un modello di espansione", "warning");
      return;
    }
    if (!i2cAddr || isNaN(parseInt(i2cAddr)) || parseInt(i2cAddr) <= 0) {
      showMessage("Inserisci un indirizzo I2C valido (>0)", "warning");
      return;
    }
    const addr = parseInt(i2cAddr);
    // Duplicato tra espansioni già aggiunte (modello+indirizzo)
    const exists = panelExp.some(pe => pe.EXP_COD === selectedExp && parseInt(pe.i2cAddr) === addr);
    if (exists) {
      showMessage("Espansione già aggiunta con questo indirizzo", "warning");
      return;
    }
    // Duplicato indirizzo tra tutte le espansioni
    if (panelExp.some(pe => parseInt(pe.i2cAddr) === addr)) {
      showMessage("Indirizzo I2C già utilizzato da un'altra espansione", "warning");
      return;
    }
    // Duplicato indirizzo tra le porte già configurate (porte_modelli)
    if (panelPorts.some(p => p.ADDR === addr)) {
      showMessage("Indirizzo I2C già utilizzato da una porta", "warning");
      return;
    }
    const exp = availableExp.find(e => e.EXP_COD === selectedExp);
    if (!exp) return;
    setPanelExp([...panelExp, { ...exp, i2cAddr: addr }]);
    setSelectedExp('');
    setI2cAddr('');
    showMessage("Espansione aggiunta", "success");
  };

  // Azione pulsante eliminazione espansione
  const handleRemoveExp = (exp_cod, addr) => {
    setConfirmDeleteExp({ open: true, exp_cod, addr });
  };

  // Azione pulsante conferma eliminazione espansione
  const confirmRemoveExp = () => {
    // Rimuovi espansione
    const exp_cod = confirmDeleteExp.exp_cod;
    const addr = parseInt(confirmDeleteExp.addr);
    setPanelExp(panelExp.filter(pe => !(pe.EXP_COD === exp_cod && parseInt(pe.i2cAddr) === addr)));
    // Rimuovi anche tutte le porte collegate a questa espansione
    setPanelPorts(panelPorts.filter(p => !(p.SRC === 'EXP' && p.MOD_EXP === exp_cod && p.ADDR === addr)));
    setConfirmDeleteExp({ open: false, exp_cod: null, addr: null });
  };

  // Chiusura dialog
  const handleClose = () => {
    setConfirmClose(true);
  };

  // Conferma chiusura dialog
  const confirmCloseDialog = () => {
    setConfirmClose(false);
    onClose();
  };

  // Salva configurazione
  const handleSave = async () => {

    // Controllo: porte output in automatico senza schedule
    const autoNoSchedule = panelPorts.filter(
      p => p.TYPE && p.TYPE.endsWith('OUT') && p.MAN === false && (!p.SCH || isNaN(p.SCH))
    );
    if (autoNoSchedule.length > 0) {
      showMessage("Alcune porte in modalità automatica non hanno uno schedule selezionato.", "warning");
      return;
    }

    setLoading(true);
    try {
      // Salva dati generali pannello
      await updatePannello(pannello.PAN_COD, {
        pan_name: panelName,
        cli_cod: selectedCliente,
        loc_cod: selectedLocation
      });

      // Recupera le espansioni attuali sul DB
      const currentExp = await getEspansioniPannello(pannello.PAN_COD);

      // Determina aggiunte e rimozioni
      const toAdd = panelExp.filter(pe =>
        !currentExp.some(ce => ce.EXP_COD === pe.EXP_COD && ce.i2cAddr === pe.i2cAddr)
      );

      const toRemove = currentExp.filter(ce =>
        !panelExp.some(pe => pe.EXP_COD === ce.EXP_COD && pe.i2cAddr === ce.i2cAddr)
      );

      // Chiamate API
      for (const exp of toAdd) {
        await addEspansionePannello(pannello.PAN_COD, exp.EXP_COD, exp.i2cAddr);
      }

      for (const exp of toRemove) {
        await removeEspansionePannello(pannello.PAN_COD, exp.EXP_COD, exp.i2cAddr);
      }

      // Salvataggio porte pannello
      await savePortePannello(pannello.PAN_COD, panelPorts);

      // Invece di publishConfig, chiama synchronize se fornita
      await synchronize(pannello.PAN_COD, pannello.sync_status);
      if (onSave) onSave("Configurazione salvata e inviata a ESP32", "success");
      onClose(); // chiudi dialog
    } catch (err) {
      console.error(err);
      if (onSave) onSave("Errore durante il salvataggio", "error");
    } finally {
      setLoading(false);
    }

  };

  // Funzione di ordinamento porte: prima modelli, poi espansioni, dentro ciascun gruppo per nome
  function sortPorte(ports) {
    return [...ports].sort((a, b) => {
      // Prima MOD poi EXP
      if (a.SRC !== b.SRC) {
        return a.SRC === 'MOD' ? -1 : 1;
      }
      // Dentro ciascun gruppo, ordina per NAME
      return a.NAME.localeCompare(b.NAME);
    });
  }

  // Mostra snackbar
  const showMessage = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  // Rendering del contenuto in base al tab attivo
  const renderContent = () => {

    switch (activeTab) {

      case 'generali':

        return (
          <Box>

            <Typography variant="subtitle1" gutterBottom>Informazioni Generali</Typography>
            
            {/* Informazioni generali pannello */}
            <Box sx={{ display: 'grid', gap: 3, mt: 2 }}>

              <TextField fullWidth label="Nome Pannello" value={panelName} onChange={(e) => setPanelName(e.target.value)} variant="outlined" />

              {/* Seleziona cliente */}
              <FormControl fullWidth>

                <InputLabel>Cliente</InputLabel>

                <Select value={selectedCliente} label="Cliente" onChange={(e) => setSelectedCliente(e.target.value)} >

                  <MenuItem value=""><em>Seleziona cliente</em></MenuItem>

                  {clienti.map((c) => (
                    <MenuItem key={c.CLI_COD} value={String(c.CLI_COD)}>{c.CLI_NAME}</MenuItem>
                  ))}

                </Select>

              </FormControl>

              {/* Seleziona location */}
              <FormControl fullWidth disabled={!selectedCliente}>

                <InputLabel>Location</InputLabel>

                <Select value={selectedLocation} label="Location" onChange={(e) => setSelectedLocation(e.target.value)} >

                  <MenuItem value=""><em>Seleziona location</em></MenuItem>

                  {locations.map((l) => (
                    <MenuItem key={l.LOC_COD} value={String(l.LOC_COD)}>
                      {l.LOC_NAME}
                    </MenuItem>
                  ))}

                </Select>

              </FormControl>

            </Box>

            {/* Messaggio informativo */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText' }}>
              <Typography variant="body2">
                💡 Le modifiche verranno salvate premendo il pulsante "Salva" in basso.
              </Typography>
            </Box>

          </Box>
        );

      case 'porte':

        return (

          <Box>
            
            <Typography variant="subtitle1" gutterBottom>Aggiungi Porta</Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>

              <TextField
                select
                label="Porta"
                value={selectedPort ? JSON.stringify(selectedPort) : ''}
                onChange={e => setSelectedPort(JSON.parse(e.target.value))}
                sx={{ minWidth: 250 }}
                size="medium"
              >
                {availablePorts.map((p, idx) => (
                  <MenuItem key={idx} value={JSON.stringify(p)}>
                    {p.NAME} {p.SRC === 'EXP' ? `(${p.MODEL_NAME} - ${p.ADDR})` : ''}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Nome personalizzato"
                size="medium"
                value={selectedPortTitle}
                onChange={e => setSelectedPortTitle(e.target.value)}
                sx={{ width: 180 }}
                disabled={!selectedPort}
              />

              <Button variant="contained" onClick={handleAddPort} sx={{ minWidth: 120, fontWeight: 600 }} size="medium">Aggiungi</Button>

            </Box>

            <Typography variant="subtitle1" gutterBottom>Porte esistenti</Typography>

            <List>
            
              {panelPorts.map((port, idx) => (

                <ListItem key={idx} divider>

                  <ListItemText
                    primary={`${port.MODEL_NAME} - ${port.NAME}${port.TITLE ? ' (' + port.TITLE + ')' : ''}`}
                    secondary={`Indirizzo: ${port.ADDR || 'Nessuno'} | Porta: ${port.PRT} | Tipo: ${port.TYPE}`}
                  />

                  {/* Modalità (solo se output) */}
                  {port.TYPE.endsWith('OUT') && (
                    <TextField
                      select
                      label="Modalità"
                      value={port.MAN !== null ? (port.MAN ? 'Manuale' : 'Automatico') : ''}
                      onChange={e => handleChangePort(idx, 'MAN', e.target.value === 'Manuale')}
                      sx={{ width: 130, mr: 2 }}
                    >
                      <MenuItem value="Manuale">Manuale</MenuItem>
                      <MenuItem value="Automatico">Automatico</MenuItem>
                    </TextField>
                  )}

                  {/* Schedule (solo se output e Automatico) */}
                  {port.TYPE.endsWith('OUT') && port.MAN == false && (
                    <TextField
                      select
                      label="Schedule"
                      value={port.SCH || ''}
                      onChange={e => handleChangePort(idx, 'SCH', parseInt(e.target.value))}
                      sx={{ minWidth: 150, mr: 2 }}
                    >
                      {schedules.map(s => (
                        <MenuItem key={s.SCH_COD} value={s.SCH_COD}>{s.SCH_NAME}</MenuItem>
                      ))}
                    </TextField>
                  )}

                  <ListItemSecondaryAction>
                    <IconButton edge="end" color="error" onClick={() => handleRemovePort(port)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>

                </ListItem>

              ))}

              {panelPorts.length === 0 && <Typography variant="body2">Nessuna porta abilitata</Typography>}

            </List>

          </Box>

        );

      case 'espansioni':

        return (

          <Box>

            <Typography variant="subtitle1" gutterBottom>Aggiungi Espansione</Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 4 }}>

              <TextField
                select
                label="Espansione"
                value={selectedExp}
                onChange={e => setSelectedExp(parseInt(e.target.value))}
                sx={{ minWidth: 200 }}
              >
                {availableExp.map(e => (
                  <MenuItem key={e.EXP_COD} value={e.EXP_COD}>{e.EXP_NAME}</MenuItem>
                ))}
              </TextField>

              <TextField
                label="Indirizzo I2C"
                value={i2cAddr}
                onChange={e => setI2cAddr(e.target.value)}
                sx={{ width: 120 }}
              />

              <Button variant="contained" onClick={handleAddExp} sx={{ minWidth: 120, fontWeight: 600 }} size="medium">Aggiungi</Button>

            </Box>

            <Typography variant="subtitle1" gutterBottom>Espansioni aggiunte</Typography>

            <List>

              {panelExp.map((exp, idx) => (

                <ListItem key={idx} divider>

                  <ListItemText
                    primary={exp.EXP_NAME}
                    secondary={`I2C: ${exp.i2cAddr}`}
                  />

                  <ListItemSecondaryAction>
                    <IconButton edge="end" color="error" onClick={() => handleRemoveExp(exp.EXP_COD, exp.i2cAddr)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>

                </ListItem>
              ))}

              {panelExp.length === 0 && <Typography variant="body2">Nessuna espansione aggiunta</Typography>}

            </List>

          </Box>

        );
        
      default:
        return null;
    }
  };




  return (

    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>

      <DialogTitle>Configura Pannello: {pannello.nome}</DialogTitle>

      <DialogContent>

        <Box sx={{ display: 'flex', height: 450 }}>

          {/* Sidebar */}
          <Box sx={{ width: 150, borderRight: '1px solid #ddd', bgcolor: 'background.paper' }}>

            <List sx={{ p: 0 }}>

              <ListItem 
                button 
                selected={activeTab === 'generali'} 
                onClick={() => setActiveTab('generali')}
                sx={{
                  bgcolor: activeTab === 'generali' ? 'primary.main' : 'background.paper',
                  color: activeTab === 'generali' ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: activeTab === 'generali' ? 'primary.dark' : 'action.hover',
                  }
                }}
              >

                <ListItemText primary="Generali" />

              </ListItem>

              <ListItem 
                button 
                selected={activeTab === 'porte'} 
                onClick={() => setActiveTab('porte')}
                sx={{
                  bgcolor: activeTab === 'porte' ? 'primary.main' : 'background.paper',
                  color: activeTab === 'porte' ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: activeTab === 'porte' ? 'primary.dark' : 'action.hover',
                  }
                }}
              >
                <ListItemText primary="Porte" />
              </ListItem>
              <ListItem 
                button 
                selected={activeTab === 'espansioni'} 
                onClick={() => setActiveTab('espansioni')}
                sx={{
                  bgcolor: activeTab === 'espansioni' ? 'primary.main' : 'background.paper',
                  color: activeTab === 'espansioni' ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: activeTab === 'espansioni' ? 'primary.dark' : 'action.hover',
                  }
                }}
              >
                <ListItemText primary="Espansioni" />
              </ListItem>
            </List>

          </Box>

          {/* Contenuto principale */}
          <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
            {renderContent()}
          </Box>

        </Box>

      </DialogContent>

      {/* Backdrop caricamento */}
      <Backdrop open={loading} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <DialogActions>
        <Button onClick={handleClose}>Chiudi</Button>
        <Button variant="contained" onClick={handleSave} disabled={user.role !== 'GESTORE'}>Salva</Button>
      </DialogActions>

      {/* Conferma eliminazione porta */}
      <MuiDialog open={confirmDeletePort.open} onClose={() => setConfirmDeletePort({ open: false, port: null })}>

        <DialogTitle>Conferma eliminazione porta</DialogTitle>

        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questa porta?
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmDeletePort({ open: false, port: null })}>Annulla</Button>
          <Button color="error" onClick={confirmRemovePort}>Elimina</Button>
        </DialogActions>

      </MuiDialog>

      {/* Conferma eliminazione espansione */}
      <MuiDialog open={confirmDeleteExp.open} onClose={() => setConfirmDeleteExp({ open: false, exp_cod: null, addr: null })}>

        <DialogTitle>Conferma eliminazione espansione</DialogTitle>

        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questa espansione? Verranno eliminate anche tutte le porte associate a questa espansione. L'operazione non è reversibile.
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmDeleteExp({ open: false, exp_cod: null, addr: null })}>Annulla</Button>
          <Button color="error" onClick={confirmRemoveExp}>Elimina</Button>
        </DialogActions>

      </MuiDialog>

      {/* Conferma chiusura dialog */}
      <MuiDialog open={confirmClose} onClose={() => setConfirmClose(false)}>

        <DialogTitle>Attenzione</DialogTitle>

        <DialogContent>
          <DialogContentText>
            Se chiudi ora, le modifiche non verranno salvate. Vuoi continuare?
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmClose(false)}>Annulla</Button>
          <Button color="error" onClick={confirmCloseDialog}>Chiudi senza salvare</Button>
        </DialogActions>

      </MuiDialog>

      {/* Snackbar messaggi */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </Dialog>

  );
  
};

export default PannelloConfig;