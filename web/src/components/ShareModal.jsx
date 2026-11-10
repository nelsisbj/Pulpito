import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';

function isLocalHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}

export default function ShareModal({ open, sermon, onClose }) {
  const { toast, error: toastError } = useToast();
  const [share, setShare] = useState(null);
  const [network, setNetwork] = useState(null);
  const [base, setBase] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !sermon?.id) return;
    setLoading(true);
    setError(null);
    setShare(null);
    setNetwork(null);
    setBase('');
    Promise.all([
      api.getShare(sermon.id),
      api.network().catch(() => null),
    ])
      .then(([shareData, networkData]) => {
        setShare(shareData.share || null);
        setNetwork(networkData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, sermon?.id]);

  const candidates = useMemo(() => {
    const origin = window.location.origin;
    const list = [];
    if (network?.publicUrl) {
      list.push({ url: network.publicUrl.replace(/\/$/, ''), label: 'Endereço público' });
    }
    if (!isLocalHost(window.location.hostname)) {
      list.push({ url: origin, label: 'Este endereço' });
    }
    if (network?.lanEnabled) {
      for (const address of network.addresses || []) {
        list.push({ url: `http://${address}:${network.port}`, label: `Rede local · ${address}` });
      }
    }
    if (!list.length) {
      list.push({ url: origin, label: 'Este computador' });
    }
    return list.filter((item, index, arr) => arr.findIndex((x) => x.url === item.url) === index);
  }, [network]);

  useEffect(() => {
    if (!candidates.length) return;
    if (!base || !candidates.some((item) => item.url === base)) {
      setBase(candidates[0].url);
    }
  }, [candidates, base]);

  if (!open || !sermon) return null;

  const shareUrl = share?.token && base ? `${base}/s/${share.token}` : '';
  const baseIsLocal = base ? isLocalHost(new URL(base).hostname) : true;
  const needsNetwork = baseIsLocal && !network?.lanEnabled;

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      const result = await api.createShare(sermon.id);
      setShare(result.share);
      toast('Link de leitura criado');
    } catch (err) {
      setError(err.message);
      toastError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy('revoke');
    setError(null);
    try {
      await api.revokeShare(sermon.id);
      setShare(null);
      toast('Link revogado — quem tinha o endereço não vê mais');
    } catch (err) {
      setError(err.message);
      toastError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('Link copiado');
    } catch {
      const input = document.getElementById('share-url-input');
      input?.select();
      try {
        document.execCommand('copy');
        toast('Link copiado');
      } catch {
        toastError('Selecione o link e copie manualmente.');
      }
    }
  };

  return (
    <Modal
      title="Compartilhar sermão"
      subtitle="Um link de leitura para enviar a quem você quiser."
      icon="link"
      onClose={onClose}
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>
            Quem recebe o link pode ler, imprimir e baixar o PDF — não editar.
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

      {loading ? (
        <div className="loading-block">
          <span className="spinner" /> preparando o link…
        </div>
      ) : !share ? (
        <div className="share-empty">
          <div className="share-empty-icon">
            <Icon name="link" size={24} />
          </div>
          <h3>Ainda não existe link público</h3>
          <p>
            Crie um endereço exclusivo para este sermão. Ele mostra o texto em uma página limpa,
            com botões para imprimir e baixar o PDF. O link pode ser revogado quando quiser.
          </p>
          <button className="btn btn-primary" onClick={create} disabled={busy === 'create'}>
            {busy === 'create' ? <span className="spinner" /> : <Icon name="link" size={16} />}
            Criar link de leitura
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label htmlFor="share-url-input">Link de leitura</label>
            <div className="share-link-row">
              <input id="share-url-input" className="input share-link" readOnly value={shareUrl} />
              <button className="btn btn-sm" onClick={copy} title="Copiar link">
                <Icon name="copy" size={15} /> Copiar
              </button>
              <button
                className="btn btn-sm"
                onClick={() => window.open(shareUrl, '_blank', 'noopener')}
                title="Abrir em nova aba"
              >
                <Icon name="external" size={15} />
              </button>
            </div>
          </div>

          {candidates.length > 1 ? (
            <div className="field">
              <label htmlFor="share-base">Endereço usado no link</label>
              <select
                id="share-base"
                className="select"
                value={base}
                onChange={(event) => setBase(event.target.value)}
              >
                {candidates.map((item) => (
                  <option key={item.url} value={item.url}>
                    {item.label} — {item.url}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {baseIsLocal ? (
            <div className="share-warning">
              <strong>Este link só abre neste computador.</strong>
              <p>
                O endereço <code>127.0.0.1</code> aponta para a própria máquina. Para outra pessoa
                acessar, use o endereço da rede local ou um endereço público.
              </p>
            </div>
          ) : null}

          {needsNetwork ? (
            <div className="share-warning">
              <strong>Como liberar para a rede local</strong>
              <ol>
                <li>
                  No arquivo <code>.env</code>, coloque <code>HOST=0.0.0.0</code>.
                </li>
                <li>Reinicie o Púlpito.</li>
                <li>
                  Libere a porta <code>{network?.port || 4000}</code> no firewall do Windows.
                </li>
                <li>Abra este painel de novo: os endereços da rede vão aparecer.</li>
              </ol>
              <p>
                Para acesso pela internet, use um túnel (Cloudflare Tunnel, ngrok) ou publique o
                servidor com um endereço público.
              </p>
            </div>
          ) : null}

          <div className="share-note">
            <Icon name="shield" size={16} />
            <p>
              Fora deste computador, o Púlpito bloqueia o editor e libera apenas as páginas de
              compartilhamento. O link não aparece em buscadores. Se ele vazar, revogue e crie outro.
            </p>
          </div>

          <div className="row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <span className="small muted">
              Criado em{' '}
              {share.createdAt
                ? new Date(share.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'agora'}
            </span>
            <button className="btn btn-sm btn-danger" onClick={revoke} disabled={busy === 'revoke'}>
              {busy === 'revoke' ? <span className="spinner" /> : <Icon name="trash" size={14} />}
              Revogar link
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
