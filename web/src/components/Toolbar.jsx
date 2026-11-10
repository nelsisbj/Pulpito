import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { exec, restoreNativeRange, saveNativeRange, selectionState } from '../lib/editor.js';

const TEXT_COLORS = ['#211d17', '#7c7162', '#9d3a31', '#b35a2e', '#a97c39', '#2f5d50', '#3b5b8c', '#6b4a8c'];
const HIGHLIGHTS = ['#f6e3a1', '#f7c9c0', '#cfe8d8', '#cfe0f5', '#e6d6f5', '#f2d9b5', '#e8e3d8'];

export default function Toolbar({ onInsertVerse, onSuggest, disabled }) {
  const [active, setActive] = useState({});
  const [block, setBlock] = useState('p');
  const [palette, setPalette] = useState(null);
  const wrapRef = useRef(null);
  const savedRange = useRef(null);

  useEffect(() => {
    const refresh = () => {
      setActive({
        bold: selectionState('bold'),
        italic: selectionState('italic'),
        underline: selectionState('underline'),
        strikeThrough: selectionState('strikeThrough'),
        insertUnorderedList: selectionState('insertUnorderedList'),
        insertOrderedList: selectionState('insertOrderedList'),
      });
      try {
        const value = (document.queryCommandValue('formatBlock') || 'p').toLowerCase();
        setBlock(['h2', 'h3', 'blockquote'].includes(value) ? value : 'p');
      } catch {
        setBlock('p');
      }
    };
    document.addEventListener('selectionchange', refresh);
    refresh();
    return () => document.removeEventListener('selectionchange', refresh);
  }, []);

  useEffect(() => {
    const onClick = (event) => {
      if (palette && wrapRef.current && !wrapRef.current.contains(event.target)) setPalette(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [palette]);

  const command = (cmd, value = null) => {
    if (disabled) return;
    exec(cmd, value);
    setPalette(null);
  };

  const blockValue = (value) => {
    command('formatBlock', value === 'p' ? '<p>' : `<${value}>`);
    setBlock(value);
  };

  const button = (cmd, icon, label, className = '') => (
    <button
      type="button"
      className={`tool-btn ${className} ${active[cmd] ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={Boolean(active[cmd])}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => command(cmd)}
    >
      {icon}
    </button>
  );

  return (
    <div className="toolbar" ref={wrapRef} role="toolbar" aria-label="Formatação">
      <div className="tool-group">
        <button
          type="button"
          className="tool-btn"
          title="Desfazer (Ctrl+Z)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command('undo')}
        >
          <Icon name="undo" size={16} />
        </button>
        <button
          type="button"
          className="tool-btn"
          title="Refazer (Ctrl+Y)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command('redo')}
        >
          <Icon name="redo" size={16} />
        </button>
      </div>

      <div className="tool-divider" />

      <select
        className="tool-select"
        value={block}
        onMouseDown={() => {
          savedRange.current = saveNativeRange();
        }}
        onChange={(event) => {
          if (savedRange.current) restoreNativeRange(savedRange.current);
          blockValue(event.target.value);
        }}
        aria-label="Estilo do parágrafo"
      >
        <option value="p">Texto</option>
        <option value="h2">Título</option>
        <option value="h3">Subtítulo</option>
        <option value="blockquote">Citação</option>
      </select>

      <div className="tool-divider" />

      {button('bold', <span style={{ fontWeight: 800 }}>B</span>, 'Negrito (Ctrl+B)')}
      {button('italic', <span className="i" style={{ fontFamily: 'var(--serif)' }}>I</span>, 'Itálico (Ctrl+I)')}
      {button('underline', <span className="u" style={{ fontFamily: 'var(--serif)' }}>U</span>, 'Sublinhado (Ctrl+U)')}
      {button(
        'strikeThrough',
        <span className="s" style={{ fontFamily: 'var(--serif)' }}>S</span>,
        'Riscado',
      )}

      <div className="color-wrap">
        <button
          type="button"
          className={`tool-btn ${palette === 'text' ? 'is-active' : ''}`}
          title="Cor do texto"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPalette(palette === 'text' ? null : 'text')}
        >
          <span style={{ fontWeight: 700, borderBottom: '2px solid currentColor', lineHeight: 1 }}>A</span>
        </button>
        {palette === 'text' ? (
          <div className="palette">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                title={color}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => command('foreColor', color)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="color-wrap">
        <button
          type="button"
          className={`tool-btn ${palette === 'highlight' ? 'is-active' : ''}`}
          title="Grifar"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPalette(palette === 'highlight' ? null : 'highlight')}
        >
          <Icon name="highlight" size={16} />
        </button>
        {palette === 'highlight' ? (
          <div className="palette">
            {HIGHLIGHTS.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                title={color}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => command('hiliteColor', color)}
              />
            ))}
            <button
              type="button"
              className="swatch"
              style={{ background: 'var(--surface)', display: 'grid', placeItems: 'center' }}
              title="Sem grifo"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command('hiliteColor', 'transparent')}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="tool-divider" />

      {button('insertUnorderedList', <Icon name="list" size={16} />, 'Lista com marcadores')}
      {button('insertOrderedList', <Icon name="orderedList" size={16} />, 'Lista numerada')}
      <button
        type="button"
        className={`tool-btn ${block === 'blockquote' ? 'is-active' : ''}`}
        title="Citação"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => blockValue('blockquote')}
      >
        <Icon name="quote" size={15} />
      </button>

      <div className="tool-divider" />

      <button
        type="button"
        className="tool-btn"
        title="Limpar formatação"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => command('removeFormat')}
      >
        <Icon name="eraser" size={16} />
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        className="tool-btn"
        title="Completar citação (Ctrl+Espaço)"
        aria-label="Completar citação"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSuggest}
      >
        <Icon name="sparkles" size={16} />
      </button>

      <button
        type="button"
        className="tool-btn"
        title="Inserir versículo (Ctrl+Shift+B)"
        aria-label="Versículo"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onInsertVerse}
      >
        <Icon name="bible" size={16} />
      </button>
    </div>
  );
}
