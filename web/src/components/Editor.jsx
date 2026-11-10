import { useEffect, useMemo, useRef, useState } from 'react';
import RichText from './RichText.jsx';
import Toolbar from './Toolbar.jsx';
import Icon from './Icon.jsx';
import VerseTooltip from './VerseTooltip.jsx';
import BiblePanel from './BiblePanel.jsx';
import StudyPanel from './StudyPanel.jsx';
import MusicPanel from './MusicPanel.jsx';
import MusicPlayer from './MusicPlayer.jsx';
import ExportModal from './ExportModal.jsx';
import ShareModal from './ShareModal.jsx';
import { useToast } from './Toast.jsx';
import { api } from '../lib/api.js';
import { countWords, formatDuration, formatMinutes, truncate } from '../lib/utils.js';
import {
  caretRect,
  decorateReferences,
  focusEnd,
  insertHtmlAtCaret,
  insertTextAtCaret,
  isInside,
  replaceBeforeCaret,
  selectionInside,
  textBeforeCaret,
} from '../lib/editor.js';
import { createAmbient } from '../lib/ambient.js';

const OPENINGS = [
  'porque deus amou',
  'o senhor e meu pastor',
  'no principio',
  'tudo posso',
  'confia no senhor',
  'os que esperam',
  'vinde a mim',
  'eu sou o caminho',
  'deus e amor',
  'nao temas',
  'seja forte',
  'o senhor e a minha luz',
  'bem aventurados',
  'nao se turve',
  'lampada para os meus pes',
  'o choro pode durar',
  'aquele que habita',
  'ainda que a figueira',
  'porque eu bem sei os planos',
  'sabemos que todas as coisas',
  'o amor e paciente',
  'a graca de deus',
  'mas deus',
  'eu sou o bom pastor',
];

const fold = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Índice do início da última frase, mesmo sem espaço após o ponto. */
function sentenceBoundary(text) {
  let index = -1;
  const re = /[.!?](?=\s|$|[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g;
  let match;
  while ((match = re.exec(text)) !== null) index = match.index;
  return index;
}

export default function Editor({
  sermon,
  profile,
  versions,
  focusMode,
  onBack,
  onSaved,
  onOpenSettings,
  onCalibrate,
}) {
  const { toast, error: toastError } = useToast();
  const [draft, setDraft] = useState(sermon);
  const draftRef = useRef(sermon);
  const [saveState, setSaveState] = useState('saved');
  const [activeId, setActiveId] = useState('introduction');
  const [suggestion, setSuggestion] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [bible, setBible] = useState({ open: false, ref: null, mode: 'read' });
  const [study, setStudy] = useState({ open: false, ref: '' });
  const [musicOpen, setMusicOpen] = useState(false);
  const [featured, setFeatured] = useState([]);
  const [musicStatus, setMusicStatus] = useState(null);
  const [track, setTrack] = useState(null);
  const [ambientOn, setAmbientOn] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.35);
  const [railOpen, setRailOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [focusTarget, setFocusTarget] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const saveTimer = useRef(null);
  const saveSeq = useRef(0);
  const dirtyRef = useRef(false);
  const tagsTouched = useRef(false);
  const richRefs = useRef(new Map());
  const activeElRef = useRef(null);
  const lastRangeRef = useRef(null);
  const suggestTimer = useRef(null);
  const suggestAbort = useRef(null);
  const hideTooltipTimer = useRef(null);
  const ambientRef = useRef(null);

  const translation = draft.settings?.translation || profile?.settings?.translation || 'ARA';
  const wpm = profile?.wpm || 150;

  const metrics = useMemo(() => {
    const sections = draft.sections || {};
    const per = (html) => {
      const words = countWords(html);
      return { words, minutes: words / wpm };
    };
    const introduction = per(sections.introduction?.html);
    const conclusion = per(sections.conclusion?.html);
    const developments = (sections.developments || []).map((dev, index) => ({
      id: dev.id,
      title: dev.title || `Ponto ${index + 1}`,
      ...per(dev.html),
    }));
    const words = introduction.words + conclusion.words + developments.reduce((sum, d) => sum + d.words, 0);
    return {
      words,
      minutes: (words / wpm) * 1.1,
      sections: { introduction, developments, conclusion },
    };
  }, [draft.sections, wpm]);

  // ---------- carregamento de música ----------
  useEffect(() => {
    api.musicFeatured().then((r) => setFeatured(r.featured || [])).catch(() => {});
    api.musicStatus().then((r) => setMusicStatus(r.configured || null)).catch(() => {});
  }, []);

  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(suggestTimer.current);
      clearTimeout(hideTooltipTimer.current);
      suggestAbort.current?.abort();
      ambientRef.current?.dispose();
      if (dirtyRef.current) api.updateSermon(draftRef.current.id, draftRef.current).catch(() => {});
    },
    [],
  );

  // ---------- foco ----------
  useEffect(() => {
    if (!focusTarget) return;
    const instance = richRefs.current.get(focusTarget);
    const el = instance?.getEl?.();
    if (el) {
      focusEnd(el);
      setActiveId(focusTarget);
      activeElRef.current = el;
    }
    setFocusTarget(null);
  }, [focusTarget, draft.sections.developments.length]);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const el = activeElRef.current;
      if (el && isInside(el, sel.anchorNode)) {
        lastRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  useEffect(() => {
    const onScroll = () => setSuggestion(null);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);

  // ---------- salvar ----------
  async function persist(nextDraft) {
    const seq = ++saveSeq.current;
    setSaveState('saving');
    try {
      const payload = {
        title: nextDraft.title,
        theme: nextDraft.theme,
        sections: nextDraft.sections,
      };
      if (tagsTouched.current) payload.tags = nextDraft.tags;
      const saved = await api.updateSermon(nextDraft.id, payload);
      if (seq !== saveSeq.current) return saved;
      dirtyRef.current = false;
      setSaveState('saved');
      setDraft((current) => ({
        ...current,
        tags: tagsTouched.current ? current.tags : saved.tags,
        metrics: saved.metrics,
        updatedAt: saved.updatedAt,
      }));
      draftRef.current = { ...draftRef.current, tags: tagsTouched.current ? draftRef.current.tags : saved.tags, updatedAt: saved.updatedAt };
      onSaved?.(saved);
      return saved;
    } catch (err) {
      if (seq === saveSeq.current) setSaveState('error');
      throw err;
    }
  }

  const scheduleSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (dirtyRef.current) persist(draftRef.current).catch(() => {});
    }, 850);
  };

  const updateDraft = (updater) => {
    const next = typeof updater === 'function' ? updater(draftRef.current) : updater;
    draftRef.current = next;
    setDraft(next);
    dirtyRef.current = true;
    setSaveState('dirty');
    scheduleSave();
  };

  const saveNow = async () => {
    clearTimeout(saveTimer.current);
    if (!dirtyRef.current) return true;
    try {
      await persist(draftRef.current);
      return true;
    } catch {
      return false;
    }
  };

  const handleBack = async () => {
    setSuggestion(null);
    await saveNow();
    onBack();
  };

  // ---------- seções ----------
  const updateSectionHtml = (id, html) => {
    updateDraft((current) => {
      if (id === 'introduction') {
        return { ...current, sections: { ...current.sections, introduction: { html } } };
      }
      if (id === 'conclusion') {
        return { ...current, sections: { ...current.sections, conclusion: { html } } };
      }
      return {
        ...current,
        sections: {
          ...current.sections,
          developments: current.sections.developments.map((dev) => (dev.id === id ? { ...dev, html } : dev)),
        },
      };
    });
  };

  const updateDevTitle = (id, title) => {
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        developments: current.sections.developments.map((dev) => (dev.id === id ? { ...dev, title } : dev)),
      },
    }));
  };

  const addDevelopment = () => {
    const list = draftRef.current.sections.developments;
    if (list.length >= 16) {
      toast('Dezesseis pontos já é bastante — talvez seja hora de agrupar ideias.');
      return;
    }
    const id = `dev_${Math.random().toString(36).slice(2, 10)}`;
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        developments: [...current.sections.developments, { id, title: `Ponto ${list.length + 1}`, html: '' }],
      },
    }));
    setFocusTarget(id);
    setTimeout(() => {
      const inst = richRefs.current.get(id);
      const el = inst?.getEl?.();
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  const removeDevelopment = (id) => {
    const list = draftRef.current.sections.developments;
    if (list.length <= 1) {
      toast('Mantenha ao menos um ponto — ou escreva tudo na introdução.');
      return;
    }
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        developments: current.sections.developments.filter((dev) => dev.id !== id),
      },
    }));
  };

  const moveDevelopment = (id, direction) => {
    updateDraft((current) => {
      const list = [...current.sections.developments];
      const index = list.findIndex((dev) => dev.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...current, sections: { ...current.sections, developments: list } };
    });
  };

  // ---------- inserção ----------
  const insertHtml = (html, { close = true, count = 1 } = {}) => {
    const id = activeId;
    const instance = richRefs.current.get(id) || richRefs.current.get('introduction');
    const el = instance?.getEl?.();
    if (!el) {
      toastError('Clique em uma seção antes de inserir.');
      return;
    }
    el.focus();
    const sel = window.getSelection();
    const saved = lastRangeRef.current;
    if (saved && el.contains(saved.startContainer)) {
      const container = saved.startContainer;
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      const refSpan = element?.closest?.('.verse-ref');
      if (refSpan) {
        const after = document.createRange();
        after.setStartAfter(refSpan);
        after.collapse(true);
        // se a referência estava entre parênteses, posiciona depois do ")"
        const next = refSpan.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE) {
          const match = /^[)\],;:!?.]+\s*/.exec(next.nodeValue);
          if (match) after.setStart(next, match[0].length);
        }
        sel.removeAllRanges();
        sel.addRange(after);
      } else {
        sel.removeAllRanges();
        sel.addRange(saved);
      }
    } else {
      focusEnd(el);
    }

    const caret = sel.rangeCount ? sel.getRangeAt(0) : null;
    let prefix = '';
    if (caret) {
      const before = document.createRange();
      before.selectNodeContents(el);
      before.setEnd(caret.startContainer, caret.startOffset);
      const text = before.toString();
      if (text && !/[ \u00a0]$/.test(text)) prefix = '&nbsp;';
    }
    const payload = `${prefix}${html}`;

    let ok = false;
    try {
      ok = document.execCommand('insertHTML', false, payload);
    } catch {
      ok = false;
    }
    if (!ok) insertHtmlAtCaret(payload);
    if (sel.rangeCount) lastRangeRef.current = sel.getRangeAt(0).cloneRange();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      try {
        if (decorateReferences(el)) el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch {
        /* ignore */
      }
    }, 40);
    if (close) {
      setBible((current) => ({ ...current, open: false }));
      setStudy({ open: false, ref: '' });
      setTooltip(null);
    }
    toast(count > 1 ? `${count} versículos inseridos` : 'Versículo inserido');
  };

  const insertVerse = (verse) => {
    if (!verse) return;
    const ref = verse.ref || verse.reference || '';
    insertHtml(`“${verse.text}” (${ref})`);
  };

  // ---------- referências / tooltip ----------
  const showTooltip = (ref, rect) => {
    if (!ref || !rect) return;
    clearTimeout(hideTooltipTimer.current);
    setTooltip({
      ref,
      anchor: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
      },
    });
  };

  const hideTooltipSoon = () => {
    clearTimeout(hideTooltipTimer.current);
    hideTooltipTimer.current = setTimeout(() => setTooltip(null), 200);
  };

  // ---------- autocompletar ----------
  const maybeSuggest = async (el, manual = false) => {
    if (!el || !selectionInside(el)) {
      if (manual) toast('Clique dentro do texto e deixe o cursor no fim do trecho.');
      return;
    }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) {
      if (manual) toast('Deixe o cursor no fim do trecho, sem selecionar texto.');
      return;
    }

    const tail = textBeforeCaret(el, 300);
    if (!tail || !tail.trim()) {
      if (manual) toast('Escreva pelo menos três palavras do versículo antes de completar.');
      return;
    }

    let raw = '';
    let quoted = false;
    const quoteAt = Math.max(tail.lastIndexOf('"'), tail.lastIndexOf('“'));
    if (quoteAt >= 0) {
      const inside = tail.slice(quoteAt + 1);
      if (!/["”]/.test(inside)) {
        raw = tail.slice(quoteAt);
        quoted = true;
      }
    }
    if (!raw) {
      const boundary = Math.max(
        sentenceBoundary(tail),
        tail.lastIndexOf('\n'),
      );
      raw = tail.slice(boundary + 1);
    }
    raw = raw.replace(/^\s+/, '');
    const candidate = raw.replace(/^["“]/, '').trim();
    if (candidate.length < 8) {
      if (manual) toast('Escreva pelo menos três palavras do versículo.');
      return;
    }
    if (/[.!?]\s*$/.test(candidate)) {
      if (manual) toast('Tire o ponto final: a citação precisa terminar no meio da frase.');
      return;
    }
    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length < 3) {
      if (manual) toast('Escreva pelo menos três palavras do versículo.');
      return;
    }

    if (!manual && !quoted) {
      const normalized = fold(candidate);
      if (!OPENINGS.some((opening) => normalized.startsWith(opening))) return;
    }

    suggestAbort.current?.abort();
    const controller = new AbortController();
    suggestAbort.current = controller;
    try {
      const result = await api.suggest(candidate, translation, controller.signal);
      if (controller.signal.aborted) return;
      // o texto pode ter mudado enquanto a API respondia
      const currentTail = textBeforeCaret(el, 300);
      if (!currentTail || !currentTail.trimEnd().endsWith(candidate)) return;
      if (result?.match && result.match.score >= 0.7 && result.match.text) {
        const rect = caretRect();
        if (!rect) return;
        setSuggestion({
          data: result,
          rect: { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width, height: rect.height },
          rawLength: raw.length,
          sectionId: activeId,
          quoted,
        });
      } else if (manual) {
        toast('Não encontrei esse trecho. Tente mais palavras ou use o botão Versículo.', {
          duration: 4200,
        });
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (manual) toastError('Não foi possível consultar as citações agora. Tente novamente.');
    }
  };

  const scheduleSuggest = (el) => {
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => maybeSuggest(el, false), 1000);
  };

  const suggestAtCursor = () => {
    const el = activeElRef.current || richRefs.current.get(activeId)?.getEl?.();
    if (!el) {
      toastError('Clique dentro de uma seção do sermão primeiro.');
      return;
    }
    if (!selectionInside(el)) focusEnd(el);
    maybeSuggest(el, true);
  };

  const acceptSuggestion = (withText = true) => {
    if (!suggestion) return;
    const { data, rawLength, sectionId } = suggestion;
    const match = data.match;
    const instance = richRefs.current.get(sectionId);
    const el = instance?.getEl?.();
    if (!el) return;
    el.focus();

    if (withText) {
      const replacement = `“${match.text}” (${match.ref})`;
      const ok = replaceBeforeCaret(rawLength, replacement);
      if (!ok) insertTextAtCaret(` ${replacement}`);
    } else {
      insertTextAtCaret(` (${match.ref})`);
    }
    setSuggestion(null);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      try {
        if (decorateReferences(el)) el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch {
        /* ignore */
      }
    }, 40);
    toast(withText ? `Citação completada · ${match.ref}` : `Referência inserida · ${match.ref}`);
  };

  const handleEditorKeyDown = (event, el) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && (event.code === 'Space' || event.key === ' ')) {
      event.preventDefault();
      maybeSuggest(el, true);
      return;
    }
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveNow();
      return;
    }
    if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      setBible({ open: true, ref: null, mode: 'read' });
      return;
    }
    if (event.key === 'Tab' && suggestion) {
      event.preventDefault();
      acceptSuggestion(true);
      return;
    }
    if (event.key === 'Escape') {
      setSuggestion(null);
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
      setSuggestion(null);
    }
  };

  // ---------- tags ----------
  const addTag = (value) => {
    const clean = String(value || '').trim();
    if (!clean) return;
    tagsTouched.current = true;
    updateDraft((current) => ({
      ...current,
      tags: [...new Set([...(current.tags || []), clean])].slice(0, 12),
    }));
    setTagInput('');
  };

  const removeTag = (tag) => {
    tagsTouched.current = true;
    updateDraft((current) => ({ ...current, tags: (current.tags || []).filter((t) => t !== tag) }));
  };

  const suggestTags = async () => {
    try {
      const text = [
        draftRef.current.sections.introduction?.html,
        ...(draftRef.current.sections.developments || []).flatMap((dev) => [dev.title, dev.html]),
        draftRef.current.sections.conclusion?.html,
      ].join(' ');
      const result = await api.analyze(text, draftRef.current.title, draftRef.current.theme);
      tagsTouched.current = true;
      updateDraft((current) => ({ ...current, tags: (result.tags || []).map((t) => t.label) }));
      toast('Temas sugeridos a partir do texto');
    } catch (err) {
      toastError(err.message);
    }
  };

  // ---------- ambiente ----------
  const toggleAmbient = () => {
    if (!ambientRef.current) ambientRef.current = createAmbient();
    if (ambientOn) {
      ambientRef.current.stop();
      setAmbientOn(false);
    } else {
      ambientRef.current.setVolume(ambientVolume);
      ambientRef.current.start();
      setAmbientOn(true);
    }
  };

  useEffect(() => {
    ambientRef.current?.setVolume(ambientVolume);
  }, [ambientVolume]);

  // ---------- render ----------
  const introWords = metrics.sections.introduction.words;
  const conclusionWords = metrics.sections.conclusion.words;
  const devs = draft.sections.developments;

  return (
    <div className="editor-shell" onMouseDown={() => setSuggestion(null)}>
      <div className="editor-top">
        <div className="editor-top-row">
          <button className="back-btn" onClick={handleBack}>
            <Icon name="chevronLeft" size={16} /> Biblioteca
          </button>
          <div className={`save-state is-${saveState}`} title="Salvo automaticamente">
            <span className="save-dot" />
            {saveState === 'saving'
              ? 'salvando…'
              : saveState === 'error'
                ? 'não foi possível salvar'
                : saveState === 'dirty'
                  ? 'alterações não salvas'
                  : 'salvo'}
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShareOpen(true)}
            title="Compartilhar link de leitura"
          >
            <Icon name="link" size={15} /> <span className="share-label">Compartilhar</span>
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setExportOpen(true)}
            title="Exportar PDF e backup"
          >
            <Icon name="download" size={15} /> <span className="export-label">Exportar</span>
          </button>
          <button
            className="icon-btn rail-toggle"
            onClick={() => setRailOpen(true)}
            title="Abrir painel lateral"
            aria-label="Abrir painel lateral"
          >
            <Icon name="text" size={17} />
          </button>
          <button className="icon-btn" onClick={onOpenSettings} title="Ajustes">
            <Icon name="settings" size={17} />
          </button>
        </div>

        <input
          className="editor-title"
          value={draft.title}
          placeholder="Título do sermão"
          maxLength={180}
          onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
        />
        <input
          className="editor-theme"
          value={draft.theme}
          placeholder="Tema — o fio que conduz a mensagem"
          maxLength={180}
          onChange={(event) => updateDraft((current) => ({ ...current, theme: event.target.value }))}
        />

        <div className="editor-meta">
          <span className="meta-item">
            <Icon name="clock" size={14} /> <strong>{formatMinutes(metrics.minutes)}</strong> de pregação
          </span>
          <span className="meta-item">
            <Icon name="text" size={14} /> <strong>{metrics.words}</strong> palavras
          </span>
          <span className="meta-item">
            <Icon name="bible" size={14} /> <strong>{translation}</strong>
          </span>
          <span className="meta-item">
            <Icon name="tag" size={14} /> <strong>{draft.tags?.length || 0}</strong> temas
          </span>
          <span className="meta-item" style={{ marginLeft: 'auto' }}>
            <Icon name="sparkles" size={14} /> Ctrl+Espaço completa citações
          </span>
        </div>
      </div>

      <div className="editor-layout">
        <div className="editor-main">
          <Toolbar
            onInsertVerse={() => setBible({ open: true, ref: null, mode: 'read' })}
            onSuggest={suggestAtCursor}
          />
          <div className="paper">
            <section className="section-block">
              <div className="section-label-row">
                <span className="section-label">Introdução</span>
                <span className="section-words">{introWords} palavras</span>
              </div>
              <RichText
                ref={(instance) => {
                  if (instance) richRefs.current.set('introduction', instance);
                  else richRefs.current.delete('introduction');
                }}
                value={draft.sections.introduction?.html || ''}
                onChange={(html) => updateSectionHtml('introduction', html)}
                sectionId="introduction"
                onFocusEditor={(id, el) => {
                  setActiveId(id);
                  activeElRef.current = el;
                }}
                onActivity={(el) => scheduleSuggest(el)}
                onKeyDown={handleEditorKeyDown}
                onRefHover={showTooltip}
                onRefLeave={hideTooltipSoon}
                onRefClick={(ref) => {
                  setTooltip(null);
                  setStudy({ open: true, ref });
                }}
                placeholder="Abra a mensagem: um texto, uma pergunta, uma cena. Leve o ouvinte até o chão do texto…"
              />
            </section>

            <section className="section-block">
              <div className="section-label-row">
                <span className="section-label">Desenvolvimento</span>
                <span className="section-words">
                  {devs.length} {devs.length === 1 ? 'ponto' : 'pontos'} ·{' '}
                  {formatDuration(
                    metrics.sections.developments.reduce((sum, item) => sum + item.minutes, 0),
                  )}
                </span>
              </div>

              {devs.map((dev, index) => (
                <div className="dev-card" key={dev.id}>
                  <div className="dev-head">
                    <span className="dev-index">{index + 1}</span>
                    <input
                      className="dev-title"
                      value={dev.title}
                      placeholder={`Ponto ${index + 1}`}
                      maxLength={140}
                      onChange={(event) => updateDevTitle(dev.id, event.target.value)}
                    />
                    <div className="dev-actions">
                      <button
                        className="icon-btn"
                        title="Mover para cima"
                        disabled={index === 0}
                        onClick={() => moveDevelopment(dev.id, -1)}
                      >
                        <Icon name="arrowUp" size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Mover para baixo"
                        disabled={index === devs.length - 1}
                        onClick={() => moveDevelopment(dev.id, 1)}
                      >
                        <Icon name="arrowDown" size={14} />
                      </button>
                      <button className="icon-btn" title="Remover ponto" onClick={() => removeDevelopment(dev.id)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                  <RichText
                    ref={(instance) => {
                      if (instance) richRefs.current.set(dev.id, instance);
                      else richRefs.current.delete(dev.id);
                    }}
                    value={dev.html}
                    onChange={(html) => updateSectionHtml(dev.id, html)}
                    sectionId={dev.id}
                    onFocusEditor={(id, el) => {
                      setActiveId(id);
                      activeElRef.current = el;
                    }}
                    onActivity={(el) => scheduleSuggest(el)}
                    onKeyDown={handleEditorKeyDown}
                    onRefHover={showTooltip}
                    onRefLeave={hideTooltipSoon}
                    onRefClick={(ref) => {
                      setTooltip(null);
                      setStudy({ open: true, ref });
                    }}
                    placeholder="Desenvolva a ideia: explique o texto, ilustre, aplique. Deixe o argumento respirar…"
                  />
                </div>
              ))}

              <button className="add-dev" onClick={addDevelopment}>
                <Icon name="plus" size={16} /> Adicionar desenvolvimento
              </button>
            </section>

            <section className="section-block">
              <div className="section-label-row">
                <span className="section-label">Conclusão</span>
                <span className="section-words">{conclusionWords} palavras</span>
              </div>
              <RichText
                ref={(instance) => {
                  if (instance) richRefs.current.set('conclusion', instance);
                  else richRefs.current.delete('conclusion');
                }}
                value={draft.sections.conclusion?.html || ''}
                onChange={(html) => updateSectionHtml('conclusion', html)}
                sectionId="conclusion"
                onFocusEditor={(id, el) => {
                  setActiveId(id);
                  activeElRef.current = el;
                }}
                onActivity={(el) => scheduleSuggest(el)}
                onKeyDown={handleEditorKeyDown}
                onRefHover={showTooltip}
                onRefLeave={hideTooltipSoon}
                onRefClick={(ref) => {
                  setTooltip(null);
                  setStudy({ open: true, ref });
                }}
                placeholder="Conclua: recolha o fio, chame à resposta e termine com uma imagem que permaneça…"
              />
            </section>
          </div>

          <div className="row-between" style={{ margin: '18px 4px 0', color: 'var(--faint)', fontSize: 12 }}>
            <span>
              {metrics.words} palavras · {formatMinutes(metrics.minutes)} com pausas
            </span>
            <span>Salvo automaticamente</span>
          </div>
        </div>

        <aside className={`rail ${railOpen ? 'is-mobile-open' : ''}`}>
          <div className="rail-mobile-head">
            <span className="rail-title" style={{ margin: 0 }}>
              <Icon name="text" size={13} /> Painel
            </span>
            <button className="icon-btn" onClick={() => setRailOpen(false)} aria-label="Fechar painel">
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="rail-card">
            <div className="rail-title">
              <Icon name="clock" size={13} /> Tempo estimado
            </div>
            <div className="time-big">
              {formatMinutes(metrics.minutes).replace(' min', '')}
              <span>min</span>
            </div>
            <div className="small muted">
              {Math.round(wpm)} palavras/min · inclui pausas
            </div>
            <div className="time-breakdown">
              <div className="time-row">
                <span>Introdução</span>
                <b>{formatDuration(metrics.sections.introduction.minutes)}</b>
              </div>
              {metrics.sections.developments.map((item, index) => (
                <div className="time-row" key={item.id}>
                  <span>
                    {index + 1}. {truncate(item.title || `Ponto ${index + 1}`, 22)}
                  </span>
                  <b>{formatDuration(item.minutes)}</b>
                </div>
              ))}
              <div className="time-row">
                <span>Conclusão</span>
                <b>{formatDuration(metrics.sections.conclusion.minutes)}</b>
              </div>
            </div>
            <div className="rail-actions">
              <button className="btn btn-sm" onClick={onCalibrate}>
                <Icon name="clock" size={14} /> Calibrar
              </button>
              <button className="btn btn-sm" onClick={onOpenSettings}>
                <Icon name="settings" size={14} /> Ritmo
              </button>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-title">
              <Icon name="tag" size={13} /> Temas
              <button className="icon-btn" onClick={suggestTags} title="Sugerir temas pelo texto">
                <Icon name="sparkles" size={14} />
              </button>
            </div>
            <div className="rail-tags">
              {(draft.tags || []).length ? (
                draft.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                    <button onClick={() => removeTag(tag)} aria-label={`Remover ${tag}`}>
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                ))
              ) : (
                <span className="small muted">Os temas aparecem conforme você escreve.</span>
              )}
            </div>
            <div className="rail-add-tag">
              <input
                className="input"
                placeholder="Adicionar tema"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTag(tagInput);
                  }
                }}
              />
              <button className="icon-btn" onClick={() => addTag(tagInput)} title="Adicionar">
                <Icon name="plus" size={15} />
              </button>
            </div>
          </div>

          <div className="rail-card">
            <div className="rail-title">
              <Icon name="music" size={13} /> Música
            </div>
            <div className="small muted" style={{ marginBottom: 10 }}>
              {track ? track.title : 'Um som baixo para ajudar a concentrar.'}
            </div>
            <div className="row">
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setMusicOpen(true)}>
                <Icon name="headphones" size={14} /> Escolher
              </button>
              <button
                className={`btn btn-sm ${ambientOn ? 'btn-primary' : ''}`}
                onClick={toggleAmbient}
                title="Som ambiente gerado"
              >
                <Icon name="wave" size={14} /> {ambientOn ? 'On' : 'Ambiente'}
              </button>
            </div>
            {track ? (
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 6 }} onClick={() => setTrack(null)}>
                <Icon name="pause" size={14} /> Parar música
              </button>
            ) : null}
          </div>

          <div className="rail-card">
            <div className="rail-title">
              <Icon name="book" size={13} /> Estudo
            </div>
            <div className="small muted" style={{ marginBottom: 10 }}>
              Strong's, referências cruzadas, comparação de versões e suas notas.
            </div>
            <div className="row">
              <button
                className="btn btn-sm"
                style={{ flex: 1 }}
                onClick={() => setBible({ open: true, ref: null, mode: 'read' })}
              >
                <Icon name="bible" size={14} /> Bíblia
              </button>
              <button
                className="btn btn-sm"
                style={{ flex: 1 }}
                onClick={() => setStudy({ open: true, ref: draft.mainVerse || 'João 3:16' })}
              >
                <Icon name="search" size={14} /> Estudo
              </button>
            </div>
          </div>
        </aside>
      </div>

      <VerseTooltip
        data={tooltip}
        translation={translation}
        onClose={() => setTooltip(null)}
        onKeepOpen={() => clearTimeout(hideTooltipTimer.current)}
        onInsert={insertVerse}
        onStudy={(ref) => {
          setTooltip(null);
          setStudy({ open: true, ref });
        }}
        onCompare={(ref) => {
          setTooltip(null);
          setBible({ open: true, ref, mode: 'compare' });
        }}
      />

      {suggestion ? (
        <SuggestionPopover
          suggestion={suggestion}
          onAccept={() => acceptSuggestion(true)}
          onReference={() => acceptSuggestion(false)}
          onClose={() => setSuggestion(null)}
        />
      ) : null}

      <BiblePanel
        open={bible.open}
        initialRef={bible.ref}
        initialMode={bible.mode}
        versions={versions}
        defaultTranslation={translation}
        onClose={() => setBible({ ...bible, open: false })}
        onInsert={({ html, count }) => insertHtml(html, { count })}
        onStudy={(ref) => {
          setBible((current) => ({ ...current, open: false }));
          setStudy({ open: true, ref });
        }}
      />

      <StudyPanel
        open={study.open ? study.ref : null}
        translation={translation}
        versions={versions}
        onClose={() => setStudy({ open: false, ref: '' })}
        onOpenBible={(ref) => {
          setStudy({ open: false, ref: '' });
          setBible({ open: true, ref, mode: 'read' });
        }}
        onInsert={(html) => insertHtml(html)}
      />

      <MusicPanel
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        featured={featured}
        status={musicStatus}
        current={track}
        onPlay={(item) => {
          setTrack(item);
          setMusicOpen(false);
        }}
        onStop={() => setTrack(null)}
        ambient={{
          enabled: ambientOn,
          toggle: toggleAmbient,
          volume: ambientVolume,
          setVolume: setAmbientVolume,
        }}
      />

      <MusicPlayer current={track} onStop={() => setTrack(null)} />

      <ExportModal open={exportOpen} sermon={draft} onClose={() => setExportOpen(false)} />
      <ShareModal open={shareOpen} sermon={draft} onClose={() => setShareOpen(false)} />

      {railOpen ? <div className="rail-backdrop" onClick={() => setRailOpen(false)} /> : null}
    </div>
  );
}

function SuggestionPopover({ suggestion, onAccept, onReference, onClose }) {
  const { rect, data } = suggestion;
  const match = data.match;
  const width = 400;
  const left = Math.max(12, Math.min(rect.left || 40, window.innerWidth - width - 12));
  const top = Math.max(12, Math.min((rect.bottom || 100) + 10, window.innerHeight - 210));
  return (
    <div className="suggest" style={{ left, top }} onMouseDown={(event) => event.stopPropagation()}>
      <div className="suggest-head">
        <Icon name="sparkles" size={13} /> Citação reconhecida
        <button className="icon-btn" style={{ marginLeft: 'auto', width: 22, height: 22 }} onClick={onClose}>
          <Icon name="x" size={12} />
        </button>
      </div>
      <div className="suggest-body">
        <div className="suggest-ref">
          <strong>{match.ref}</strong>
          <span>{match.translation}</span>
        </div>
        <p className="suggest-text">{match.text}</p>
      </div>
      <div className="suggest-foot">
        <button className="btn btn-primary btn-sm" onClick={onAccept}>
          <Icon name="check" size={13} /> Completar citação
        </button>
        <button className="btn btn-sm" onClick={onReference}>
          Só referência
        </button>
        <span className="small muted" style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className="kbd">Tab</span> aceitar
        </span>
      </div>
    </div>
  );
}
