import React, { useState } from 'react';
import { Lock } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e, forceUser = null, forcePass = null) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const u = forceUser || username;
    const p = forcePass || password;

    try {
      const res = await fetch(import.meta.env.PUBLIC_API_URL + '/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: u, password: p })
      });

      const data = await res.json();

      if (res.ok) {
        onLoginSuccess(data.user_id, data.preferencias);
      } else {
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="Boxwill Inversiones"
            className="w-28 mx-auto mb-6"
            style={{ opacity: 0.9 }}
          />
          <h1
            className="text-xl font-bold mb-1"
            style={{ color: 'var(--color-bw-white)', fontFamily: 'var(--font-bw-display)', letterSpacing: 'var(--tracking-bw-tight)' }}
          >
            Panel de Administración
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-bw-muted)' }}>
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Formulario */}
        <div
          style={{
            background: 'var(--color-bw-surface)',
            border: '1px solid var(--color-bw-border)',
          }}
          className="p-8"
        >
          {error && (
            <div
              className="mb-6 p-3 text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          <div className="mb-5">
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: 'var(--color-bw-muted)', letterSpacing: 'var(--tracking-bw-wide)', textTransform: 'uppercase' }}
            >
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              className="w-full p-3 text-sm focus:outline-none"
              style={{
                background: 'var(--color-bw-raised)',
                border: '1px solid var(--color-bw-border-strong)',
                color: 'var(--color-bw-white)',
                borderRadius: 0,
              }}
            />
          </div>

          <div className="mb-8">
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: 'var(--color-bw-muted)', letterSpacing: 'var(--tracking-bw-wide)', textTransform: 'uppercase' }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full p-3 text-sm focus:outline-none"
              style={{
                background: 'var(--color-bw-raised)',
                border: '1px solid var(--color-bw-border-strong)',
                color: 'var(--color-bw-white)',
                borderRadius: 0,
              }}
            />
          </div>

          <button
            onClick={(e) => handleSubmit(e)}
            disabled={loading}
            className="bw-btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed mb-3"
          >
            {loading ? (
              'Verificando...'
            ) : (
              <>
                <Lock size={15} strokeWidth={2} />
                Iniciar Sesión
              </>
            )}
          </button>

          <button
            onClick={(e) => {
              setUsername('demo');
              setPassword('demo');
              handleSubmit(e, 'demo', 'demo');
            }}
            disabled={loading}
            className="bw-btn-ghost w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
          >
            Entrar como Demo
          </button>
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: 'var(--color-bw-muted)' }}
        >
          © {new Date().getFullYear()} Boxwill Inversiones
        </p>
      </div>
    </div>
  );
}