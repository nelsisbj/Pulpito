import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { formatDate, formatMinutes, pluralize, sermonWords } from '../lib/utils.js';

export default function Library({
  sermons,
  stats,
  profile,
  loading,
  onCreate,
  onOpen,
  onDelete,
  onDuplicate,
  onCalibrate,
  onSettings,
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (creating) titleRef.current?.focus();
  }, [creating]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onCreate({ title: title.trim() || 'Sermão sem título', theme: theme.trim() });
      setTitle('');
      setTheme('');
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => {
    setCreating(true);
    setTimeout(() => titleRef.current?.focus(), 30);
  };

  return (
    <main className="library">
      <div className="library-head">
        <div>
          <span className="eyebrow">Biblioteca</span>
          <h1 className="display">
            Um lugar silencioso
            <br />
            para <em>escrever</em>.
          </h1>
          <p className="lede">
            Do primeiro versículo à última palavra. O Púlpito guarda suas ideias, lembra o texto bíblico
            e ajuda você a sentir quanto tempo a mensagem vai levar.
          </p>
        </div>
        <div className="library-actions">
          <button className="btn" onClick={onCalibrate}>
            <Icon name="clock" size={16} /> Calibrar leitura
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} /> Novo sermão
          </button>
        </div>
      </div>

      <form className={`new-sermon ${creating ? 'is-open' : ''}`} onSubmit={submit}>
        {creating ? (
          <div className="new-sermon-grid">
            <div className="field">
              <label htmlFor="new-title">Título</label>
              <input
                id="new-title"
                ref={titleRef}
                className="input"
                placeholder="Ex.: A graça que nos alcança"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
              />
            </div>
            <div className="field">
              <label htmlFor="new-theme">Tema</label>
              <input
                id="new-theme"
                className="input"
                placeholder="Ex.: graça, salvação, recomeço"
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
                maxLength={180}
              />
            </div>
            <div className="row" style={{ paddingBottom: 1 }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="feather" size={16} />}
                Começar
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setCreating(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="row"
            style={{ width: '100%', textAlign: 'left', color: 'var(--muted)', fontSize: 14 }}
            onClick={openCreate}
          >
            <Icon name="plus" size={17} />
            <span>Começar um novo sermão — título e tema podem esperar.</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--faint)' }}>clique aqui</span>
          </button>
        )}
      </form>

      <div className="stats-grid">
        <div className="stat">
          <div className="stat-value">{stats?.totalSermons ?? sermons.length}</div>
          <div className="stat-label">
            {pluralize(stats?.totalSermons ?? sermons.length, 'sermão', 'sermões')}
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatMinutes(stats?.totalMinutes ?? 0)}</div>
          <div className="stat-label">tempo escrito</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatMinutes(stats?.averageMinutes ?? 0)}</div>
          <div className="stat-label">média por sermão</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {Math.round(profile?.wpm || 150)}
            <span style={{ fontSize: 13, fontFamily: 'var(--sans)', color: 'var(--muted)' }}>ppm</span>
          </div>
          <div className="stat-label">seu ritmo de leitura</div>
        </div>
      </div>

      <div className="section-head">
        <h2>Seus sermões</h2>
        <span>{sermons.length ? `${sermons.length} na biblioteca` : 'nada por aqui ainda'}</span>
      </div>

      {loading ? (
        <div className="loading-block">
          <span className="spinner" /> abrindo a biblioteca…
        </div>
      ) : sermons.length ? (
        <div className="sermon-grid">
          {sermons.map((sermon) => (
            <article
              key={sermon.id}
              className="sermon-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(sermon.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(sermon.id);
                }
              }}
            >
              <div className="sermon-card-top">
                <span className="eyebrow">{formatDate(sermon.updatedAt)}</span>
                <div className="row" style={{ gap: 2 }}>
                  <button
                    className="icon-btn"
                    title="Duplicar"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDuplicate(sermon.id);
                    }}
                    style={{ width: 28, height: 28 }}
                  >
                    <Icon name="copy" size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Excluir"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDelete(sermon);
                    }}
                    style={{ width: 28, height: 28 }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              <h3 className="sermon-title">{sermon.title}</h3>
              {sermon.theme ? <p className="sermon-theme">{sermon.theme}</p> : null}
              <div className="tag-row">
                {(sermon.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="sermon-meta">
                <span>
                  <Icon name="clock" size={13} /> {formatMinutes(sermon.metrics?.minutes || 0)}
                </span>
                <span>
                  <Icon name="text" size={13} /> {sermon.metrics?.words || sermonWords(sermon)} palavras
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="feather" size={24} />
          </div>
          <h3>A página está em branco — e isso é um começo.</h3>
          <p>
            Crie seu primeiro sermão. Você escreve a introdução, quantos pontos quiser e a conclusão;
            o Púlpito cuida do tempo, das referências e das versões da Bíblia.
          </p>
          <button className="btn btn-primary mt-4" onClick={openCreate}>
            <Icon name="plus" size={16} /> Escrever o primeiro sermão
          </button>
        </div>
      )}

      {stats?.topTags?.length ? (
        <>
          <div className="section-head">
            <h2>O que você mais tem pregado</h2>
            <span>temas detectados automaticamente</span>
          </div>
          <div className="tag-bars">
            {stats.topTags.map((tag) => (
              <div className="tag-bar" key={tag.label}>
                <span className="tag-bar-label">{tag.label}</span>
                <span className="tag-bar-track">
                  <span
                    className="tag-bar-fill"
                    style={{
                      display: 'block',
                      width: `${Math.max(8, (tag.count / stats.topTags[0].count) * 100)}%`,
                    }}
                  />
                </span>
                <span className="tag-bar-count">{tag.count}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="row-between mt-4" style={{ marginTop: 40, color: 'var(--faint)', fontSize: 12 }}>
        <span>Texto bíblico via bolls.life · Referências cruzadas OpenBible.info (CC-BY)</span>
        <button className="btn btn-ghost btn-sm" onClick={onSettings}>
          <Icon name="settings" size={14} /> Ajustes
        </button>
      </div>

      {pendingDelete ? (
        <Modal
          title="Excluir sermão?"
          subtitle="Essa ação não pode ser desfeita."
          icon="trash"
          size="modal-sm"
          onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setPendingDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  const target = pendingDelete;
                  setPendingDelete(null);
                  await onDelete(target.id);
                }}
              >
                Excluir definitivamente
              </button>
            </>
          }
        >
          <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
            <strong>{pendingDelete.title}</strong> será removido da sua biblioteca.
          </p>
        </Modal>
      ) : null}
    </main>
  );
}
