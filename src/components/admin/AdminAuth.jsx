import React, { useState, useEffect } from 'react';
import Login from './Login';
import AdminPanel from './AdminPanel';

export default function AdminAuth() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch(import.meta.env.PUBLIC_API_URL + '/auth.php', {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(data.authenticated);
        setUserId(data.user_id);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setUserId(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch(import.meta.env.PUBLIC_API_URL + '/auth.php', {
        method: 'DELETE',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setUserId(null);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  }

  function handleLoginSuccess(id) {
    setIsAuthenticated(true);
    setUserId(id);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-400">Verificando autenticación...</p>
      </div>
    );
  }

  return isAuthenticated ? (
    <AdminPanel onLogout={handleLogout} userId={userId} />
  ) : (
    <Login onLoginSuccess={handleLoginSuccess} />
  );
}