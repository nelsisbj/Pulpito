import { useState } from 'react';
import { api } from '../lib/api.js'; // <-- Garantir que apontas para ../lib/api.js

export default function AuthModal({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = isRegister 
        ? await api.register(email, password)
        : await api.login(email, password);

      localStorage.setItem('pulpito_token', data.token);
      localStorage.setItem('pulpito_user', JSON.stringify(data.user));

      onLoginSuccess(data.token);
    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '380px',
      margin: '60px auto',
      padding: '30px',
      background: '#faf7f2',
      borderRadius: '12px',
      border: '1px solid #e2ddd5',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      fontFamily: 'sans-serif'
    }}>
      <h2 style={{ color: '#211d17', marginTop: 0 }}>
        {isRegister ? 'Criar Conta' : 'Entrar no Púlpito'}
      </h2>

      {error && (
        <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#555' }}>E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#555' }}>Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#2d5a4c', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? 'Carregando...' : (isRegister ? 'Criar Conta' : 'Entrar')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setIsRegister(!isRegister)}
        style={{ width: '100%', marginTop: '16px', background: 'none', border: 'none', color: '#2d5a4c', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
      >
        {isRegister ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se aqui'}
      </button>
    </div>
  );
}