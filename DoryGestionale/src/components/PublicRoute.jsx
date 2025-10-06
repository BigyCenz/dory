import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // evita redirect prematuro

  return isAuthenticated ? <Navigate to="/home/dashboard" replace /> : children;
};

export default PublicRoute;
