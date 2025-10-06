import { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const Login = () => {

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { login } = useAuth();

  const navigate = useNavigate();

  // Gestione submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/home/pannelli');
    } catch {
      setError('Credenziali errate o errore di connessione');
    }
  };

  return (

    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center" }}>

      <Paper elevation={3} sx={{ p: 4, width: 360, maxWidth: "90%" }}>

        <Typography variant="h5" fontWeight="bold" align="center" mb={3}>Login</Typography>

        {error && (<Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>)}

        <form onSubmit={handleSubmit}>
          <TextField label="Username" variant="outlined" fullWidth margin="normal" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          <TextField label="Password" variant="outlined" fullWidth margin="normal" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Accedi</Button>
        </form>

      </Paper>

    </Box>

  );

};

export default Login;