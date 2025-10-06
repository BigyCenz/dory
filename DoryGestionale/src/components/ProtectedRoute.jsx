import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null; // oppure un loader
  if (!user) return <Navigate to="/" />;
  return children;
}