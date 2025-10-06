import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser } from '../api/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  // Carica user da localStorage all'avvio
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const sub = payload.sub || {};
        setUser({
          id: sub.id,
          username: sub.username,
          role: sub.role?.toUpperCase(),
          gestore_cod: sub.gestore_cod,
          gestore_name: sub.gestore_name,
        });
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, []);

  // Login
  const login = async (username, password) => {
    const { access_token, refresh_token } = await loginUser(username, password);
    localStorage.setItem('token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    const payload = JSON.parse(atob(access_token.split('.')[1]));
    const sub = payload.sub || {};
    setUser({
      id: sub.id,
      username: sub.username,
      role: sub.role?.toUpperCase(),
      gestore_cod: sub.gestore_cod,
      gestore_name: sub.gestore_name,
    });
    console.log("User logged in: ", sub);
  };

  // Logout (usa logoutHandler.js)
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
