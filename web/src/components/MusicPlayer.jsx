import { useState } from 'react';
import Icon from './Icon.jsx';
import { spotifyEmbed, youtubeEmbed } from '../lib/utils.js';

export default function MusicPlayer({ current, onStop }) {
  const [minimized, setMinimized] = useState(false);
  if (!current) return null;

  const isSpotify = current.provider === 'spotify';
  const src = isSpotify ? spotifyEmbed(current) : youtubeEmbed({ ...current, autoplay: 1 });
  const title = current.title || (isSpotify ? 'Spotify' : 'YouTube');

  if (minimized) {
    return (
      <button className="music-player-mini" onClick={() => setMinimized(false)} title="Abrir player">
        <span className="pulse">
          <Icon name="music" size={14} />
        </span>
        <span>{title}</span>
        <Icon name="chevronUp" size={14} style={{ color: 'var(--muted)', flex: 'none' }} />
      </button>
    );
  }

  return (
    <div className={`music-player ${isSpotify ? 'is-spotify' : 'is-youtube'}`}>
      <div className="music-player-head">
        <Icon name="music" size={14} style={{ color: 'var(--accent)' }} />
        <strong>{title}</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setMinimized(true)} title="Minimizar">
            <Icon name="chevronDown" size={15} />
          </button>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onStop} title="Fechar">
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>
      <iframe
        title={`Player · ${title}`}
        src={src}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}
