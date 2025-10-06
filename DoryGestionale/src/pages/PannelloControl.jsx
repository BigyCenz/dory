import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, Switch, Slider, Button, Box, Typography, CircularProgress, Backdrop, } from '@mui/material';
import { getPortePannello, controlPort } from '../api/pannelli';
import { useAuth } from '../context/AuthContext';

export default function PannelloControl({ open, onClose, pannello }) {

  const { user } = useAuth();

  // Stato componenti
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Carica porte in modalità manuale e output
  useEffect(() => {

    if (!open) {
      setPorts([]);
      return;
    }

    const fetchPorts = async () => {
      setLoading(true);
      try {
        const data = await getPortePannello(pannello.PAN_COD);

        // Filtra solo output in modalità manuale
        const manualOutPorts = data.filter(
          p => p.TYPE.endsWith('OUT') && p.MAN == true
        );
        setPorts(manualOutPorts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPorts();
  }, [open, pannello.PAN_COD]);

  // Gestione cambio stato switch digitale
  const handleDigitalToggle = async (idx) => {
    const newPorts = [...ports];
    newPorts[idx].LAST_VAL = newPorts[idx].LAST_VAL === 0 ? 1 : 0;
    setPorts(newPorts);

    setLoading(true);
    try {
      await controlPort(pannello.PAN_COD, {
        address: newPorts[idx].ADDR,
        pin: newPorts[idx].PRT,
        value: newPorts[idx].LAST_VAL,
        save: true
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Gestione cambio stato slider analogico (locale)
  const handleAnalogChange = (idx, value) => {
    const newPorts = [...ports];
    newPorts[idx].LAST_VAL = value;
    setPorts(newPorts);
  };

  // Gestione cambio stato slider analogico (a slider rilasciato invia comando)
  const handleAnalogCommit = async (idx) => {
    setLoading(true);
    try {
      await controlPort(pannello.PAN_COD, {
        address: ports[idx].ADDR,
        pin: ports[idx].PRT,
        value: ports[idx].LAST_VAL,
        save: true
      });

    
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };




  return (

    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

      <DialogTitle>Controllo Porte Manuali</DialogTitle>

      <DialogContent>

        <List>

          {ports.map((p, idx) => (
            
            <ListItem key={`${p.MOD_EXP}-${p.ADDR}-${p.PRT}`} divider>

              <ListItemText
                primary={`${p.TITLE} (${p.MODEL_NAME} - ${p.PRT})`}
                secondary={`Indirizzo I2C: ${p.ADDR}`}
              />

              <Box sx={{ width: 200, ml: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>

                {p.TYPE.startsWith('DIGITAL') ? (
                  <>
                    <Typography variant="body2">OFF</Typography>
                    <Switch checked={p.LAST_VAL === 1} onChange={() => handleDigitalToggle(idx)}/>
                    <Typography variant="body2">ON</Typography>
                  </>
                 
                ) : (
                  <Slider
                    value={p.LAST_VAL || 0}
                    onChange={(e, val) => handleAnalogChange(idx, val)}
                    onChangeCommitted={() => handleAnalogCommit(idx)}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                  />
                )}
              </Box>

            </ListItem>
          ))}

          {ports.length == 0 && (
            <Typography variant="body2" sx={{ p: 2 }}>
              Nessuna porta manuale in output
            </Typography>
          )}

        </List>

      </DialogContent>

      {/* Backdrop caricamento */}
      <Backdrop open={loading} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Chiudi</Button>
      </DialogActions>

    </Dialog>

  );

}
