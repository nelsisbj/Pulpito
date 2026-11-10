import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { PDF_DIR } from '../config.js';
import { pool } from '../db.js';

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

export async function closePdfBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
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
export async function updateSermonPdfPath(id, pdfPath) {
  await pool.query(
    `UPDATE sermons 
     SET content = jsonb_set(COALESCE(content, '{}'::jsonb), '{pdfPath}', $1::jsonb),
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(pdfPath), id]
  );
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

    await updateSermonPdfPath(sermonId, pdfFileName);
    return pdfPath;
  } finally {
    await page.close();
  }
}