import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';

function slugify(text) {
  return (
    String(text || 'sermao')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 70) || 'sermao'
  );
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ExportModal({ open, sermon, onClose }) {
  const { toast, error: toastError } = useToast();
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !sermon?.id) return;
    setError(null);
    setSaved(null);
    api
      .getSermon(sermon.id)
      .then((data) => setSaved(data))
      .catch(() => {});
  }, [open, sermon?.id]);

  if (!open || !sermon) return null;

  const pdf = saved?.pdf || sermon.pdf || null;
  const baseName = slugify(sermon.title);

  const downloadPdf = async () => {
    setBusy('pdf');
    setError(null);
    try {
      const response = await fetch(`/api/sermons/${sermon.id}/pdf`);
      if (!response.ok) {
        let message = 'Não foi possível gerar o PDF.';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {
          /* resposta não-JSON */
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      saveBlob(blob, `${baseName}.pdf`);
      setSaved((current) => ({
        ...(current || {}),
        pdf: { generatedAt: new Date().toISOString(), bytes: blob.size },
      }));
      toast('PDF gerado e baixado');
    } catch (err) {
      setError(err.message);
      toastError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const downloadBackup = async () => {
    setBusy('backup');
    setError(null);
    try {
      const response = await fetch(`/api/sermons/${sermon.id}/backup`);
      if (!response.ok) throw new Error('Não foi possível gerar o backup.');
      const blob = await response.blob();
      saveBlob(blob, `${baseName}-backup.json`);
      toast('Backup JSON baixado');
    } catch (err) {
      setError(err.message);
      toastError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const openPrint = () => {
    window.open(`/api/sermons/${sermon.id}/print?auto=1`, '_blank', 'noopener');
  };

  return (
    <Modal
      title="Cópia de segurança"
      subtitle="Tenha o sermão em PDF mesmo se o site sair do ar."
      icon="shield"
      onClose={onClose}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            A cópia automática fica em <code>data/pdfs/</code> no servidor.
          </span>
          <button className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="note-callout"
          style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)', marginBottom: 16 }}
        >
          {error}
        </div>
      ) : null}

      <div className="export-grid">
        <div className="export-card export-card-primary">
          <span className="export-icon">
            <Icon name="file" size={22} />
          </span>
          <div className="export-info">
            <h3>PDF da pregação</h3>
            <p>
              Um documento de leitura com título, tema, tempo, tags e todas as seções. O download
              também atualiza a cópia guardada no servidor.
            </p>
            <div className="export-status">
              {pdf?.generatedAt ? (
                <>
                  <Icon name="check" size={13} />
                  Cópia de {formatWhen(pdf.generatedAt)}
                  {pdf.bytes ? ` · ${formatBytes(pdf.bytes)}` : ''}
                </>
              ) : (
                <>
                  <Icon name="clock" size={13} />
                  Ainda não gerada — o primeiro download gera agora.
                </>
              )}
            </div>
            <div className="export-actions">
              <button className="btn btn-primary btn-sm" onClick={downloadPdf} disabled={busy === 'pdf'}>
                {busy === 'pdf' ? <span className="spinner" /> : <Icon name="download" size={15} />}
                Baixar PDF
              </button>
              <button className="btn btn-sm" onClick={openPrint}>
                <Icon name="printer" size={15} /> Imprimir
              </button>
            </div>
          </div>
        </div>

        <div className="export-card">
          <span className="export-icon export-icon-muted">
            <Icon name="note" size={21} />
          </span>
          <div className="export-info">
            <h3>Backup completo (.json)</h3>
            <p>
              O sermão inteiro, com formatação, tags e metadados. Serve para guardar uma cópia ou
              recuperar o texto em outro lugar.
            </p>
            <div className="export-actions">
              <button className="btn btn-sm" onClick={downloadBackup} disabled={busy === 'backup'}>
                {busy === 'backup' ? <span className="spinner" /> : <Icon name="download" size={15} />}
                Baixar backup
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="export-note">
        <Icon name="shield" size={16} />
        <p>
          <strong>Cópia automática.</strong> Depois que você para de escrever, o Púlpito gera um PDF
          em segundo plano (no máximo a cada 3 minutos) e o mantém em <code>data/pdfs/</code>. Se o
          Chrome/Edge não estiver disponível, use <strong>Imprimir</strong> e escolha “Salvar como PDF”.
        </p>
      </div>
    </Modal>
  );
}
