/**
 * Verificação de interface com Chrome headless (Playwright).
 * Uso: node scripts/ui-check.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.PULPITO_URL || 'http://127.0.0.1:4000';
const OUT = 'screenshots';

const errors = [];

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-crash-reporter', '--disable-breakpad', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.library', { timeout: 20000 });
  await page.screenshot({ path: `${OUT}/01-library.png` });

  // novo sermão
  await page.getByRole('button', { name: 'Novo sermão', exact: true }).click();
  await page.fill('#new-title', 'Sermão de teste — a graça');
  await page.fill('#new-theme', 'graça, recomeço');
  await page.getByRole('button', { name: 'Começar' }).click();
  await page.waitForSelector('.editor-input', { timeout: 20000 });
  await page.waitForTimeout(700);

  // digita citação para autocompletar
  const intro = page.locator('.editor-input').first();
  await intro.click();
  await page.keyboard.type('"Porque Deus amou o mundo', { delay: 18 });
  await page.waitForSelector('.suggest', { timeout: 25000 });
  await page.screenshot({ path: `${OUT}/02-sugestao.png` });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/03-citacao-inserida.png` });

  const introText = await intro.innerText();
  if (!introText.includes('João 3:16')) errors.push('autocompletar não inseriu a referência');
  if (!introText.toLowerCase().includes('de tal maneira')) errors.push('autocompletar não completou o texto');

  // tooltip
  const ref = page.locator('.verse-ref').first();
  if (await ref.count()) {
    await ref.hover();
    await page.waitForSelector('.verse-tooltip .tooltip-text', { timeout: 20000 });
    await page.screenshot({ path: `${OUT}/04-tooltip.png` });
    await page.mouse.move(20, 20);
    await page.waitForTimeout(400);
  } else {
    errors.push('referência não foi decorada com .verse-ref');
  }

  // estudo
  await page.locator('.verse-ref').first().click();
  await page.waitForSelector('.modal', { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/05-estudo.png` });
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.waitForTimeout(400);

  // bíblia / comparação
  await page.getByRole('button', { name: 'Versículo' }).click();
  await page.waitForSelector('.modal', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/06-biblia.png` });
  await page.locator('.verse-row').nth(15).click();
  await page.getByRole('button', { name: 'Inserir versículo' }).click();
  await page.waitForTimeout(700);
  const afterInsert = await intro.innerText();
  if (!afterInsert.includes('vida eterna')) errors.push('inserção de versículo pela Bíblia falhou');

  // tema escuro
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/07-escuro.png` });

  // persistência
  await page.waitForTimeout(1600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.editor-input', { timeout: 20000 });
  await page.waitForTimeout(900);
  const saved = await page.locator('.editor-input').first().innerText();
  if (!saved.includes('vida eterna')) errors.push('conteúdo não persistiu após recarregar');
  if (!saved.includes('João 3:16')) errors.push('referência não persistiu');
  await page.screenshot({ path: `${OUT}/08-recarregado.png` });

  // mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.library', { timeout: 15000 });
  await page.screenshot({ path: `${OUT}/09-mobile.png` });

  // limpa o sermão de teste
  const list = await page.evaluate(async () => {
    const res = await fetch('/api/sermons');
    return res.json();
  });
  const test = list.sermons.find((sermon) => sermon.title.startsWith('Sermão de teste'));
  if (test) {
    await page.evaluate(async (id) => {
      await fetch(`/api/sermons/${id}`, { method: 'DELETE' });
    }, test.id);
  }

  await browser.close();
  console.log(errors.length ? `PROBLEMAS:\n- ${errors.join('\n- ')}` : 'UI OK — nenhum erro de console ou de fluxo.');
}

main().catch(async (err) => {
  console.error('FALHA:', err);
  console.log(errors.join('\n'));
  process.exit(1);
});
