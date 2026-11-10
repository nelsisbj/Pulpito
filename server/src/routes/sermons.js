import express from 'express';
import crypto from 'node:crypto';
import { asyncHandler, HttpError } from '../lib/http.js';
import {
  allSermons,
  createSermon,
  deleteSermon,
  getSermon,
  getStats,
  patchSermon,
  publicSermon,
  db,
  update,
} from '../db.js';
import { detectTags, sermonText } from '../services/tags.js';
import { MINISTRY_READING } from '../data/reading-sample.js';
import {
  backupFilename,
  generateAndStore,
  pdfFilename,
  readStoredPdf,
  removePdf,
  renderPrintHtml,
  scheduleSafetyPdf,
} from '../services/pdf.js';

const router = express.Router();

router.get('/stats', (_req, res) => {
  res.json(getStats());
});

router.get('/', (_req, res) => {
  res.json({ sermons: allSermons().map((s) => publicSermon(s, db().profile)) });
});

router.post('/', asyncHandler(async (req, res) => {
  const sermon = await createSermon(req.body || {});
  res.status(201).json(publicSermon(sermon, db().profile));
}));

router.post('/analyze', (req, res) => {
  const text = String(req.body?.text || '');
  const tags = detectTags(text, {
    title: String(req.body?.title || ''),
    theme: String(req.body?.theme || ''),
    limit: 8,
  });
  res.json({ tags });
});

router.get('/:id', (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  res.json(publicSermon(sermon, db().profile));
});

router.put('/:id', asyncHandler(async (req, res) => {
  const sermon = await patchSermon(req.params.id, req.body || {});
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  scheduleSafetyPdf(sermon.id);
  res.json(publicSermon(sermon, db().profile));
}));

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');

  let buffer = null;
  try {
    const generated = await generateAndStore(sermon.id, { force: true });
    buffer = generated?.buffer || null;
  } catch (err) {
    // se já existe uma cópia anterior, entrega pelo menos ela
    buffer = await readStoredPdf(sermon.id);
    if (!buffer) throw err;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename(sermon)}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

router.get('/:id/print', asyncHandler(async (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  res.type('html').send(
    renderPrintHtml(sermon, db().profile, { autoPrint: req.query.auto === '1' }),
  );
}));

router.get('/:id/backup', asyncHandler(async (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  const payload = {
    app: 'Púlpito',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    sermon: publicSermon(sermon, db().profile),
  };
  res.setHeader('Content-Disposition', `attachment; filename="${backupFilename(sermon)}"`);
  res.json(payload);
}));

router.get('/:id/share', (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  res.json({ share: sermon.share || null });
});

router.post('/:id/share', asyncHandler(async (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  if (sermon.share?.token) {
    return res.json({ share: sermon.share });
  }
  const share = {
    token: crypto.randomBytes(18).toString('base64url'),
    createdAt: new Date().toISOString(),
  };
  await update((state) => {
    const target = state.sermons.find((item) => item.id === sermon.id);
    if (target) target.share = share;
  });
  res.status(201).json({ share });
}));

router.delete('/:id/share', asyncHandler(async (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  await update((state) => {
    const target = state.sermons.find((item) => item.id === sermon.id);
    if (target) delete target.share;
  });
  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const removed = await deleteSermon(req.params.id);
  if (!removed) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  await removePdf(req.params.id);
  res.json({ ok: true });
}));

router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const original = getSermon(req.params.id);
  if (!original) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  const copy = await createSermon({
    ...original,
    title: `${original.title} (cópia)`,
    sections: original.sections,
  });
  res.status(201).json(publicSermon(copy, db().profile));
}));

router.get('/:id/read-aloud', (req, res) => {
  const sermon = getSermon(req.params.id);
  if (!sermon) throw new HttpError('Sermão não encontrado.', 404, 'not_found');
  res.json({ text: sermonText(sermon), sample: MINISTRY_READING });
});

export default router;
