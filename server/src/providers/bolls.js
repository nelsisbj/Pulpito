import crypto from 'node:crypto';
import { BIBLE_BASE, BLOCKED_TRANSLATIONS, CACHE_DIR } from '../config.js';
import { ensureDir, readJson, writeJsonAtomic } from '../lib/fsx.js';
import { cleanVerseHtml, cleanVerseText, decodeEntities, sanitizeHtml } from '../lib/html.js';
import { BOOK_BY_ID } from '../../../shared/books.js';
import { getLocalTranslation, localRows, localSearch, localVersions } from './localBible.js';

export class BibleError extends Error {
  constructor(message, { status = 502, code = 'bible_error' } = {}) {
    super(message);
    this.name = 'BibleError';
    this.status = status;
    this.code = code;
  }
}

const mem = new Map();
const inflight = new Map();

const hashKey = (key) => crypto.createHash('sha1').update(key).digest('hex');

function diskPath(key) {
  return `${CACHE_DIR}/bolls-${hashKey(key)}.json`;
}

async function readDisk(key, now) {
  try {
    const entry = await readJson(diskPath(key), null);
    if (entry && entry.expires > now) return entry.value;
  } catch {
    /* cache corrompido: ignora */
  }
  return undefined;
}

async function writeDisk(key, value, expires) {
  try {
    await ensureDir(CACHE_DIR);
    await writeJsonAtomic(diskPath(key), { expires, value });
  } catch {
    /* cache é opcional */
  }
}

async function fetchWithTimeout(url, { timeout = 16000, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}, attempt = 0) {
  try {
    const response = await fetchWithTimeout(url, options);
    if (!response.ok) {
      throw new BibleError(`A API bíblica respondeu ${response.status}.`, {
        status: response.status === 404 ? 404 : 502,
        code: 'upstream_error',
      });
    }
    return await response.json();
  } catch (err) {
    if (attempt < 2 && (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.name === 'TypeError')) {
      await new Promise((r) => setTimeout(r, 400 + attempt * 600));
      return fetchJson(url, options, attempt + 1);
    }
    if (err instanceof BibleError) throw err;
    throw new BibleError('Não foi possível falar com a API bíblica agora. Tente novamente.', {
      status: 504,
      code: 'upstream_unreachable',
    });
  }
}

/** Cache em memória + disco com "single flight" para evitar chamadas duplicadas. */
async function cached(key, ttlMs, loader, { disk = true } = {}) {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    if (disk) {
      const fromDisk = await readDisk(key, now);
      if (fromDisk !== undefined) {
        mem.set(key, { value: fromDisk, expires: now + ttlMs });
        return fromDisk;
      }
    }
    const value = await loader();
    const expires = now + ttlMs;
    mem.set(key, { value, expires });
    if (disk) writeDisk(key, value, expires);
    return value;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

function assertTranslation(translation) {
  const tr = String(translation || '').trim();
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(tr)) {
    throw new BibleError('Tradução inválida.', { status: 400, code: 'invalid_translation' });
  }
  if (BLOCKED_TRANSLATIONS.has(tr)) {
    throw new BibleError('Esta tradução não está disponível para leitura.', {
      status: 409,
      code: 'translation_blocked',
    });
  }
  return tr;
}

function assertChapter(book, chapter) {
  const b = Number(book);
  const c = Number(chapter);
  const meta = BOOK_BY_ID.get(b);
  if (!meta) throw new BibleError('Livro inválido.', { status: 400, code: 'invalid_book' });
  if (!Number.isInteger(c) || c < 1 || c > meta.chapters) {
    throw new BibleError(`Capítulo inválido para ${meta.name}.`, { status: 400, code: 'invalid_chapter' });
  }
  return { book: b, chapter: c };
}

let translationsPromise = null;

export async function getVersions() {
  if (!translationsPromise) {
    translationsPromise = cached(
      'translations-v1',
      12 * 60 * 60 * 1000,
      async () => {
        const data = await fetchJson(`${BIBLE_BASE}/static/bolls/app/views/languages.json`);
        const groups = Array.isArray(data) ? data : [];
        return groups.map((group) => ({
          language: group.language,
          translations: (group.translations || [])
            .filter((t) => !BLOCKED_TRANSLATIONS.has(t.short_name))
            .map((t) => ({ id: t.short_name, name: t.full_name, updated: t.updated || null })),
        })).filter((g) => g.translations.length);
      },
      { disk: true },
    ).catch((err) => {
      translationsPromise = null;
      throw err;
    });
  }
  return withLocalVersions(await translationsPromise);
}

/** Versões locais licenciadas, além das servidas pela API pública. */
async function withLocalVersions(groups) {
  const locals = await localVersions();
  if (!locals.length) return groups;
  const existing = new Set(groups.flatMap((group) => group.translations.map((t) => t.id)));
  const missing = locals.filter((item) => !existing.has(item.id));
  if (!missing.length) return groups;
  return [
    ...groups,
    {
      language: 'Português (local)',
      translations: missing.map((item) => ({
        id: item.id,
        name: item.name,
        updated: null,
        local: true,
      })),
    },
  ];
}

export async function getChapter(translation, book, chapter) {
  const local = await getLocalTranslation(translation);
  if (local) {
    const { book: b, chapter: c } = assertChapter(book, chapter);
    const rows = await localRows(local.id, b, c);
    if (!rows.length) {
      throw new BibleError('Capítulo não encontrado nesta tradução.', { status: 404, code: 'not_found' });
    }
    return {
      translation: local.id,
      book: b,
      bookName: BOOK_BY_ID.get(b)?.name || '',
      chapter: c,
      verses: rows,
    };
  }

  const tr = assertTranslation(translation);
  const { book: b, chapter: c } = assertChapter(book, chapter);
  const key = `chapter:v2:${tr}:${b}:${c}`;
  const rows = await cached(key, 6 * 60 * 60 * 1000, async () => {
    const data = await fetchJson(`${BIBLE_BASE}/get-chapter/${tr}/${b}/${c}/`);
    if (!Array.isArray(data) || !data.length) {
      throw new BibleError('Capítulo não encontrado.', { status: 404, code: 'not_found' });
    }
    const joined = data.map((row) => String(row.text || '')).join(' ');
    if (/proibiu de usar|proibida pela editora|Biblica, Inc\./i.test(joined)) {
      throw new BibleError('Esta tradução não está liberada para leitura.', {
        status: 409,
        code: 'translation_blocked',
      });
    }
    return data.map((row) => ({
      verse: Number(row.verse),
      html: cleanVerseHtml(row.text || ''),
      text: cleanVerseText(row.text || ''),
      comment: row.comment ? cleanVerseText(row.comment) : '',
    }));
  });

  return {
    translation: tr,
    book: b,
    bookName: BOOK_BY_ID.get(b)?.name || '',
    chapter: c,
    verses: rows,
  };
}

export function versesOf(chapterData, ref) {
  const start = ref?.verseStart ?? null;
  const end = ref?.verseEnd ?? start;
  if (!start) return chapterData.verses;
  return chapterData.verses.filter((v) => v.verse >= start && v.verse <= end);
}

export async function getVerse(ref, translation = 'ARA') {
  const chapterData = await getChapter(translation, ref.bookId, ref.chapter);
  const verses = versesOf(chapterData, ref);
  if (!verses.length) {
    throw new BibleError('Versículo não encontrado nesta tradução.', { status: 404, code: 'not_found' });
  }
  return {
    translation: chapterData.translation,
    bookId: ref.bookId,
    bookName: chapterData.bookName,
    chapter: ref.chapter,
    verseStart: ref.verseStart,
    verseEnd: ref.verseEnd,
    verses,
    text: verses.map((v) => v.text).join(' '),
    html: verses.map((v) => v.html).join(' '),
  };
}

export async function compareVersions(ref, translations = []) {
  const list = [...new Set(translations.map((t) => String(t).toUpperCase()))].slice(0, 4);
  if (!list.length) list.push('ARA');
  const results = await Promise.allSettled(list.map((tr) => getVerse(ref, tr)));
  return results.map((result, index) => {
    if (result.status === 'fulfilled') return { ok: true, ...result.value };
    return {
      ok: false,
      translation: list[index],
      error: result.reason?.message || 'Não foi possível carregar esta versão.',
      code: result.reason?.code || 'error',
    };
  });
}

export async function search(translation, query, { limit = 20, whole = false } = {}) {
  const q = String(query || '').trim().slice(0, 160);
  if (!q) return [];

  const local = await getLocalTranslation(translation);
  if (local) {
    return (await localSearch(local.id, q, { limit })) || [];
  }

  const tr = assertTranslation(translation);
  const key = `search:${tr}:${whole ? 'w' : 's'}:${q.toLowerCase()}`;
  const rows = await cached(
    key,
    60 * 60 * 1000,
    async () => {
      const url = new URL(`${BIBLE_BASE}/v2/find/${tr}`);
      url.searchParams.set('search', q);
      url.searchParams.set('match_case', 'false');
      url.searchParams.set('match_whole', whole ? 'true' : 'false');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('page', '1');
      const data = await fetchJson(url.toString());
      return Array.isArray(data?.results) ? data.results : [];
    },
    { disk: false },
  );
  return rows
    .filter((row) => row && row.text)
    .map((row) => ({
      translation: row.translation || tr,
      bookId: Number(row.book),
      bookName: BOOK_BY_ID.get(Number(row.book))?.name || '',
      chapter: Number(row.chapter),
      verseStart: Number(row.verse),
      verseEnd: null,
      text: cleanVerseText(row.text),
      html: cleanVerseHtml(row.text),
    }));
}

export async function randomVerse(translation = 'ARA') {
  const tr = assertTranslation(translation);
  const row = await fetchJson(`${BIBLE_BASE}/get-random-verse/${tr}/`);
  return {
    translation: tr,
    bookId: Number(row.book),
    bookName: BOOK_BY_ID.get(Number(row.book))?.name || '',
    chapter: Number(row.chapter),
    verseStart: Number(row.verse),
    verseEnd: null,
    text: cleanVerseText(row.text),
    html: cleanVerseHtml(row.text),
  };
}

const strongCache = new Map();

function extract(html, label) {
  const re = new RegExp(`${label}:\\s*<b>([\\s\\S]*?)</b>`, 'i');
  const m = re.exec(html);
  return m ? cleanVerseText(m[1]) : '';
}

export async function lookupStrong(id) {
  const key = String(id || '').trim().toUpperCase();
  if (!/^[HG]\d{1,5}$/.test(key)) {
    throw new BibleError('Use um número Strong, por exemplo G26 ou H430.', {
      status: 400,
      code: 'invalid_strong',
    });
  }
  if (strongCache.has(key)) return strongCache.get(key);
  const entries = await cached(
    `strong:${key}`,
    30 * 24 * 60 * 60 * 1000,
    async () => {
      const data = await fetchJson(`${BIBLE_BASE}/dictionary-definition/BDBT/${key}/`);
      if (!Array.isArray(data) || !data.length) return [];
      return data;
    },
    { disk: true },
  );
  if (!entries.length) {
    throw new BibleError('Número Strong não encontrado.', { status: 404, code: 'not_found' });
  }
  const entry = entries[0];
  const raw = String(entry.definition || '');
  const lemmaMatch = /<el>([\s\S]*?)<\/el>/i.exec(raw);
  const readable = raw
    .replace(/<p\s*\/>/gi, '<br>')
    .replace(/<p[^>]*>/gi, '<br>')
    .replace(/<\/p>/gi, '')
    .replace(/<a[^>]*>/gi, '')
    .replace(/<\/a>/gi, '');
  const result = {
    id: entry.topic || key,
    lemma: lemmaMatch ? cleanVerseText(lemmaMatch[1]) : '',
    transliteration: extract(raw, 'Transliteration'),
    pronunciation: extract(raw, 'Phonetic'),
    shortDefinition: cleanVerseText(entry.short_definition || ''),
    lexeme: cleanVerseText(entry.lexeme || ''),
    definitionHtml: sanitizeHtml(readable),
    rawDefinition: cleanVerseText(raw),
  };
  strongCache.set(key, result);
  return result;
}

export async function searchStrong(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const data = await cached(
    `strong-search:${q.toLowerCase()}`,
    7 * 24 * 60 * 60 * 1000,
    async () => {
      const url = `${BIBLE_BASE}/dictionary-definition/BDBT/${encodeURIComponent(q)}/?extended=true`;
      const rows = await fetchJson(url);
      return Array.isArray(rows) ? rows : [];
    },
    { disk: true },
  );
  return data.slice(0, 12).map((row) => ({
    id: row.topic,
    shortDefinition: cleanVerseText(row.short_definition || ''),
    lemma: cleanVerseText(row.lexeme || ''),
    transliteration: cleanVerseText(row.transliteration || ''),
    definition: cleanVerseText(row.definition || '').slice(0, 280),
    weight: row.weight,
  }));
}

export { decodeEntities };
