import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DashboardLayout from './pages/DashboardLayout.jsx';
import Clienti from './pages/Clienti.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { AuthProvider } from './context/AuthContext';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Pannelli from './pages/Pannelli.jsx';
import Schedules from './pages/Schedules.jsx';



const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicRoute><App/></PublicRoute>,
  },
  {
    path: '/home',
    element: <ProtectedRoute><DashboardLayout/></ProtectedRoute>,
    children: [
      { path: 'clienti', element: <Clienti /> },
      { path: 'pannelli', element: <Pannelli /> },
      { path: 'schedules', element: <Schedules /> }
    ]
  }
]);


createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);

