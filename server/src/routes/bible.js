import express from 'express';
import { BOOKS } from '../../../shared/books.js';
import { formatReference, parseReference } from '../../../shared/references.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import {
  compareVersions,
  getChapter,
  getVerse,
  getVersions,
  randomVerse,
  search,
} from '../providers/bolls.js';
import { suggestVerse } from '../services/suggest.js';
import { DEFAULT_TRANSLATION } from '../config.js';

const router = express.Router();

function refFromRequest(input) {
  if (!input) throw new HttpError('Informe uma referência.', 400, 'missing_reference');
  if (typeof input === 'string') {
    const parsed = parseReference(input);
    if (!parsed) throw new HttpError(`Não entendi a referência "${input}".`, 400, 'invalid_reference');
    return parsed;
  }
  const base = parseRefInputObject(input);
  return base;
}

function parseRefInputObject(input) {
  const bookId = Number(input.bookId);
  const chapter = Number(input.chapter);
  if (!bookId || !chapter) throw new HttpError('Informe livro e capítulo.', 400, 'invalid_reference');
  const verseStart = input.verseStart != null && input.verseStart !== '' ? Number(input.verseStart) : null;
  const verseEnd = input.verseEnd != null && input.verseEnd !== '' ? Number(input.verseEnd) : null;
  return {
    bookId,
    chapter,
    verseStart: Number.isFinite(verseStart) ? verseStart : null,
    verseEnd: Number.isFinite(verseEnd) && verseStart && verseEnd > verseStart ? verseEnd : null,
  };
}

router.get('/versions', asyncHandler(async (_req, res) => {
  const groups = await getVersions();
  const portuguese = groups
    .filter((group) => /portugu/i.test(group.language))
    .flatMap((group) => group.translations);
  const seen = new Set();
  const uniquePortuguese = portuguese.filter((version) => {
    if (seen.has(version.id)) return false;
    seen.add(version.id);
    return true;
  });
  const preferred = ['ARA', 'NAA', 'NTLH', 'ARC09', 'ACF11', 'KJA', 'NVT', 'TB10', 'OL', 'VFL', 'NBV07', 'ALM21', 'CNBB', 'MENS'];
  const order = new Map(preferred.map((id, index) => [id, index]));
  uniquePortuguese.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.name.localeCompare(b.name, 'pt-BR'));
  res.json({
    default: DEFAULT_TRANSLATION,
    portuguese: uniquePortuguese,
    languages: groups,
    blocked: ['NVIPT'],
    note: 'A NVI/NVIPT não é disponibilizada pela editora nesta API. Traduções locais licenciadas podem ser adicionadas em data/translations/.',
  });
}));

router.get('/books', (_req, res) => {
  res.json({
    books: BOOKS.map(({ id, name, abbrev, testament, chapters }) => ({ id, name, abbrev, testament, chapters })),
  });
});

router.get('/chapter', asyncHandler(async (req, res) => {
  const translation = req.query.translation || DEFAULT_TRANSLATION;
  const book = Number(req.query.book);
  const chapter = Number(req.query.chapter);
  const data = await getChapter(translation, book, chapter);
  res.json(data);
}));

router.get('/verse', asyncHandler(async (req, res) => {
  const translation = req.query.translation || DEFAULT_TRANSLATION;
  const ref = refFromRequest(req.query.ref || {
    bookId: req.query.book,
    chapter: req.query.chapter,
    verseStart: req.query.verse,
    verseEnd: req.query.verseEnd,
  });
  const data = await getVerse(ref, translation);
  res.json({ ...data, ref: formatReference(ref) });
}));

router.post('/compare', asyncHandler(async (req, res) => {
  const ref = refFromRequest(req.body.ref);
  const translations = Array.isArray(req.body.translations) && req.body.translations.length
    ? req.body.translations
    : ['ARA', 'NAA', 'NTLH'];
  const results = await compareVersions(ref, translations);
  res.json({ ref: formatReference(ref), translations: results });
}));

router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) throw new HttpError('Busque por pelo menos 3 caracteres.', 400, 'query_too_short');
  const translation = req.query.translation || DEFAULT_TRANSLATION;
  const whole = req.query.whole === '1' || req.query.whole === 'true';
  const results = await search(translation, q, { limit: Number(req.query.limit) || 20, whole });
  res.json({ query: q, translation, results });
}));

router.get('/suggest', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const translation = req.query.translation || DEFAULT_TRANSLATION;
  const data = await suggestVerse(q, { translation });
  res.json(data);
}));

router.get('/random', asyncHandler(async (req, res) => {
  const translation = req.query.translation || DEFAULT_TRANSLATION;
  const data = await randomVerse(translation);
  res.json({ ...data, ref: formatReference(data) });
}));

export default router;
