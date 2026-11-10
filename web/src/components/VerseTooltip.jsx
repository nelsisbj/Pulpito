import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { clamp } from '../lib/utils.js';
import Icon from './Icon.jsx';

const cache = new Map();

export default function VerseTooltip({ data, translation, onClose, onInsert, onStudy, onCompare, onKeepOpen }) {
  const [state, setState] = useState({ loading: true, verse: null, error: null });
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!data?.ref) return;
    const key = `${data.ref}|${translation}`;
    let cancelled = false;
    async function load() {
      if (cache.has(key)) {
        setState({ loading: false, verse: cache.get(key), error: null });
      } else {
        setState({ loading: true, verse: null, error: null });
        try {
          const verse = await api.verse(data.ref, translation);
          cache.set(key, verse);
          if (!cancelled) setState({ loading: false, verse, error: null });
        } catch (err) {
          if (!cancelled) setState({ loading: false, verse: null, error: err.message });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [data?.ref, translation]);

  useLayoutEffect(() => {
    if (!data?.anchor || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const anchor = data.anchor;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = clamp(anchor.left + anchor.width / 2 - rect.width / 2, 10, vw - rect.width - 10);
    const fitsBelow = anchor.bottom + rect.height + 14 < vh;
    let top = fitsBelow ? anchor.bottom + 9 : anchor.top - rect.height - 9;
    if (top < 10) top = 10;
    setPosition({
      left,
      top,
      above: !fitsBelow && anchor.top > rect.height + 10,
      arrowLeft: clamp(anchor.left + anchor.width / 2 - left, 18, rect.width - 18),
    });
  }, [data, state]);

  useEffect(() => {
    const onScroll = () => onClose?.();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [onClose]);

  if (!data?.ref) return null;

  const verse = state.verse;

  return (
    <div
      ref={ref}
      className={`verse-tooltip ${position?.above ? 'is-above' : ''}`}
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? 'visible' : 'hidden',
        '--arrow-left': `${position?.arrowLeft ?? 40}px`,
      }}
      onMouseEnter={onKeepOpen}
      onMouseLeave={() => onClose?.()}
      role="tooltip"
    >
      <div className="tooltip-head">
        <span className="tooltip-ref">{data.ref}</span>
        <span className="tooltip-version">{translation}</span>
      </div>
      {state.loading ? (
        <div className="tooltip-loading">
          <i />
          <i />
          <i />
        </div>
      ) : state.error ? (
        <p className="tooltip-text">{state.error}</p>
      ) : (
        <p className="tooltip-text">{verse?.text}</p>
      )}
      {verse ? (
        <div className="tooltip-actions">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onInsert?.(verse);
            }}
          >
            <Icon name="plus" size={13} /> Inserir
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onCompare?.(data.ref);
            }}
          >
            <Icon name="compare" size={13} /> Comparar
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onStudy?.(data.ref);
            }}
          >
            <Icon name="search" size={13} /> Estudo
          </button>
        </div>
      ) : null}
    </div>
  );
}
