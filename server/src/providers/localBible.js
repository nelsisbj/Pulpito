import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../config.js';
import { readJson } from '../lib/fsx.js';
import { escapeHtml } from '../lib/html.js';
import { BOOK_BY_ID } from '../../../shared/books.js';
import { foldText } from '../../../shared/references.js';

const DIR = path.join(DATA_DIR, 'translations');
const TTL = 30_000;
let cache = { at: 0, map: new Map() };

/**
 * Traduções locais licenciadas.
 *
 * Formato do arquivo em data/translations/<ID>.json:
 * {
 *   "id": "NVI",
 *   "name": "Nova Versão Internacional",
 *   "language": "Português",
 *   "license": "Licença do detentor dos direitos",
 *   "verses": { "43:3:16": "Porque Deus amou o mundo..." }
 * }
 */
async function load() {
  const now = Date.now();
  if (now - cache.at < TTL) return cache.map;

  const map = new Map();
  try {
    const files = (await fs.readdir(DIR)).filter((file) => file.toLowerCase().endsWith('.json'));
    for (const file of files) {
      let data;
      try {
        data = await readJson(path.join(DIR, file), null);
      } catch {
        continue;
      }
      if (!data || typeof data !== 'object' || !data.id || typeof data.verses !== 'object') continue;

      const id = String(data.id).trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,24}$/.test(id)) continue;

      const verses = {};
      for (const [key, value] of Object.entries(data.verses)) {
        const match = /^(\d{1,2}):(\d{1,3}):(\d{1,3})$/.exec(String(key).trim());
        if (!match || typeof value !== 'string' || !value.trim()) continue;
        const bookId = Number(match[1]);
        const chapter = Number(match[2]);
        const verse = Number(match[3]);
        const book = BOOK_BY_ID.get(bookId);
        if (!book || chapter < 1 || chapter > book.chapters || verse < 1) continue;
        verses[`${bookId}:${chapter}:${verse}`] = value.trim();
      }
      if (!Object.keys(verses).length) continue;

      map.set(id, {
        id,
        name: String(data.name || id),
        language: String(data.language || 'Português'),
        license: String(data.license || ''),
        verses,
      });
    }
  } catch {
    /* pasta ausente: nenhuma tradução local */
  }

  cache = { at: now, map };
  return map;
}

export async function localVersions() {
  const map = await load();
  return [...map.values()]
    .map(({ id, name, language, license }) => ({ id, name, language, license }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export async function getLocalTranslation(id) {
  const map = await load();
  return map.get(String(id || '').trim().toUpperCase()) || null;
}

export async function localRows(id, bookId, chapter) {
  const translation = await getLocalTranslation(id);
  if (!translation) return null;
  const prefix = `${bookId}:${chapter}:`;
  return Object.entries(translation.verses)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, text]) => ({
      verse: Number(key.split(':')[2]),
      text,
      html: escapeHtml(text),
      comment: '',
    }))
    .sort((a, b) => a.verse - b.verse);
}

export async function localSearch(id, query, { limit = 20 } = {}) {
  const translation = await getLocalTranslation(id);
  if (!translation) return null;
  const needle = foldText(query)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (needle.length < 3) return [];

  const results = [];
  for (const [key, text] of Object.entries(translation.verses)) {
    if (!foldText(text).includes(needle)) continue;
    const [bookId, chapter, verse] = key.split(':').map(Number);
    results.push({
      translation: translation.id,
      bookId,
      bookName: BOOK_BY_ID.get(bookId)?.name || '',
      chapter,
      verseStart: verse,
      verseEnd: null,
      text,
      html: escapeHtml(text),
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function localVerseCount() {
  const map = await load();
  return [...map.values()].reduce((sum, item) => sum + Object.keys(item.verses).length, 0);
}
