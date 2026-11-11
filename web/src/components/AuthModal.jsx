import { useState } from 'react';
import { api } from '../lib/api.js';
import Icon from './Icon.jsx';

export default function AuthModal({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res;
      if (isRegister) {
        res = await api.register(name, email, password);
      } else {
        res = await api.login(email, password);
      }

      const token = res?.token || res?.jwt;
      if (!token) {
        throw new Error('Token não retornado pelo servidor.');
      }

      localStorage.setItem('pulpito_token', token);
      if (res.user) {
        localStorage.setItem('pulpito_user', JSON.stringify(res.user));
      }

      if (onLoginSuccess) {
        onLoginSuccess(token);
      }
    } catch (err) {
      console.error('[auth error]', err);
      setError(err.message || 'Erro ao realizar autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="paper" style={{ maxWidth: 400, width: '100%', padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="brand-mark" style={{ margin: '0 auto 12px', width: 44, height: 44, borderRadius: 12 }}>
            <Icon name="cross" size={22} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: 24, margin: '0 0 6px' }}>Púlpito</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {isRegister ? 'Crie sua conta para começar' : 'Entre com sua conta'}
          </p>
        </div>

        {error && (
          <div className="callout callout-error" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <div>
              <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Nome</label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>E-mail</label>
            <input
              type="email"
              className="input"
              style={{ width: '100%' }}
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="small muted" style={{ display: 'block', marginBottom: 4 }}>Senha</label>
            <input
              type="password"
              className="input"
              style={{ width: '100%' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Aguarde...' : isRegister ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
          >
            {isRegister ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
}