import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { formatMinutes, pluralize } from '../lib/utils.js';

const FONT_SIZES = [17, 18, 19, 20, 21, 22];

export default function SettingsModal({
  open,
  profile,
  stats,
  versions,
  onClose,
  onSave,
  onCalibrate,
  onThemeChange,
}) {
  const [name, setName] = useState('');
  const [wpm, setWpm] = useState(150);
  const [theme, setTheme] = useState('light');
  const [serif, setSerif] = useState(true);
  const [fontSize, setFontSize] = useState(19);
  const [translation, setTranslation] = useState('ARA');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName(profile?.name || 'Pregador');
    setWpm(Math.round(profile?.wpm || 150));
    setTheme(profile?.settings?.theme === 'dark' ? 'dark' : 'light');
    setSerif((profile?.settings?.fontFamily || 'serif') === 'serif');
    setFontSize(profile?.settings?.fontSize || 19);
    setTranslation(profile?.settings?.translation || 'ARA');
    setError(null);
  }, [open, profile]);

  if (!open) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name,
        wpm: Number(wpm),
        settings: {
          theme,
          fontFamily: serif ? 'serif' : 'sans',
          fontSize,
          translation,
        },
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Ajustes"
      subtitle="Seu perfil, ritmo de leitura e preferências do editor."
      icon="settings"
      onClose={onClose}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            {stats?.totalSermons
              ? `${stats.totalSermons} ${pluralize(stats.totalSermons, 'sermão', 'sermões')} · ${formatMinutes(
                  stats.totalMinutes,
                )} escritos`
              : 'Sua biblioteca começa vazia'}
          </span>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="check" size={15} />} Salvar ajustes
          </button>
        </>
      }
    >
      <div className="settings-grid">
        <div className="settings-row">
          <div>
            <strong>Seu nome</strong>
            <span>Aparece na biblioteca e nas saudações.</span>
          </div>
          <input
            className="input"
            style={{ maxWidth: 220 }}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
          />
        </div>

        <div className="settings-row">
          <div>
            <strong>Ritmo de leitura</strong>
            <span>Palavras por minuto usadas para estimar a duração.</span>
          </div>
          <div className="row">
            <input
              className="input"
              type="number"
              min={40}
              max={400}
              style={{ width: 92, textAlign: 'center' }}
              value={wpm}
              onChange={(event) => setWpm(event.target.value)}
            />
            <button className="btn btn-sm" onClick={onCalibrate}>
              <Icon name="clock" size={14} /> Calibrar
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Tema</strong>
            <span>Claro para o dia, escuro para escrever à noite.</span>
          </div>
          <div className="segmented">
            <button
              className={theme === 'light' ? 'is-active' : ''}
              onClick={() => {
                setTheme('light');
                onThemeChange?.('light');
              }}
            >
              Claro
            </button>
            <button
              className={theme === 'dark' ? 'is-active' : ''}
              onClick={() => {
                setTheme('dark');
                onThemeChange?.('dark');
              }}
            >
              Escuro
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Fonte do editor</strong>
            <span>Serifa, mais próxima do papel; ou sem serifa, mais direta.</span>
          </div>
          <div className="segmented">
            <button className={serif ? 'is-active' : ''} onClick={() => setSerif(true)}>
              Serifa
            </button>
            <button className={!serif ? 'is-active' : ''} onClick={() => setSerif(false)}>
              Sem serifa
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Tamanho do texto</strong>
            <span>Confira o tamanho da letra no editor.</span>
          </div>
          <select
            className="select"
            style={{ width: 120 }}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          >
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </div>

        <div className="settings-row">
          <div>
            <strong>Versão padrão da Bíblia</strong>
            <span>Usada nos tooltips e na inserção de versículos.</span>
          </div>
          <select
            className="select"
            style={{ width: 280 }}
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
          >
            {(versions || []).map((version) => (
              <option key={version.id} value={version.id}>
                {version.id} · {version.name}
              </option>
            ))}
          </select>
        </div>

        {stats?.topTags?.length ? (
          <div className="settings-row">
            <div>
              <strong>Seus temas</strong>
              <span>Detectados a partir do que você escreve.</span>
            </div>
            <div className="tag-row" style={{ maxWidth: 320, justifyContent: 'flex-end' }}>
              {stats.topTags.slice(0, 6).map((tag) => (
                <span className="tag" key={tag.label}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <p className="hint" style={{ margin: 0 }}>
          Seus sermões ficam salvos localmente, no computador que roda o Púlpito
          (<code>data/pulpito.json</code>). Nada é enviado para terceiros além das consultas à API
          bíblica.
        </p>
        {error ? <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      </div>
    </Modal>
  );
}
