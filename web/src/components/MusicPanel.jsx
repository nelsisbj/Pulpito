import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { parseMusicLink } from '../lib/utils.js';

export default function MusicPanel({ open, onClose, featured, status, current, onPlay, onStop, ambient }) {
  const [provider, setProvider] = useState('youtube');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hint, setHint] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLinkError('');
    setHint('');
  }, [open]);

  if (!open) return null;

  const search = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setHint('');
    try {
      const result = await api.musicSearch(q, provider);
      setResults(result.results || []);
      if (result.hint) setHint(result.hint);
    } catch (err) {
      setHint(err.message);
    } finally {
      setSearching(false);
    }
  };

  const playLink = () => {
    const parsed = parseMusicLink(link);
    if (!parsed) {
      setLinkError('Cole um link do YouTube ou do Spotify.');
      return;
    }
    setLinkError('');
    onPlay(parsed);
    setLink('');
  };

  return (
    <Modal
      title="Música de fundo"
      subtitle="Um som baixo para sustentar o silêncio — sem roubar a atenção."
      icon="music"
      onClose={onClose}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <span className="small muted">
            {status?.youtube || status?.spotify
              ? 'Integrações ativas'
              : 'Busca automática desativada · links e sugestões funcionam'}
          </span>
          {current ? (
            <button className="btn btn-sm btn-danger" onClick={onStop}>
              <Icon name="pause" size={14} /> Parar música
            </button>
          ) : null}
        </div>
      }
    >
      <div className="ambient" style={{ marginBottom: 18 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: ambient.enabled ? 'var(--accent)' : 'var(--surface)',
            color: ambient.enabled ? 'var(--accent-ink)' : 'var(--muted)',
            flex: 'none',
          }}
        >
          <Icon name="wave" size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 13, display: 'block' }}>Som ambiente gerado</strong>
          <span className="small muted">Ruído suave + acorde contínuo (funciona offline)</span>
          <div className="ambient-track" style={{ marginTop: 8 }}>
            <div className="ambient-fill" style={{ width: `${(ambient.volume || 0) * 100}%` }} />
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={ambient.volume}
          onChange={(event) => ambient.setVolume(Number(event.target.value))}
          style={{ width: 64, accentColor: 'var(--accent)' }}
          aria-label="Volume do som ambiente"
        />
        <button className={`btn btn-sm ${ambient.enabled ? 'btn-primary' : ''}`} onClick={ambient.toggle}>
          {ambient.enabled ? 'Desligar' : 'Ligar'}
        </button>
      </div>

      <div className="rail-title">
        <Icon name="headphones" size={13} /> Sugestões
      </div>
      <div className="music-grid">
        {(featured || []).map((item) => (
          <button
            key={`${item.provider}-${item.id}`}
            className={`music-card ${current?.id === item.id ? 'is-playing' : ''}`}
            onClick={() => onPlay(item)}
          >
            <span className="music-thumb">
              <Icon name={item.provider === 'spotify' ? 'music' : 'play'} size={17} />
            </span>
            <span className="music-info">
              <strong>{item.title}</strong>
              <span>{item.subtitle}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="rail-title mt-4">
        <Icon name="link" size={13} /> Colar link
      </div>
      <div className="row">
        <input
          className="input"
          placeholder="https://youtube.com/watch?v=… ou https://open.spotify.com/playlist/…"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              playLink();
            }
          }}
        />
        <button className="btn btn-sm" onClick={playLink}>
          Tocar
        </button>
      </div>
      {linkError ? <p className="hint" style={{ color: 'var(--danger)' }}>{linkError}</p> : null}

      <div className="rail-title mt-4">
        <Icon name="search" size={13} /> Buscar
      </div>
      <form className="row" onSubmit={search} style={{ marginBottom: 12 }}>
        <div className="segmented" style={{ flex: 'none' }}>
          <button
            type="button"
            className={provider === 'youtube' ? 'is-active' : ''}
            onClick={() => setProvider('youtube')}
          >
            YouTube
          </button>
          <button
            type="button"
            className={provider === 'spotify' ? 'is-active' : ''}
            onClick={() => setProvider('spotify')}
          >
            Spotify
          </button>
        </div>
        <input
          className="input"
          placeholder="Ex.: piano instrumental, hinos suaves…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="btn btn-sm" type="submit" disabled={searching}>
          {searching ? <span className="spinner" /> : <Icon name="search" size={14} />}
        </button>
      </form>

      {hint ? <p className="hint">{hint}</p> : null}

      {results.length ? (
        <div className="music-grid">
          {results.map((item) => (
            <button
              key={`${item.provider}-${item.kind}-${item.id}`}
              className={`music-card ${current?.id === item.id ? 'is-playing' : ''}`}
              onClick={() => onPlay(item)}
            >
              <span className="music-thumb">
                {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" /> : <Icon name="play" size={16} />}
              </span>
              <span className="music-info">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="hint mt-4">
        A busca automática usa as APIs oficiais do YouTube e do Spotify quando as chaves estão configuradas
        no servidor. Sem chaves, você ainda pode colar qualquer link e usar os sons sugeridos.
      </p>
    </Modal>
  );
}
