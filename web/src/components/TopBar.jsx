import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

export default function TopBar({
  view,
  onHome,
  theme,
  onToggleTheme,
  focusMode,
  onToggleFocus,
  onSettings,
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
      <button className="brand" onClick={onHome} aria-label="Ir para a biblioteca">
        <span className="brand-mark">
          <Icon name="cross" size={17} strokeWidth={2.2} />
        </span>
        <span className="brand-name">Púlpito</span>
        <span className="brand-sub">estúdio de sermões</span>
      </button>

      {view === 'library' ? (
        <nav className="nav">
          <button className="nav-btn is-active">Biblioteca</button>
        </nav>
      ) : null}

      <div className="topbar-actions">
        {view === 'editor' ? (
          <button
            className={`icon-btn ${focusMode ? 'is-active' : ''}`}
            onClick={onToggleFocus}
            title={focusMode ? 'Sair do modo foco (Esc)' : 'Modo foco'}
            aria-label="Modo foco"
          >
            <Icon name="focus" size={18} />
          </button>
        ) : null}
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          aria-label="Alternar tema"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <button className="icon-btn" onClick={onSettings} title="Ajustes e perfil" aria-label="Ajustes">
          <Icon name="settings" size={18} />
        </button>
      </div>
    </header>
  );
}
