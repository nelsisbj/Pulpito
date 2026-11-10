import express from 'express';
import fs from 'node:fs/promises';
import { TOPICS } from '../../../shared/topics.js';
import { formatReference, parseReference } from '../../../shared/references.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { CROSSREFS_FILE } from '../config.js';
import { getVerse, lookupStrong, searchStrong } from '../providers/bolls.js';
import { crossReferences } from '../providers/crossrefs.js';
import { getStudyNotes, getTranslationNotes } from '../providers/commentary.js';
import { allNotes, getNote, putNote } from '../db.js';
import { SEED_DIR } from '../config.js';

const router = express.Router();

function refFromQuery(query) {
  const ref = parseReference(String(query.ref || ''));
  if (!ref) throw new HttpError('Referência inválida.', 400, 'invalid_reference');
  return ref;
}

router.get('/tags', (_req, res) => {
  res.json({ tags: TOPICS.map((t) => ({ id: t.id, label: t.label })) });
});

router.get('/strongs/popular', asyncHandler(async (_req, res) => {
  const data = JSON.parse(await fs.readFile(`${SEED_DIR}/strongs-popular.json`, 'utf8'));
  res.json({ strongs: data });
}));

router.get('/strongs/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw new HttpError('Digite ao menos 2 caracteres.', 400, 'query_too_short');
  const results = await searchStrong(q);
  res.json({ query: q, results });
}));

router.get('/strongs/:id', asyncHandler(async (req, res) => {
  const data = await lookupStrong(req.params.id);
  res.json(data);
}));

router.get('/crossrefs', asyncHandler(async (req, res) => {
  const ref = refFromQuery(req.query);
  const refs = await crossReferences(ref);
  res.json({ ref: formatReference(ref), crossrefs: refs });
}));

router.get('/commentary', asyncHandler(async (req, res) => {
  const ref = refFromQuery(req.query);
  const translation = String(req.query.translation || 'NAA');
  const [notes, studyNotes, userNote] = await Promise.all([
    getTranslationNotes(ref, translation).catch(() => []),
    getStudyNotes(ref).catch(() => []),
    Promise.resolve(getNote(formatReference(ref))),
  ]);
  res.json({ ref: formatReference(ref), translation, notes, studyNotes, userNote });
}));

router.get('/reference', asyncHandler(async (req, res) => {
  const ref = refFromQuery(req.query);
  const translation = String(req.query.translation || 'ARA');
  const canonical = formatReference(ref);
  const [verse, crossrefs, notes, studyNotes] = await Promise.all([
    getVerse(ref, translation).catch(() => null),
    crossReferences(ref).catch(() => []),
    getTranslationNotes(ref, 'NAA').catch(() => []),
    getStudyNotes(ref).catch(() => []),
  ]);
  res.json({
    ref: canonical,
    verse,
    crossrefs,
    notes,
    studyNotes,
    userNote: getNote(canonical),
  });
}));

router.get('/notes', (_req, res) => {
  res.json({ notes: allNotes() });
});

router.get('/notes/:ref', (req, res) => {
  res.json(getNote(req.params.ref));
});

router.put('/notes', asyncHandler(async (req, res) => {
  const ref = String(req.body.ref || '').trim();
  if (!ref) throw new HttpError('Informe a referência da nota.', 400, 'missing_reference');
  const note = await putNote(ref, req.body.text || '');
  res.json(note);
}));

router.get('/crossrefs/meta', asyncHandler(async (_req, res) => {
  const data = JSON.parse(await fs.readFile(CROSSREFS_FILE, 'utf8'));
  res.json({ meta: data.meta || {} });
}));

export default router;
