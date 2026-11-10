// Parser de referências bíblicas em português.
// Funciona tanto no servidor (Node) quanto no navegador (Vite).
import { BOOKS, CHAPTER_COUNTS, bookName } from './books.js';

const foldChar = (ch) => {
  const base = ch.normalize('NFD')[0];
  return base.toLowerCase();
};

/** Minúsculas e sem acentos, preservando o comprimento (índices 1:1). */
export function foldText(text) {
  let out = '';
  for (const ch of String(text)) out += foldChar(ch);
  return out;
}

export function foldWord(word) {
  return foldText(word).replace(/[^a-z0-9]+/g, ' ').trim();
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Aliases → lista de candidatos (ids). Resolve colisões como "jo" (Jó/João).
const ALIAS_CANDIDATES = (() => {
  const map = new Map();
  const add = (alias, id) => {
    const key = foldText(alias).replace(/\./g, '').trim();
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(id)) list.push(id);
  };
  for (const book of BOOKS) {
    add(book.name, book.id);
    add(book.abbrev, book.id);
    for (const a of book.aliases) add(a, book.id);
  }
  // "jo" é ambíguo: João é o uso mais comum, Jó fica como alternativa.
  if (map.has('jo')) {
    const list = map.get('jo').filter((id) => id !== 43 && id !== 18);
    map.set('jo', [43, 18, ...list]);
  }
  return map;
})();

const ALIAS_KEYS = [...ALIAS_CANDIDATES.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
const ALIAS_PATTERN = ALIAS_KEYS.map(escapeRe).join('|');

const REF_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(${ALIAS_PATTERN})\\.?\\s*(\\d{1,3})(?!\\d)(?:\\s*[:.]\\s*(\\d{1,3})(?!\\d)(?:\\s*[-–—]\\s*(\\d{1,3})(?!\\d))?)?`,
  'gu',
);

function pickBook(aliasKey, chapter) {
  const candidates = ALIAS_CANDIDATES.get(aliasKey) || [];
  if (!candidates.length) return null;
  const valid = candidates.find((id) => chapter <= (CHAPTER_COUNTS[id] ?? 999) && chapter >= 1);
  return valid ?? candidates[0];
}

export function formatReference(ref) {
  if (!ref || !ref.bookId) return '';
  const name = bookName(ref.bookId) || '';
  if (!ref.chapter) return name;
  let out = `${name} ${ref.chapter}`;
  if (ref.verseStart) {
    out += `:${ref.verseStart}`;
    if (ref.verseEnd && ref.verseEnd > ref.verseStart) out += `-${ref.verseEnd}`;
  }
  return out;
}

export function parseReference(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const folded = foldText(text);
  REF_RE.lastIndex = 0;
  const m = REF_RE.exec(folded);
  if (!m) return null;
  if (m.index !== 0 || m[0].length !== text.length) return null;
  const bookId = pickBook(m[1], Number(m[2]));
  if (!bookId) return null;
  return {
    bookId,
    bookName: bookName(bookId),
    chapter: Number(m[2]),
    verseStart: m[3] ? Number(m[3]) : null,
    verseEnd: m[4] ? Number(m[4]) : null,
    raw: text,
    canonical: formatReference({
      bookId,
      chapter: Number(m[2]),
      verseStart: m[3] ? Number(m[3]) : null,
      verseEnd: m[4] ? Number(m[4]) : null,
    }),
  };
}

/** Encontra todas as referências em um texto puro. */
export function findReferences(text, { requireVerse = false } = {}) {
  const source = String(text ?? '');
  if (!source) return [];
  const folded = foldText(source);
  const out = [];
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(folded)) !== null) {
    const chapter = Number(m[2]);
    if (!chapter) continue;
    if (requireVerse && !m[3]) continue;
    const bookId = pickBook(m[1], chapter);
    if (!bookId) continue;
    const verseStart = m[3] ? Number(m[3]) : null;
    const verseEnd = m[4] ? Number(m[4]) : null;
    const ref = {
      bookId,
      chapter,
      verseStart,
      verseEnd: verseEnd && verseStart && verseEnd > verseStart ? verseEnd : null,
    };
    ref.bookName = bookName(bookId);
    ref.canonical = formatReference(ref);
    out.push({ start: m.index, end: m.index + m[0].length, raw: source.slice(m.index, m.index + m[0].length), ref });
  }
  return out;
}

export function sameReference(a, b) {
  if (!a || !b) return false;
  return (
    Number(a.bookId) === Number(b.bookId) &&
    Number(a.chapter) === Number(b.chapter) &&
    (a.verseStart ?? null) === (b.verseStart ?? null) &&
    (a.verseEnd ?? null) === (b.verseEnd ?? null)
  );
}

export function referenceSlug(ref) {
  const base = `${ref.bookId}-${ref.chapter}`;
  if (!ref.verseStart) return base;
  return `${base}-${ref.verseStart}${ref.verseEnd ? `-${ref.verseEnd}` : ''}`;
}

export function verseLabel(ref) {
  if (!ref?.verseStart) return `${bookName(ref.bookId)} ${ref.chapter}`;
  return `${ref.verseStart}${ref.verseEnd ? `-${ref.verseEnd}` : ''}`;
}
