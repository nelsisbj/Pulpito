import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { api } from '../lib/api.js';
import { BOOKS } from '@shared/books.js';
import { formatReference, parseReference } from '@shared/references.js';
import { clamp } from '../lib/utils.js';

const chapterCache = new Map();

function rangeNumbers(start, end) {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const out = [];
  for (let verse = from; verse <= to; verse += 1) out.push(verse);
  return out;
}

function toRuns(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const runs = [];
  for (const verse of sorted) {
    const last = runs[runs.length - 1];
    if (last && verse === last.end + 1) last.end = verse;
    else runs.push({ start: verse, end: verse });
  }
  return runs;
}

export default function BiblePanel({
  open,
  initialRef,
  initialMode = 'read',
  versions,
  defaultTranslation = 'ARA',
  onClose,
  onInsert,
  onStudy,
}) {
  const [tab, setTab] = useState(initialMode);
  const [translation, setTranslation] = useState(defaultTranslation);
  const [compareList, setCompareList] = useState([defaultTranslation, 'NAA', 'NTLH']);
  const [bookId, setBookId] = useState(43);
  const [chapter, setChapter] = useState(3);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [anchorVerse, setAnchorVerse] = useState(null);
  const [data, setData] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [refInput, setRefInput] = useState('');
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState('');

  const portuguese = versions || [];
  const currentBook = BOOKS.find((b) => b.id === bookId);

  useEffect(() => {
    if (!open) return;
    setTab(initialMode || 'read');
    setResults(null);
    setQuery('');
    setRefInput('');
    setRefError('');
    const parsed = initialRef ? parseReference(initialRef) : null;
    if (parsed) {
      setBookId(parsed.bookId);
      setChapter(parsed.chapter);
      if (parsed.verseStart) {
        const end = parsed.verseEnd || parsed.verseStart;
        setSelectedVerses(rangeNumbers(parsed.verseStart, end));
        setAnchorVerse(parsed.verseStart);
      } else {
        setSelectedVerses([]);
        setAnchorVerse(null);
      }
    } else {
      setSelectedVerses([]);
      setAnchorVerse(null);
    }
  }, [open, initialRef, initialMode]);

  const loadChapter = useCallback(
    async (tr, book, cap) => {
      const key = `${tr}:${book}:${cap}`;
      if (chapterCache.has(key)) {
        setData(chapterCache.get(key));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await api.chapter(tr, book, cap);
        chapterCache.set(key, result);
        setData(result);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    loadChapter(translation, bookId, chapter);
  }, [open, translation, bookId, chapter, loadChapter]);

  const selectedRuns = useMemo(() => toRuns(selectedVerses), [selectedVerses]);
  const selectedSet = useMemo(() => new Set(selectedVerses), [selectedVerses]);
  const selectedCount = selectedVerses.length;
  const isContiguous = selectedRuns.length === 1;

  const selectedRef = useMemo(() => {
    if (!isContiguous || !selectedRuns[0]) return null;
    const run = selectedRuns[0];
    return formatReference({
      bookId,
      chapter,
      verseStart: run.start,
      verseEnd: run.end > run.start ? run.end : null,
    });
  }, [bookId, chapter, selectedRuns, isContiguous]);

  const selectedLabel = useMemo(
    () =>
      selectedRuns
        .map((run) =>
          formatReference({
            bookId,
            chapter,
            verseStart: run.start,
            verseEnd: run.end > run.start ? run.end : null,
          }),
        )
        .join(' · '),
    [bookId, chapter, selectedRuns],
  );

  useEffect(() => {
    if (!open || tab !== 'compare' || !selectedRef) return;
    let cancelled = false;
    setCompareLoading(true);
    api
      .compare(selectedRef, compareList)
      .then((result) => {
        if (!cancelled) setCompareData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tab, selectedRef, compareList]);

  if (!open) return null;

  const verses = data?.verses || [];
  const buildBlocks = () => {
    return selectedRuns
      .map((run) => {
        const runVerses = verses.filter((v) => v.verse >= run.start && v.verse <= run.end);
        const text = runVerses.map((v) => v.text).join(' ').trim();
        const ref = formatReference({
          bookId,
          chapter,
          verseStart: run.start,
          verseEnd: run.end > run.start ? run.end : null,
        });
        return { text, ref };
      })
      .filter((block) => block.text);
  };

  const clearSelection = () => {
    setSelectedVerses([]);
    setAnchorVerse(null);
  };

  const selectSingle = (verse) => {
    setSelectedVerses([verse]);
    setAnchorVerse(verse);
  };

  const toggleVerse = (verse) => {
    setSelectedVerses((current) =>
      current.includes(verse)
        ? current.filter((item) => item !== verse)
        : [...current, verse].sort((a, b) => a - b),
    );
    setAnchorVerse(verse);
  };

  const extendSelectionTo = (verse) => {
    const anchor = anchorVerse ?? verse;
    setSelectedVerses(rangeNumbers(anchor, verse));
    setAnchorVerse(anchor);
  };

  const selectWholeChapter = () => {
    setSelectedVerses(verses.map((verse) => verse.verse));
    setAnchorVerse(verses[0]?.verse ?? null);
  };

  const go = (delta) => {
    const next = chapter + delta;
    const max = currentBook?.chapters || 1;
    if (next < 1) {
      const index = BOOKS.findIndex((b) => b.id === bookId);
      const prevBook = BOOKS[index - 1];
      if (prevBook) {
        setBookId(prevBook.id);
        setChapter(prevBook.chapters);
        clearSelection();
      }
      return;
    }
    if (next > max) {
      const index = BOOKS.findIndex((b) => b.id === bookId);
      const nextBook = BOOKS[index + 1];
      if (nextBook) {
        setBookId(nextBook.id);
        setChapter(1);
        clearSelection();
      }
      return;
    }
    setChapter(next);
    clearSelection();
  };

  const toggleCompare = (id) => {
    setCompareList((current) => {
      if (current.includes(id)) {
        if (current.length <= 2) return current;
        return current.filter((item) => item !== id);
      }
      if (current.length >= 4) return [...current.slice(1), id];
      return [...current, id];
    });
  };

  const doSearch = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const result = await api.search(q, translation);
      setResults(result.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const insert = (withText = true) => {
    const blocks = buildBlocks();
    if (!blocks.length) return;
    onInsert?.({
      text: blocks.map((block) => block.text).join(' '),
      ref: blocks.map((block) => block.ref).join('; '),
      translation,
      count: blocks.length,
      html: blocks
        .map((block) => (withText ? `“${block.text}” (${block.ref})` : `(${block.ref})`))
        .join('<br>'),
    });
  };

  const insertQuickRefs = async () => {
    if (refBusy) return;
    const tokens = refInput
      .split(/[;\n]+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (!tokens.length) {
      setRefError('Digite pelo menos uma referência.');
      return;
    }

    const parsed = [];
    const invalid = [];
    const seen = new Set();
    for (const token of tokens) {
      const ref = parseReference(token);
      if (!ref) {
        invalid.push(token);
        continue;
      }
      const key = formatReference(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push({ token, ref });
    }

    if (invalid.length) {
      setRefError(`Não entendi: ${invalid.join(', ')}. Use o formato "João 3:16; Rm 5:8".`);
      return;
    }
    if (!parsed.length) {
      setRefError('Nenhuma referência válida foi encontrada.');
      return;
    }

    setRefBusy(true);
    setRefError('');
    try {
      const loaded = await Promise.all(
        parsed.map((item) => api.verse(formatReference(item.ref), translation)),
      );
      const blocks = loaded.map((verse, index) => ({
        text: verse.text,
        ref: verse.ref || formatReference(parsed[index].ref),
      }));
      onInsert?.({
        text: blocks.map((block) => block.text).join(' '),
        ref: blocks.map((block) => block.ref).join('; '),
        translation,
        count: blocks.length,
        html: blocks.map((block) => `“${block.text}” (${block.ref})`).join('<br>'),
      });
      setRefInput('');
    } catch (err) {
      setRefError(err.message);
    } finally {
      setRefBusy(false);
    }
  };

  return (
    <Modal
      title="Bíblia"
      subtitle="Leia, compare versões e insira o texto no sermão."
      icon="bible"
      size="modal-lg"
      onClose={onClose}
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <span className="small muted" style={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedCount ? (
              <>
                {selectedCount === 1 ? 'Selecionado: ' : `${selectedCount} versículos: `}
                <strong style={{ color: 'var(--ink)' }} title={selectedLabel}>
                  {selectedLabel}
                </strong>
              </>
            ) : (
              'Clique em um versículo; use Shift ou Ctrl para selecionar vários'
            )}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => insert(false)} disabled={!selectedCount}>
              Só {selectedCount > 1 ? 'as referências' : 'a referência'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => insert(true)} disabled={!selectedCount}>
              <Icon name="plus" size={14} /> Inserir{' '}
              {selectedCount > 1 ? `${selectedCount} versículos` : 'versículo'}
            </button>
          </div>
        </div>
      }
    >
      <div className="tabs">
        <button className={`tab-btn ${tab === 'read' ? 'is-active' : ''}`} onClick={() => setTab('read')}>
          <Icon name="book" size={14} /> Ler
        </button>
        <button className={`tab-btn ${tab === 'compare' ? 'is-active' : ''}`} onClick={() => setTab('compare')}>
          <Icon name="compare" size={14} /> Comparar versões
        </button>
      </div>

      <div className="bible-nav">
        <select
          className="select"
          value={bookId}
          onChange={(event) => {
            const book = BOOKS.find((b) => b.id === Number(event.target.value));
            setBookId(book.id);
            setChapter(1);
            clearSelection();
          }}
          aria-label="Livro"
        >
          <optgroup label="Antigo Testamento">
            {BOOKS.filter((b) => b.testament === 'AT').map((book) => (
              <option key={book.id} value={book.id}>
                {book.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Novo Testamento">
            {BOOKS.filter((b) => b.testament === 'NT').map((book) => (
              <option key={book.id} value={book.id}>
                {book.name}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => go(-1)} title="Anterior">
            <Icon name="chevronLeft" size={17} />
          </button>
          <input
            className="input chapter-input"
            type="number"
            min={1}
            max={currentBook?.chapters || 150}
            value={chapter}
            onChange={(event) => {
              const value = clamp(Number(event.target.value) || 1, 1, currentBook?.chapters || 150);
              setChapter(value);
              clearSelection();
            }}
            aria-label="Capítulo"
          />
          <span className="small muted">/ {currentBook?.chapters}</span>
          <button className="icon-btn" onClick={() => go(1)} title="Próximo">
            <Icon name="chevronRight" size={17} />
          </button>
        </div>

        {tab === 'read' ? (
          <select
            className="select"
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            aria-label="Versão"
            style={{ marginLeft: 'auto' }}
          >
            {portuguese.map((version) => (
              <option key={version.id} value={version.id}>
                {version.id} · {version.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {tab === 'compare' ? (
        <div className="version-chips">
          {portuguese.slice(0, 12).map((version) => (
            <button
              key={version.id}
              className={`chip ${compareList.includes(version.id) ? 'is-active' : ''}`}
              onClick={() => toggleCompare(version.id)}
              title={version.name}
            >
              {version.id}
            </button>
          ))}
          <span className="small muted" style={{ alignSelf: 'center', marginLeft: 4 }}>
            escolha de 2 a 4
          </span>
        </div>
      ) : null}

      <form className="row mt-2" onSubmit={doSearch} style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon
            name="search"
            size={15}
            style={{ position: 'absolute', left: 11, top: 11, color: 'var(--faint)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34, height: 36 }}
            placeholder="Buscar por palavra ou frase…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button className="btn btn-sm" type="submit" disabled={searching}>
          {searching ? <span className="spinner" /> : 'Buscar'}
        </button>
      </form>

      {tab === 'read' ? (
        <div className="quick-refs">
          <div className="row-between">
            <span className="rail-title" style={{ margin: 0 }}>
              <Icon name="link" size={13} /> Adicionar várias referências
            </span>
            <span className="small muted">separe com ponto e vírgula</span>
          </div>
          <div className="quick-refs-row">
            <input
              className="input"
              placeholder="João 3:16; Rm 5:8; Efésios 2:8-9"
              value={refInput}
              onChange={(event) => {
                setRefInput(event.target.value);
                setRefError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  insertQuickRefs();
                }
              }}
              aria-label="Várias referências"
            />
            <button className="btn btn-sm" onClick={insertQuickRefs} disabled={refBusy}>
              {refBusy ? <span className="spinner" /> : <Icon name="plus" size={14} />}
              Inserir todas
            </button>
          </div>
          {refError ? <p className="hint" style={{ color: 'var(--danger)', margin: '8px 0 0' }}>{refError}</p> : null}
        </div>
      ) : null}

      {error ? (
        <div className="note-callout" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}>
          {error}
        </div>
      ) : null}

      {results ? (
        <div className="stack">
          <div className="row-between">
            <span className="small muted">{results.length} resultados</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setResults(null)}>
              <Icon name="x" size={13} /> Fechar busca
            </button>
          </div>
          <div className="ref-list">
            {results.map((item, index) => (
              <button
                key={`${item.bookId}-${item.chapter}-${item.verseStart}-${index}`}
                className="ref-item"
                onClick={() => {
                  setBookId(item.bookId);
                  setChapter(item.chapter);
                  const start = item.verseStart || 1;
                  setSelectedVerses(rangeNumbers(start, item.verseEnd || start));
                  setAnchorVerse(start);
                  setResults(null);
                  setTab('read');
                }}
              >
                <b style={{ color: 'var(--accent)', minWidth: 110 }}>{formatReference(item)}</b>
                <span style={{ flex: 1, color: 'var(--muted)' }}>
                  {item.text.slice(0, 110)}
                  {item.text.length > 110 ? '…' : ''}
                </span>
              </button>
            ))}
            {!results.length ? <div className="empty small">Nenhum versículo encontrado.</div> : null}
          </div>
        </div>
      ) : tab === 'read' ? (
        loading ? (
          <div className="loading-block">
            <span className="spinner" /> carregando {currentBook?.name} {chapter}…
          </div>
        ) : (
          <div>
            <div className="verse-tools">
              <span className="hint">
                Clique para um · <strong>Shift</strong> para faixa · <strong>Ctrl/Cmd</strong> para
                alternar
              </span>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={selectWholeChapter}
                  disabled={!verses.length}
                >
                  Selecionar capítulo
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={clearSelection}
                  disabled={!selectedCount}
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="verse-list">
              {verses.map((verse) => {
                const inSelection = selectedSet.has(verse.verse);
                return (
                  <div
                    key={verse.verse}
                    className={`verse-row ${inSelection ? 'is-selected' : ''}`}
                    data-verse={verse.verse}
                    onClick={(event) => {
                      if (event.shiftKey) {
                        extendSelectionTo(verse.verse);
                      } else if (event.ctrlKey || event.metaKey) {
                        toggleVerse(verse.verse);
                      } else {
                        selectSingle(verse.verse);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={inSelection}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') selectSingle(verse.verse);
                      if (event.key === ' ') {
                        event.preventDefault();
                        toggleVerse(verse.verse);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className="verse-check"
                      checked={inSelection}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleVerse(verse.verse)}
                      aria-label={`Selecionar ${verse.verse}`}
                    />
                    <span className="verse-num">{verse.verse}</span>
                    <span className="verse-text">{verse.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : selectedCount === 0 ? (
        <div className="empty small">Selecione um versículo para comparar.</div>
      ) : !isContiguous ? (
        <div className="empty small">
          Para comparar, selecione um trecho contínuo. Clique em um versículo e use Shift para
          estender.
        </div>
      ) : compareLoading ? (
        <div className="loading-block">
          <span className="spinner" /> comparando versões…
        </div>
      ) : compareData ? (
        <div className="compare-grid">
          {compareData.translations.map((item) =>
            item.ok ? (
              <div className="compare-col" key={item.translation}>
                <header>
                  <span>{item.translation}</span>
                  <span style={{ color: 'var(--faint)', fontWeight: 500 }}>{item.verses?.length} v.</span>
                </header>
                <div className="compare-text">{item.text}</div>
              </div>
            ) : (
              <div className="compare-col" key={item.translation}>
                <header>{item.translation}</header>
                <div className="compare-text" style={{ color: 'var(--danger)' }}>
                  {item.error}
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="empty small">Selecione um versículo para comparar.</div>
      )}

      {tab === 'read' && selectedRef ? (
        <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => onStudy?.(selectedRef)}>
            <Icon name="search" size={14} /> Abrir estudo
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
