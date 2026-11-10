import express from 'express';
import { db, findSermonByShareToken, publicSermon } from '../db.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { generateAndStore, pdfFilename, renderPrintHtml } from '../services/pdf.js';

const router = express.Router();

function resolve(token) {
  const sermon = findSermonByShareToken(token);
  if (!sermon) throw new HttpError('Link inválido ou revogado.', 404, 'share_not_found');
  return sermon;
}

function publicShare(sermon) {
  const full = publicSermon(sermon, db().profile);
  return {
    title: full.title,
    theme: full.theme,
    tags: full.tags,
    sections: full.sections,
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
    metrics: full.metrics,
    sharedAt: sermon.share?.createdAt || null,
  };
}

router.get('/:token', (req, res) => {
  const sermon = resolve(req.params.token);
  res.set('Cache-Control', 'no-store');
  res.json({ sermon: publicShare(sermon) });
});

router.get('/:token/pdf', asyncHandler(async (req, res) => {
  const sermon = resolve(req.params.token);
  const { buffer } = await generateAndStore(sermon.id, { force: true });
  if (!buffer) throw new HttpError('Não foi possível gerar o PDF.', 503, 'pdf_failed');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename(sermon)}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

router.get('/:token/print', (req, res) => {
  const sermon = resolve(req.params.token);
  res.set('Cache-Control', 'no-store');
  res.type('html').send(
    renderPrintHtml(sermon, db().profile, { autoPrint: req.query.auto === '1' }),
  );
});

function notFoundPage() {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Link inválido · Púlpito</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3ede2;color:#211d17;font-family:Georgia,serif}
.box{max-width:420px;padding:36px;text-align:center}
h1{font-size:26px;margin:0 0 8px}
p{font-family:Arial,sans-serif;font-size:14px;color:#6f6558;line-height:1.6}
</style></head>
<body><div class="box"><h1>Este link não está disponível</h1><p>Ele pode ter sido revogado ou o sermão foi removido. Peça um novo link a quem compartilhou.</p></div></body></html>`;
}

/** Página pública, renderizada no servidor, sem o editor. */
export function sharePage(req, res) {
  const sermon = findSermonByShareToken(req.params.token);
  if (!sermon) {
    return res.status(404).type('html').send(notFoundPage());
  }
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.type('html').send(
    renderPrintHtml(sermon, db().profile, { shareToken: sermon.share.token }),
  );
}

export default router;
