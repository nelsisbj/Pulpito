import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDF_DIR } from '../config.js';
import { ensureDir } from '../lib/fsx.js';
import { escapeHtml, sanitizeHtml, stripHtml } from '../lib/html.js';
import { findReferences } from '../../../shared/references.js';
import { sermonMetrics } from './timing.js';
import { db, getSermon, update } from '../db.js';

export class PdfError extends Error {
  constructor(message, code = 'pdf_error') {
    super(message);
    this.name = 'PdfError';
    this.status = 503;
    this.code = code;
  }
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PULPITO_CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function findChrome() {
  return CHROME_CANDIDATES.find((candidate) => candidate && fsSync.existsSync(candidate)) || null;
}

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) return browserPromise;
  browserPromise = (async () => {
    let chromium;
    try {
      ({ chromium } = await import('playwright-core'));
    } catch {
      throw new PdfError(
        'O gerador de PDF não está instalado. Rode "npm install" ou use a opção Imprimir.',
        'pdf_unavailable',
      );
    }
    const executablePath = findChrome();
    if (!executablePath) {
      throw new PdfError(
        'Chrome ou Edge não encontrado. Instale um deles ou use a opção Imprimir / Salvar como PDF.',
        'browser_missing',
      );
    }
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--disable-gpu', '--disable-crash-reporter', '--disable-breakpad'],
    });
    browser.on('disconnected', () => {
      browserPromise = null;
    });
    return browser;
  })().catch((err) => {
    browserPromise = null;
    if (err instanceof PdfError) throw err;
    throw new PdfError(
      'Não foi possível iniciar o Chrome para gerar o PDF. Use a opção Imprimir / Salvar como PDF.',
      'browser_failed',
    );
  });
  return browserPromise;
}

function slugify(text) {
  return (
    String(text || 'sermao')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 70) || 'sermao'
  );
}

function hasContent(html) {
  return stripHtml(html).length > 0;
}

function collectReferences(sections) {
  const texts = [
    sections.introduction?.html,
    ...(sections.developments || []).flatMap((dev) => [dev.title, dev.html]),
    sections.conclusion?.html,
  ]
    .filter(Boolean)
    .map((html) => stripHtml(html));
  const found = new Map();
  for (const text of texts) {
    for (const match of findReferences(text)) {
      if (!found.has(match.ref.canonical)) found.set(match.ref.canonical, match.ref);
    }
  }
  return [...found.keys()].slice(0, 30);
}

function footerTemplate() {
  return `<div style="width:100%;padding:0 16mm;font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#8a8071;display:flex;justify-content:space-between;">
    <span>Púlpito · cópia de segurança</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

export function renderPrintHtml(sermon, profile, { autoPrint = false, shareToken = null } = {}) {
  const sections = sermon.sections || {};
  const metrics = sermonMetrics(sermon, profile?.wpm || 150);
  const createdAt = sermon.createdAt ? new Date(sermon.createdAt) : new Date();
  const updatedAt = sermon.updatedAt ? new Date(sermon.updatedAt) : new Date();
  const dateLabel = updatedAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = Number(metrics.minutes) < 1
    ? `${Math.max(1, Math.round(metrics.minutes * 60))} s`
    : `${Math.round(metrics.minutes * 10) / 10} min`;
  const title = escapeHtml(sermon.title || 'Sermão sem título');
  const theme = escapeHtml(sermon.theme || '');
  const tags = (sermon.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const references = collectReferences(sections);

  const intro = sanitizeHtml(sections.introduction?.html || '');
  const conclusion = sanitizeHtml(sections.conclusion?.html || '');
  const developments = (sections.developments || []).map((dev) => ({
    title: escapeHtml(dev.title || 'Ponto'),
    html: sanitizeHtml(dev.html || ''),
  }));

  const body = [];
  if (hasContent(intro)) {
    body.push(`
      <section class="section">
        <div class="section-title">Introdução</div>
        <div class="content">${intro}</div>
      </section>`);
  }

  const devsToPrint = developments.filter((dev) => hasContent(dev.html) || dev.title);
  if (devsToPrint.length) {
    body.push(`<section class="section"><div class="section-title">Desenvolvimento</div>`);
    devsToPrint.forEach((dev, index) => {
      body.push(`
        <article class="dev">
          <h2><span class="dev-number">${index + 1}</span>${dev.title}</h2>
          <div class="content">${dev.html || '<p class="muted">—</p>'}</div>
        </article>`);
    });
    body.push('</section>');
  }

  if (hasContent(conclusion)) {
    body.push(`
      <section class="section">
        <div class="section-title">Conclusão</div>
        <div class="content">${conclusion}</div>
      </section>`);
  }

  const refs = references.length
    ? `<section class="refs">
        <div class="section-title">Referências citadas</div>
        <p>${references.map((ref) => escapeHtml(ref)).join(' · ')}</p>
      </section>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Púlpito</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #f3ede2;
    color: #211d17;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.62;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 18px auto;
    padding: 24mm 22mm 22mm;
    background: #fffdf8;
    box-shadow: 0 20px 60px rgba(40, 30, 18, .18);
  }
  .masthead {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #d8cfbf;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #7c7162;
  }
  .masthead strong { color: #2f5d50; letter-spacing: .18em; }
  h1 {
    margin: 20px 0 6px;
    font-size: 27pt;
    line-height: 1.1;
    font-weight: 600;
    letter-spacing: -.02em;
  }
  .theme {
    margin: 0 0 12px;
    font-size: 13pt;
    font-style: italic;
    color: #5b5145;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid #e2d9c9;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #7c7162;
  }
  .meta b { color: #484035; font-weight: 600; }
  .tags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px; }
  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: #e7f0eb;
    color: #2f5d50;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    font-weight: 600;
  }
  .section { margin-top: 24px; }
  .section-title {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.8pt;
    font-weight: 700;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: #2f5d50;
    border-bottom: 1px solid #e2d9c9;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
  .dev { margin: 0 0 18px; break-inside: avoid-page; }
  .dev h2 {
    font-size: 14pt;
    line-height: 1.25;
    margin: 0 0 8px;
    font-weight: 600;
    letter-spacing: -.01em;
  }
  .dev-number {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin-right: 7px;
    border-radius: 5px;
    background: #2f5d50;
    color: #fffdf8;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    vertical-align: 2px;
  }
  .content p { margin: 0 0 .68em; text-align: justify; }
  .content div { margin: 0 0 .68em; }
  .content h2 { font-size: 14pt; margin: 1em 0 .4em; break-after: avoid; }
  .content h3 {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #484035;
    margin: 1em 0 .4em;
    break-after: avoid;
  }
  .content blockquote {
    margin: .9em 0;
    padding: 2px 0 2px 14px;
    border-left: 2px solid #b08542;
    color: #4a4237;
    font-style: italic;
    break-inside: avoid;
  }
  .content ul, .content ol { margin: .4em 0 .9em 1.3em; padding: 0; }
  .content li { margin: .15em 0; }
  .content b, .content strong { color: #211d17; }
  .refs {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #e2d9c9;
  }
  .refs p {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    line-height: 1.6;
    color: #6f6558;
  }
  .muted { color: #8a8071; }
  .endnote {
    margin-top: 26px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt;
    color: #a1968a;
    text-align: center;
  }
  .share-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 22px;
    background: rgba(47, 93, 80, .96);
    color: #f6f1e6;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    letter-spacing: .04em;
    box-shadow: 0 8px 24px rgba(20, 30, 24, .25);
  }
  .share-bar strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 15px;
    letter-spacing: 0;
    margin-right: 8px;
  }
  .share-bar .actions { display: flex; gap: 8px; }
  .share-bar a, .share-bar button {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, .28);
    background: rgba(255, 255, 255, .08);
    color: #f6f1e6;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .share-bar a:hover, .share-bar button:hover {
    background: rgba(255, 255, 255, .18);
  }
  @media screen and (max-width: 860px) {
    body { background: #fffdf8; }
    .sheet {
      width: auto;
      min-height: 0;
      margin: 0;
      padding: 26px 20px 40px;
      box-shadow: none;
    }
    .share-bar { padding: 9px 12px; }
    .share-bar .brand-text { display: none; }
    h1 { font-size: 25pt; }
  }
  @media print {
    body { background: #fff; }
    .sheet {
      width: auto;
      min-height: 0;
      margin: 0;
      padding: 0;
      box-shadow: none;
      background: #fff;
    }
    .share-bar { display: none !important; }
    .dev { break-inside: avoid; }
  }
</style>
</head>
<body>
  ${shareToken ? `<div class="share-bar">
    <div><strong>Púlpito</strong><span class="brand-text">sermão compartilhado</span></div>
    <div class="actions">
      <a href="/api/share/${encodeURIComponent(shareToken)}/pdf">Baixar PDF</a>
      <button type="button" onclick="window.print()">Imprimir</button>
    </div>
  </div>` : ''}
  <div class="sheet">
    <div class="masthead">
      <span><strong>Púlpito</strong> · estúdio de sermões</span>
      <span>${escapeHtml(dateLabel)}</span>
    </div>
    <h1>${title}</h1>
    ${theme ? `<p class="theme">${theme}</p>` : ''}
    <div class="meta">
      <span><b>${timeLabel}</b> de pregação</span>
      <span><b>${metrics.words}</b> palavras</span>
      <span>Atualizado em <b>${escapeHtml(updatedAt.toLocaleDateString('pt-BR'))}</b></span>
      <span>Criado em <b>${escapeHtml(createdAt.toLocaleDateString('pt-BR'))}</b></span>
    </div>
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${body.join('') || '<p class="muted" style="margin-top:24px">Este sermão ainda não tem conteúdo.</p>'}
    ${refs}
    <div class="endnote">${shareToken ? 'Sermão compartilhado pelo Púlpito' : 'Cópia de segurança gerada pelo Púlpito'} · ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
  </div>
  ${autoPrint ? '<script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));</script>' : ''}
</body>
</html>`;
}

async function generatePdf(sermon, profile) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.emulateMedia({ media: 'print' });
    await page.setContent(renderPrintHtml(sermon, profile), { waitUntil: 'load' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate(),
      margin: { top: '15mm', bottom: '17mm', left: '16mm', right: '16mm' },
    });
    if (!buffer || buffer.length < 1000) {
      throw new PdfError('O PDF saiu vazio. Tente novamente.', 'pdf_empty');
    }
    return buffer;
  } catch (err) {
    if (err instanceof PdfError) throw err;
    throw new PdfError(`Falha ao gerar o PDF: ${err.message}`, 'pdf_failed');
  } finally {
    await page.close().catch(() => {});
  }
}

let queue = Promise.resolve();

function enqueue(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

async function savePdf(id, buffer) {
  await ensureDir(PDF_DIR);
  const file = path.join(PDF_DIR, `${id}.pdf`);
  await fs.writeFile(file, buffer);
  const info = { generatedAt: new Date().toISOString(), bytes: buffer.length };
  await update((state) => {
    const target = state.sermons.find((sermon) => sermon.id === id);
    if (target) target.pdf = info;
  });
  return info;
}

export async function generateAndStore(id, { force = false } = {}) {
  return enqueue(async () => {
    const sermon = getSermon(id);
    if (!sermon) return null;

    const interval = Number(process.env.PULPITO_PDF_INTERVAL_MS) || 3 * 60 * 1000;
    const last = Date.parse(sermon.pdf?.generatedAt || '') || 0;
    if (!force && Date.now() - last < interval) {
      return { info: sermon.pdf || null, buffer: null };
    }

    const buffer = await generatePdf(sermon, db().profile);
    const info = await savePdf(id, buffer);
    return { buffer, info };
  });
}

export async function readStoredPdf(id) {
  try {
    return await fs.readFile(path.join(PDF_DIR, `${id}.pdf`));
  } catch {
    return null;
  }
}

export async function removePdf(id) {
  await fs.rm(path.join(PDF_DIR, `${id}.pdf`), { force: true });
}

export async function closePdfBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    /* já fechado */
  }
  browserPromise = null;
}

const timers = new Map();

/** Agenda uma cópia automática depois que o pregador para de escrever. */
export function scheduleSafetyPdf(id) {
  if (process.env.PULPITO_AUTO_PDF === '0') return;
  clearTimeout(timers.get(id));
  const delay = Number(process.env.PULPITO_PDF_DELAY_MS) || 12_000;
  const timer = setTimeout(() => {
    timers.delete(id);
    generateAndStore(id).catch((err) => {
      console.warn(`[pdf] cópia automática de ${id} falhou: ${err.message}`);
    });
  }, delay);
  timer.unref?.();
  timers.set(id, timer);
}

export function pdfFilename(sermon) {
  return `${slugify(sermon?.title)}.pdf`;
}

export function backupFilename(sermon) {
  return `${slugify(sermon?.title)}-backup.json`;
}

export function printUrl(id, auto = true) {
  return `/api/sermons/${id}/print${auto ? '?auto=1' : ''}`;
}
