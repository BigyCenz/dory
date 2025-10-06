import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Avatar, Typography, Divider, Toolbar } from '@mui/material';
import { Dashboard as DashboardIcon, Event as EventIcon, People as PeopleIcon, Logout as LogoutIcon, DeveloperBoard as DeveloperBoardIcon } from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

// Tema personalizzabile
const theme = createTheme({
  palette: {
    primary: { main: '#0d47a1' },       // blu principale
    secondary: { main: '#1976d2' },     // blu chiaro secondario
    background: { default: '#f4f6f8' }, // sfondo main content
    yellow: { main: '#e0a314'}          // colore giallo per icone lampadina
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

const DashboardLayout = () => {

  const { user, logout } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Voci della navbar laterale
  const menuItems = [
    { text: 'Cruscotto', icon: <DeveloperBoardIcon />, path: '/home/pannelli' },
    { text: 'Clienti', icon: <PeopleIcon />, path: '/home/clienti' },
    { text: 'Programmazione', icon: <EventIcon />, path: '/home/schedules' }
  ];

  return (

    <ThemeProvider theme={theme}>

      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        
        {/* Navbar laterale */}
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', bgcolor: 'primary.main', color: '#fff', }, }} >

          {/* Info utente */}
          <Toolbar sx={{ justifyContent: 'center', flexDirection: 'column', py: 4 }}>
            <Avatar src={user?.avatar || ''} sx={{ width: 64, height: 64, mb: 1, bgcolor: 'secondary.main' }} > {user?.username?.[0]?.toUpperCase()} </Avatar>
            <Typography variant="subtitle1" fontWeight="bold"> {user?.username || 'Utente'} </Typography>
            <Typography variant="subtitle2" fontWeight="light"> {user?.gestore_name || 'Gestore'} </Typography>
          </Toolbar>
          
          {/* Divider sotto info utente */}
          <Divider sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />

          {/* Voci del menu */}
          <List>

            {menuItems.map((item) => (

              <ListItemButton key={item.text} selected={location.pathname === item.path} onClick={() => navigate(item.path)} sx={{ '&.Mui-selected': { bgcolor: 'secondary.main', }, color: '#fff', mb: 1, borderRadius: 2, mx: 1, }} > 
                <ListItemIcon sx={{ color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            ))}

          </List>

          {/* Spacer per spingere il logout in basso */}
          <Box sx={{ flexGrow: 1 }} /> 
          
          {/* Logout */}
          <List>

            <ListItemButton onClick={logout} sx={{ color: '#fff', mb: 1, borderRadius: 2, mx: 1, }} >
              <ListItemIcon sx={{ color: 'inherit' }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>

          </List>
          
        </Drawer>

        {/* Contenuto principale */}
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Outlet />
        </Box>

      </Box>

    </ThemeProvider>

  );

};

export default DashboardLayout;
