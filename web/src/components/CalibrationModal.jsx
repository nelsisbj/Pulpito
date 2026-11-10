import { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { formatMinutes } from '../lib/utils.js';

export default function CalibrationModal({ open, sample, profile, onClose, onDone }) {
  const [phase, setPhase] = useState('intro');
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPhase('intro');
    setStartedAt(null);
    setElapsed(0);
    setResult(null);
    setError(null);
    setManual('');
  }, [open]);

  useEffect(() => {
    if (phase !== 'reading' || !startedAt) return;
    timer.current = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 120);
    return () => clearInterval(timer.current);
  }, [phase, startedAt]);

  if (!open) return null;

  const start = () => {
    setStartedAt(Date.now());
    setElapsed(0);
    setPhase('reading');
  };

  const finish = async () => {
    const seconds = Math.max(1, (Date.now() - (startedAt || Date.now())) / 1000);
    setBusy(true);
    setError(null);
    try {
      const response = await api.calibrate(seconds, sample?.words);
      setResult({ wpm: response.wpm, seconds });
      setPhase('done');
      onDone?.(response.profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = async () => {
    const wpm = Number(manual);
    if (!wpm || wpm < 40 || wpm > 400) {
      setError('Informe um ritmo entre 40 e 400 palavras por minuto.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.saveProfile({ wpm });
      setResult({ wpm: response.profile.wpm, manual: true });
      setPhase('done');
      onDone?.(response.profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const words = sample?.words || 0;

  return (
    <Modal
      title="Qual é o seu ritmo?"
      subtitle="Leia o texto em voz alta, no seu jeito de pregar. O Púlpito mede o tempo e estima seus sermões."
      icon="clock"
      size="modal-lg"
      onClose={onClose}
      footer={
        phase === 'reading' ? (
          <div className="row-between" style={{ width: '100%' }}>
            <span className="small muted">Leia até a última frase e clique em concluir.</span>
            <button className="btn btn-primary" onClick={finish} disabled={busy || elapsed < 10}>
              {busy ? <span className="spinner" /> : <Icon name="check" size={16} />} Concluí a leitura
            </button>
          </div>
        ) : phase === 'intro' ? (
          <div className="row-between" style={{ width: '100%' }}>
            <span className="small muted">≈ {words} palavras · cerca de 1 minuto</span>
            <button className="btn btn-primary" onClick={start}>
              <Icon name="play" size={15} /> Começar a leitura
            </button>
          </div>
        ) : null
      }
    >
      <div className="calibration-grid">
        <div>
          <div className={`reading-text ${phase === 'reading' ? 'is-reading' : ''}`}>{sample?.text}</div>
          {phase === 'intro' ? (
            <p className="hint mt-3">
              Dica: leia como se estivesse diante da igreja. Não precisa correr — o número serve para
              planejar, não para competir.
            </p>
          ) : null}
        </div>

        <div className="calibration-side">
          <div>
            <div className="eyebrow">{phase === 'reading' ? 'Lendo' : phase === 'done' ? 'Resultado' : 'Cronômetro'}</div>
            <div className="timer">
              {phase === 'done' && result
                ? `${Math.round(result.wpm)}`
                : `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {phase === 'done' ? 'palavras por minuto' : 'tempo de leitura'}
            </div>
          </div>

          {phase === 'done' && result ? (
            <>
              <div className="note-callout" style={{ margin: 0 }}>
                Com {Math.round(result.wpm)} ppm, um sermão de 1.500 palavras leva cerca de{' '}
                <strong>{formatMinutes(1500 / result.wpm)}</strong>.
              </div>
              <button className="btn btn-primary" onClick={onClose}>
                Usar este ritmo
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPhase('intro')}>
                Medir de novo
              </button>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="manual-wpm">Ou informe seu ritmo</label>
                <div className="row">
                  <input
                    id="manual-wpm"
                    className="input"
                    type="number"
                    min={40}
                    max={400}
                    placeholder={String(Math.round(profile?.wpm || 150))}
                    value={manual}
                    onChange={(event) => setManual(event.target.value)}
                  />
                  <button className="btn btn-sm" onClick={saveManual} disabled={busy}>
                    Salvar
                  </button>
                </div>
              </div>
              {error ? <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p> : null}
              <p className="hint" style={{ margin: 0 }}>
                O ritmo fica salvo no seu perfil e recalcula o tempo de todos os sermões.
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
