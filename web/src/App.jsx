import { useEffect, useRef, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import Library from './components/Library.jsx';
import Editor from './components/Editor.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import CalibrationModal from './components/CalibrationModal.jsx';
import { useToast } from './components/Toast.jsx';
import { api } from './lib/api.js';
import Icon from './components/Icon.jsx';

const FALLBACK_VERSIONS = [
  { id: 'ARA', name: 'Almeida Revista e Atualizada' },
  { id: 'NAA', name: 'Nova Almeida Atualizada' },
  { id: 'NTLH', name: 'Nova Tradução na Linguagem de Hoje' },
  { id: 'ARC09', name: 'Almeida Revista e Corrigida' },
  { id: 'KJA', name: 'King James Atualizada' },
  { id: 'NVT', name: 'Nova Versão Transformadora' },
];

function readRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const match = hash.match(/^sermao\/([^/]+)$/);
  return match ? { view: 'editor', id: match[1] } : { view: 'library', id: null };
}

export default function App() {
  const { toast, error: toastError } = useToast();
  const [route, setRoute] = useState(() => readRoute());
  const [profile, setProfile] = useState(null);
  const [versions, setVersions] = useState(FALLBACK_VERSIONS);
  const [sermons, setSermons] = useState([]);
  const [stats, setStats] = useState(null);
  const [current, setCurrent] = useState(null);
  const [sample, setSample] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);
  const [loadingSermon, setLoadingSermon] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('pulpito:focus') === '1');
  const [theme, setTheme] = useState(() => localStorage.getItem('pulpito:theme') || 'light');
  const loadedIdRef = useRef(null);

  const applyProfile = (nextProfile) => {
    setProfile(nextProfile);
    if (nextProfile?.settings?.theme) {
      setTheme(nextProfile.settings.theme);
    }
  };

  const changeTheme = (next) => {
    setTheme(next);
    api.saveProfile({ settings: { theme: next } }).catch(() => {});
  };

  const refreshLibrary = async () => {
    try {
      const [list, statsData] = await Promise.all([api.listSermons(), api.stats()]);
      setSermons(list.sermons || []);
      setStats(statsData);
    } catch (err) {
      toastError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileData, versionsData, list, statsData] = await Promise.all([
          api.profile(),
          api.versions().catch(() => ({ portuguese: FALLBACK_VERSIONS })),
          api.listSermons(),
          api.stats(),
        ]);
        if (cancelled) return;
        applyProfile(profileData.profile);
        setSample(profileData.sample);
        setVersions(versionsData.portuguese?.length ? versionsData.portuguese : FALLBACK_VERSIONS);
        setSermons(list.sermons || []);
        setStats(statsData);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setBootError(err.message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tema + tipografia
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pulpito:theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12110f' : '#f3ede2');
  }, [theme]);

  useEffect(() => {
    const settings = profile?.settings;
    if (!settings) return;
    const root = document.documentElement;
    root.style.setProperty('--editor-size', `${settings.fontSize || 19}px`);
    root.style.setProperty(
      '--editor-font',
      settings.fontFamily === 'sans' ? 'var(--sans)' : 'var(--serif)',
    );
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('pulpito:focus', focusMode ? '1' : '0');
    if (!focusMode) return;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setFocusMode(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusMode]);

  // rota / botão voltar do navegador
  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const loadSermon = async (id) => {
    if (!id) return;
    if (current?.id === id) return;
    setLoadingSermon(true);
    try {
      const sermon = await api.getSermon(id);
      setCurrent(sermon);
      loadedIdRef.current = id;
      setRoute({ view: 'editor', id });
      window.scrollTo({ top: 0 });
    } catch (err) {
      toastError(err.message);
      window.history.replaceState(null, '', '#/');
      setRoute({ view: 'library', id: null });
    } finally {
      setLoadingSermon(false);
    }
  };

  useEffect(() => {
    if (route.view === 'editor' && route.id && route.id !== current?.id) {
      loadSermon(route.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const openSermon = (id) => {
    window.history.pushState(null, '', `#/sermao/${id}`);
    setRoute({ view: 'editor', id });
    loadSermon(id);
  };

  const goLibrary = () => {
    window.history.pushState(null, '', '#/');
    setRoute({ view: 'library', id: null });
    setCurrent(null);
    window.scrollTo({ top: 0 });
    refreshLibrary();
  };

  const createSermon = async ({ title, theme: sermonTheme }) => {
    try {
      const sermon = await api.createSermon({ title, theme: sermonTheme });
      setSermons((items) => [sermon, ...items]);
      window.history.pushState(null, '', `#/sermao/${sermon.id}`);
      setCurrent(sermon);
      setRoute({ view: 'editor', id: sermon.id });
      loadedIdRef.current = sermon.id;
    } catch (err) {
      toastError(err.message);
    }
  };

  const deleteSermon = async (id) => {
    try {
      await api.deleteSermon(id);
      setSermons((items) => items.filter((item) => item.id !== id));
      if (current?.id === id) goLibrary();
      await refreshLibrary();
      toast('Sermão excluído');
    } catch (err) {
      toastError(err.message);
    }
  };

  const duplicateSermon = async (id) => {
    try {
      const copy = await api.duplicateSermon(id);
      setSermons((items) => [copy, ...items]);
      await refreshLibrary();
      toast('Cópia criada');
    } catch (err) {
      toastError(err.message);
    }
  };

  const saveSettings = async (patch) => {
    const result = await api.saveProfile(patch);
    applyProfile(result.profile);
    if (patch.settings?.theme) setTheme(patch.settings.theme);
    await refreshLibrary();
    toast('Ajustes salvos');
  };

  const handleCalibrationDone = async (nextProfile) => {
    if (nextProfile) applyProfile(nextProfile);
    else {
      const data = await api.profile();
      applyProfile(data.profile);
      setSample(data.sample);
    }
    await refreshLibrary();
    toast('Ritmo atualizado');
  };

  const handleSaved = (saved) => {
    setSermons((items) => items.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)));
    setCurrent((cur) => (cur && cur.id === saved.id ? { ...cur, ...saved } : cur));
  };

  const openCalibration = async () => {
    if (!sample) {
      try {
        const data = await api.profile();
        setSample(data.sample);
        applyProfile(data.profile);
      } catch {
        /* segue com o texto padrão do modal */
      }
    }
    setCalibrating(true);
  };

  if (loading) {
    return (
      <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-mark" style={{ margin: '0 auto 18px', width: 46, height: 46, borderRadius: 13 }}>
            <Icon name="cross" size={23} strokeWidth={2.2} />
          </div>
          <div className="brand-name" style={{ fontSize: 26, marginBottom: 14 }}>
            Púlpito
          </div>
          <div className="row" style={{ justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            <span className="spinner" /> preparando o silêncio…
          </div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="empty" style={{ maxWidth: 520 }}>
          <div className="empty-icon">
            <Icon name="info" size={24} />
          </div>
          <h3>Não foi possível abrir o Púlpito</h3>
          <p>{bootError}</p>
          <p className="small muted" style={{ marginTop: 10 }}>
            Verifique se a API está rodando em <code>http://127.0.0.1:4000</code> (use{' '}
            <code>npm run dev</code>).
          </p>
          <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${focusMode ? 'is-focus' : ''}`}>
      <TopBar
        view={route.view}
        onHome={goLibrary}
        theme={theme}
        onToggleTheme={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((value) => !value)}
        onSettings={() => setSettingsOpen(true)}
      />

      {route.view === 'editor' && current ? (
        <Editor
          key={current.id}
          sermon={current}
          profile={profile}
          versions={versions}
          sample={sample}
          focusMode={focusMode}
          onBack={goLibrary}
          onSaved={handleSaved}
          onOpenSettings={() => setSettingsOpen(true)}
          onCalibrate={openCalibration}
        />
      ) : (
        <Library
          sermons={sermons}
          stats={stats}
          profile={profile}
          loading={loadingSermon}
          onCreate={createSermon}
          onOpen={openSermon}
          onDelete={deleteSermon}
          onDuplicate={duplicateSermon}
          onCalibrate={openCalibration}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        profile={profile}
        stats={stats}
        versions={versions}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
        onCalibrate={() => {
          setSettingsOpen(false);
          openCalibration();
        }}
        onThemeChange={changeTheme}
      />

      <CalibrationModal
        open={calibrating}
        sample={sample}
        profile={profile}
        onClose={() => setCalibrating(false)}
        onDone={handleCalibrationDone}
      />
    </div>
  );
}
