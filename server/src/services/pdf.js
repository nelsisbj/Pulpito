import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { AUTO_PDF_ENABLED, PDF_DELAY_MS, PDF_INTERVAL_MS, PDF_DIR } from '../config.js';
import { pool } from '../db.js';
import { findReferences } from '../../../shared/references.js';
import { escapeHtml, sanitizeHtml, stripHtml } from '../lib/html.js';
import { sermonMetrics } from './timing.js';

let browserInstance = null;
const pendingPdfTimers = new Map();
const lastPdfGenerated = new Map();

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

export async function closePdfBrowser() {
  for (const timer of pendingPdfTimers.values()) clearTimeout(timer);
  pendingPdfTimers.clear();
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export function schedulePdfBackup(sermon, userId) {
  if (!AUTO_PDF_ENABLED || !sermon?.id) return;
  const id = String(sermon.id);
  const pending = pendingPdfTimers.get(id);
  if (pending) clearTimeout(pending);
  const elapsed = Date.now() - (lastPdfGenerated.get(id) || 0);
  const delay = Math.max(PDF_DELAY_MS, PDF_INTERVAL_MS - elapsed);
  const timer = setTimeout(async () => {
    pendingPdfTimers.delete(id);
    try {
      await renderSermonPdf(id, renderPrintHtml(sermon), userId);
      lastPdfGenerated.set(id, Date.now());
    } catch (err) {
      console.error('[automatic pdf error]', err);
    }
  }, delay);
  timer.unref?.();
  pendingPdfTimers.set(id, timer);
}

// Busca o sermão no PostgreSQL
export async function getSermonById(id, userId = null) {
  const query = userId
    ? 'SELECT * FROM sermons WHERE id = $1 AND user_id = $2'
    : 'SELECT * FROM sermons WHERE id = $1';
  const params = userId ? [id, userId] : [id];
  const res = await pool.query(query, params);
  return res.rows[0] || null;
}

// Atualiza metadados do PDF no sermão (se necessário)
export async function updateSermonPdfPath(id, pdfPath, metadata = {}) {
  await pool.query(
    `UPDATE sermons
     SET content = jsonb_set(
       jsonb_set(COALESCE(content, '{}'::jsonb), '{pdfPath}', to_jsonb($1::text), true),
       '{pdf}', $2::jsonb, true
     ),
         updated_at = NOW()
     WHERE id = $3`,
    [pdfPath, JSON.stringify({ ...metadata, generatedAt: new Date().toISOString() }), id]
  );
}

export function renderPrintHtml(sermon, { wpm = 150, autoPrint = false } = {}) {
  const sections = sermon?.sections || {};
  const developments = Array.isArray(sections.developments) ? sections.developments : [];
  const heading = (label, html) => html
    ? `<section><h2>${escapeHtml(label)}</h2><div class="section-content">${sanitizeHtml(html)}</div></section>`
    : '';
  const body = [
    heading('Introdução', sections.introduction?.html),
    ...developments.map((item, index) => heading(item.title || `Ponto ${index + 1}`, item.html)),
    heading('Conclusão', sections.conclusion?.html),
  ].join('');
  const plainText = stripHtml([
    sections.introduction?.html,
    ...developments.flatMap((item) => [item.title, item.html]),
    sections.conclusion?.html,
  ].join(' '));
  const references = [...new Set(findReferences(plainText, { requireVerse: true }).map((item) => item.ref.canonical))];
  const metrics = sermonMetrics(sermon, wpm);
  const tags = Array.isArray(sermon?.tags) ? sermon.tags : [];
  const tagLine = tags.length ? `<p class="tags">${tags.map(escapeHtml).join(' · ')}</p>` : '';
  const referenceList = references.length
    ? `<section class="references"><h2>Referências citadas</h2><p>${references.map(escapeHtml).join(' · ')}</p></section>`
    : '';
  const printScript = autoPrint ? '<script>window.addEventListener("load", () => window.print());</script>' : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(sermon?.title || 'Sermão')} · Púlpito</title><style>
    *{box-sizing:border-box}body{max-width:760px;margin:40px auto;padding:0 28px;color:#211d17;font:18px/1.75 Georgia,serif}h1{font-size:32px;line-height:1.2;margin:0 0 8px}h2{font:700 13px/1.3 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #d8d1c5;padding-bottom:7px;margin:30px 0 12px}.meta,.tags,.references{font:13px/1.6 Arial,sans-serif;color:#655d52}.meta{margin:0}.section-content p{margin:0 0 12px}.section-content blockquote{border-left:3px solid #ad7941;padding-left:14px;color:#51483d}.references{border-top:1px solid #d8d1c5;padding-top:4px;margin-top:30px}.references p{margin:0}.shared-note{font:12px Arial,sans-serif;color:#756b5e;margin-top:36px}@media print{body{margin:0 auto;padding:0;max-width:none}section{break-inside:avoid}}
    </style></head><body><h1>${escapeHtml(sermon?.title || 'Sem título')}</h1>${sermon?.theme ? `<p class="meta">${escapeHtml(sermon.theme)}</p>` : ''}<p class="meta">${metrics.words} palavras · cerca de ${metrics.minutes} min</p>${tagLine}${body}${referenceList}${printScript}</body></html>`;
}

export async function renderSermonPdf(sermonId, htmlContent, userId = null) {
  const sermon = await getSermonById(sermonId, userId);
  if (!sermon) throw new Error('Sermão não encontrado');

  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }

  const pdfFileName = `sermon-${sermonId}.pdf`;
  const pdfPath = path.join(PDF_DIR, pdfFileName);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
    });

    await updateSermonPdfPath(sermonId, pdfFileName, { bytes: fs.statSync(pdfPath).size });
    lastPdfGenerated.set(String(sermonId), Date.now());
    return pdfPath;
  } finally {
    await page.close();
  }
}