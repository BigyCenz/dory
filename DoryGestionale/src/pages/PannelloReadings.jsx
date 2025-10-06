import { useState, useEffect } from 'react';
import { Dialog, Alert, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, TextField, Grid, Card, CardContent, CardHeader, CircularProgress, Backdrop, Pagination } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getLetturePannello } from '../api/letture';

const PannelloReadings = ({ pannello, open, onClose }) => {

  const [loading, setLoading] = useState(false);
  const [readings, setReadings] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const chartsPerPage = 4;
  const totalPages = Math.ceil(readings.length / chartsPerPage);
  const startIndex = (currentPage - 1) * chartsPerPage;
  const currentCharts = readings.slice(startIndex, startIndex + chartsPerPage);

  // Inizializza le date (ultima settimana)
  useEffect(() => {
    if (open) {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateTo(today.toISOString().split('T')[0]);
      setDateFrom(weekAgo.toISOString().split('T')[0]);
      setCurrentPage(1);
      setReadings([]);
    }
  }, [open, pannello?.PAN_COD]);

  // Carica le letture quando cambiano le date
  useEffect(() => {
    if (open && dateFrom && dateTo && pannello?.PAN_COD) {
      // Per includere tutta la data di fine, aggiungi 1 giorno a dateTo e invia come range esclusivo
      const dateToInclusive = new Date(dateTo);
      dateToInclusive.setDate(dateToInclusive.getDate() + 1);
      const dateToStr = dateToInclusive.toISOString().split('T')[0];
      fetchReadings(dateFrom, dateToStr);
    }
    // eslint-disable-next-line
  }, [open, dateFrom, dateTo, pannello?.PAN_COD]);

  // Caricamento letture
  const fetchReadings = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const data = await getLetturePannello(pannello.PAN_COD, from, to);
      setReadings(data);
    } catch (err) {
      setReadings([]);
    } finally {
      setLoading(false);
    }
  };

  // Formatta titolo grafico
  const formatPortTitle = (port) => {
    let title = `${port.MODEL_NAME || ''} - ${port.NAME || ''}`;
    if (port.TITLE) title += ` (${port.TITLE})`;
    return title;
  };

  // Gestione cambio date
  const handleDateChange = () => {
    if (dateFrom && dateTo) {
      setCurrentPage(1);
      // Per includere tutta la data di fine, aggiungi 1 giorno
      const dateToInclusive = new Date(dateTo);
      dateToInclusive.setDate(dateToInclusive.getDate() + 1);
      const dateToStr = dateToInclusive.toISOString().split('T')[0];
      fetchReadings(dateFrom, dateToStr);
    }
  };




  return (

    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>

      <DialogTitle>Letture pannello: {pannello.nome}</DialogTitle>

      <DialogContent>

        {/* Avviso se offline */}
        {!pannello.isOnline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Il pannello è offline: le letture potrebbero non essere aggiornate o disponibili.
          </Alert>
        )}

        {/* Selettori di tempo */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', mt: 2 }}>

          <TextField
            type="date"
            label="Data inizio"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />

          <TextField
            type="date"
            label="Data fine"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />

          <Button variant="outlined" onClick={handleDateChange}>Aggiorna</Button>

        </Box>

        {/* Paginazione superiore */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(e, page) => setCurrentPage(page)}
              color="primary"
            />
          </Box>
        )}

        {/* Grafici */}
        <Grid container spacing={3}>

          {currentCharts.map((port, index) => (

            <Grid item xs={12} md={6} key={`${port.MODEL_NAME}-${port.NAME}-${port.PRT}-${index}`}>

              <Card>

                <CardHeader title={formatPortTitle(port)} titleTypographyProps={{ variant: 'h6', fontSize: '1rem' }} sx={{ pb: 1 }} />

                <CardContent sx={{ pt: 0 }}>

                  <Box sx={{ width: 350, height: 350, mx: 'auto' }}>

                    <ResponsiveContainer width="100%" height="100%">

                      <LineChart data={port.data} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>

                        <CartesianGrid strokeDasharray="3 3" />

                        <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} interval="preserveStartEnd" >
                          <text x={175} y={330} textAnchor="middle" dominantBaseline="hanging" fontSize={12} fill="#666">Tempo</text>
                        </XAxis>

                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} label={{ value: 'Valore', angle: -90, position: 'insideLeft', fontSize: 12 }}/>
                       
                        <Tooltip labelFormatter={(value) => `Tempo: ${value}`} formatter={(value) => [value, '']}/>

                        <Line type="monotone" dataKey="value" stroke="#2196f3" strokeWidth={2} dot={false}/>

                      </LineChart>

                    </ResponsiveContainer>

                  </Box>

                </CardContent>

              </Card>

            </Grid>

          ))}

        </Grid>

        {/* Messaggio se non ci sono dati */}
        {readings.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="textSecondary">
              Nessuna lettura disponibile per il periodo selezionato
            </Typography>
          </Box>
        )}

        {/* Paginazione inferiore */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(e, page) => setCurrentPage(page)}
              color="primary"
            />
          </Box>
        )}
      </DialogContent>

      {/* Backdrop caricamento */}
      <Backdrop open={loading} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>

    </Dialog>

  );

};

export default PannelloReadings;