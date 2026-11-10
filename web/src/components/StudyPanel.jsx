import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { htmlToText } from '../lib/utils.js';
import { useToast } from './Toast.jsx';

export default function StudyPanel({ open, translation = 'ARA', versions = [], onClose, onOpenBible, onInsert }) {
  const { toast } = useToast();
  const [activeRef, setActiveRef] = useState(open || '');
  const [tab, setTab] = useState('passage');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [strongQuery, setStrongQuery] = useState('');
  const [strongResults, setStrongResults] = useState(null);
  const [strongCard, setStrongCard] = useState(null);
  const [strongLoading, setStrongLoading] = useState(false);
  const [popular, setPopular] = useState([]);

  useEffect(() => {
    if (open) {
      setActiveRef(open);
      setTab('passage');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!activeRef) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .studyReference(activeRef, translation)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setNote(htmlToText(result.userNote?.text || ''));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRef, translation]);

  useEffect(() => {
    if (!open) return;
    api
      .popularStrong()
      .then((result) => setPopular(result.strongs || []))
      .catch(() => setPopular([]));
  }, [open]);

  if (!open) return null;

  const lookup = async (value) => {
    const q = String(value || '').trim();
    if (!q) return;
    setStrongLoading(true);
    setStrongResults(null);
    setStrongCard(null);
    try {
      if (/^[HG]\d{1,5}$/i.test(q)) {
        const card = await api.strong(q.toUpperCase());
        setStrongCard(card);
      } else {
        const result = await api.strongSearch(q);
        setStrongResults(result.results || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setStrongLoading(false);
    }
  };

  const saveNote = async () => {
    setNoteSaving(true);
    try {
      const saved = await api.saveNote(activeRef, note);
      setData((current) => (current ? { ...current, userNote: { ...saved, text: saved.text } } : current));
      toast('Nota salva');
    } catch (err) {
      toast(err.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const verse = data?.verse;
  const popularLabel = popular.find((item) => item.id === strongCard?.id)?.label;

  return (
    <Modal
      title="Estudo da passagem"
      subtitle={activeRef || 'Escolha uma referência'}
      icon="search"
      size="modal-lg"
      onClose={onClose}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <span className="small muted">Strong's · referências cruzadas · notas</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => onOpenBible?.(activeRef)}>
              <Icon name="bible" size={14} /> Abrir na Bíblia
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!verse}
              onClick={() => onInsert?.(`“${verse.text}” (${activeRef})`)}
            >
              <Icon name="plus" size={14} /> Inserir no sermão
            </button>
          </div>
        </div>
      }
    >
      <div className="tabs">
        <button className={`tab-btn ${tab === 'passage' ? 'is-active' : ''}`} onClick={() => setTab('passage')}>
          <Icon name="book" size={14} /> Passagem
        </button>
        <button className={`tab-btn ${tab === 'crossrefs' ? 'is-active' : ''}`} onClick={() => setTab('crossrefs')}>
          <Icon name="link" size={14} /> Referências
        </button>
        <button className={`tab-btn ${tab === 'strongs' ? 'is-active' : ''}`} onClick={() => setTab('strongs')}>
          <Icon name="sparkles" size={14} /> Strong's
        </button>
        <button className={`tab-btn ${tab === 'notes' ? 'is-active' : ''}`} onClick={() => setTab('notes')}>
          <Icon name="note" size={14} /> Comentários
        </button>
      </div>

      {error ? (
        <div className="note-callout" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="loading-block">
          <span className="spinner" /> abrindo a passagem…
        </div>
      ) : tab === 'passage' ? (
        <div className="stack">
          <div className="study-ref-banner">
            <Icon name="bible" size={18} />
            <div style={{ flex: 1 }}>
              <strong>{activeRef}</strong>
              <div className="small muted">{verse?.translation || translation}</div>
            </div>
            <select
              className="select"
              style={{ width: 'auto', height: 32, fontSize: 12 }}
              value={translation}
              disabled
              title="A versão é definida nos ajustes"
            >
              <option>{translation}</option>
            </select>
          </div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 18,
              lineHeight: 1.75,
              color: 'var(--ink)',
              padding: '4px 2px 10px',
            }}
          >
            {verse?.verses?.length
              ? verse.verses.map((v) => (
                  <p key={v.verse} style={{ margin: '0 0 10px' }}>
                    <sup style={{ color: 'var(--accent)', fontSize: 11, marginRight: 5 }}>{v.verse}</sup>
                    {v.text}
                  </p>
                ))
              : 'Passagem não encontrada nesta versão.'}
          </div>
          {data?.notes?.length ? (
            <div>
              <div className="rail-title" style={{ marginTop: 8 }}>
                <Icon name="note" size={13} /> Notas da tradução
              </div>
              {data.notes.map((item) => (
                <div className="note-callout" key={`${item.verse}-${item.text}`}>
                  <strong style={{ fontSize: 11, letterSpacing: '0.06em' }}>v. {item.verse}</strong>
                  <div>{item.text}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : tab === 'crossrefs' ? (
        <div className="stack">
          <p className="hint" style={{ marginTop: 0 }}>
            Versículos relacionados por similaridade de uso, segundo o índice do OpenBible.info (CC-BY).
            Clique para navegar.
          </p>
          <div className="ref-list">
            {(data?.crossrefs || []).map((item) => (
              <button key={item.canonical} className="ref-item" onClick={() => setActiveRef(item.canonical)}>
                <Icon name="arrowRight" size={14} style={{ color: 'var(--accent)' }} />
                <b>{item.canonical}</b>
                <span className="ref-votes">{item.votes} votos</span>
              </button>
            ))}
            {!data?.crossrefs?.length ? (
              <div className="empty small">Nenhuma referência cruzada indexada para este versículo.</div>
            ) : null}
          </div>
        </div>
      ) : tab === 'strongs' ? (
        <div className="stack">
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              lookup(strongQuery);
            }}
          >
            <input
              className="input"
              placeholder="Número Strong (G26, H430) ou termo em inglês (love, faith, chesed…)"
              value={strongQuery}
              onChange={(event) => setStrongQuery(event.target.value)}
            />
            <button className="btn btn-sm" type="submit" disabled={strongLoading}>
              {strongLoading ? <span className="spinner" /> : <Icon name="search" size={14} />}
            </button>
          </form>

          {strongCard ? (
            <div className="strong-card">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="strong-lemma">{strongCard.lemma || strongCard.lexeme}</div>
                  <div className="strong-meta">
                    {popularLabel ? `${popularLabel} · ` : ''}
                    {strongCard.id}
                    {strongCard.transliteration ? ` · ${strongCard.transliteration}` : ''}
                    {strongCard.pronunciation ? ` · ${strongCard.pronunciation}` : ''}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setStrongCard(null)} title="Fechar">
                  <Icon name="x" size={15} />
                </button>
              </div>
              <div
                className="strong-def"
                dangerouslySetInnerHTML={{ __html: strongCard.definitionHtml || '' }}
              />
              <div className="small muted mt-2">Fonte: Brown-Driver-Briggs / Thayer (BDBT)</div>
            </div>
          ) : null}

          {strongResults ? (
            <div className="ref-list">
              {strongResults.map((item) => (
                <button
                  key={item.id}
                  className="ref-item"
                  onClick={() => {
                    setStrongQuery(item.id);
                    lookup(item.id);
                  }}
                >
                  <b style={{ color: 'var(--accent)', minWidth: 54 }}>{item.id}</b>
                  <span style={{ flex: 1 }}>
                    {item.lemma || item.transliteration}
                    <span className="muted"> — {item.shortDefinition || item.definition?.slice(0, 90)}</span>
                  </span>
                </button>
              ))}
              {!strongResults.length ? <div className="empty small">Nada encontrado. Tente o número Strong.</div> : null}
            </div>
          ) : null}

          {!strongCard && !strongResults ? (
            <>
              <div className="rail-title" style={{ marginBottom: 0 }}>
                <Icon name="sparkles" size={13} /> Acesso rápido
              </div>
              <div className="strong-grid">
                {popular.slice(0, 18).map((item) => (
                  <button
                    key={item.id}
                    className="chip"
                    onClick={() => {
                      setStrongQuery(item.id);
                      lookup(item.id);
                    }}
                    title={`${item.id} · ${item.label}`}
                  >
                    {item.id} <span style={{ opacity: 0.6 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="stack">
          {data?.studyNotes?.length ? (
            <div>
              <div className="rail-title" style={{ marginTop: 0 }}>
                <Icon name="sparkles" size={13} /> Notas de estudo
              </div>
              {data.studyNotes.map((item) => (
                <div className="study-note" key={`${item.ref}-${item.title}`}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <span>
                    {item.ref} · {item.source}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="study-note">Sua nota sobre {activeRef}</label>
            <textarea
              id="study-note"
              className="textarea note-area"
              placeholder="Observações, ilustrações, conexões com outros textos…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-primary" onClick={saveNote} disabled={noteSaving}>
              {noteSaving ? <span className="spinner" /> : <Icon name="check" size={14} />} Salvar nota
            </button>
          </div>

          {data?.notes?.length ? (
            <div>
              <div className="rail-title" style={{ marginTop: 6 }}>
                <Icon name="note" size={13} /> Notas da tradução
              </div>
              {data.notes.map((item) => (
                <div className="note-callout" key={`${item.verse}-${item.text}`}>
                  <strong style={{ fontSize: 11 }}>v. {item.verse}</strong>
                  <div>{item.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">
              Esta versão não traz notas de rodapé para a passagem. Suas próprias notas ficam salvas por
              referência e aparecem aqui na próxima vez.
            </p>
          )}
          <p className="hint">
            As notas de estudo do Púlpito são introduções originais para apoiar a preparação. Para
            comentários exegéticos completos, veja o README — o servidor tem um ponto de extensão para
            conectar um provedor externo.
          </p>
        </div>
      )}
    </Modal>
  );
}
