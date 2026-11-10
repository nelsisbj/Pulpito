import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:4000';
const OUT = 'screenshots';
const errors = [];

async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    errors.push(`${name}: ${String(err.message).split('\n')[0]}`);
    console.log(`✗ ${name}`);
    try { await page.screenshot({ path: `${OUT}/falha-${name.replace(/[^a-z0-9]+/gi, '-')}.png` }); } catch {}
  }
}

const created = await fetch(`${BASE}/api/sermons`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Teste de recursos',
    theme: 'graça e salvação',
    sections: {
      introduction: { html: '<p>A graça transforma o coração. Leia João 3:16 com atenção.</p>' },
      developments: [{ title: 'Primeiro ponto', html: '<p>Conteúdo do primeiro ponto.</p>' }],
      conclusion: { html: '' },
    },
  }),
}).then((r) => r.json());

const originalProfile = (await fetch(`${BASE}/api/profile`).then((r) => r.json())).profile;
const notesBefore = new Set(
  (await fetch(`${BASE}/api/study/notes`).then((r) => r.json())).notes.map((note) => note.ref),
);

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-crash-reporter', '--disable-breakpad'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
const page = await context.newPage();
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(`console: ${msg.text()}`);
});

await page.goto(`${BASE}/#/sermao/${created.id}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.editor-input');
const intro = page.locator('.editor-input').first();
await page.waitForTimeout(600);

await step('formatação: negrito, grifo e cor', async () => {
  await intro.click({ position: { x: 6, y: 6 } });
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Palavra final.');
  await page.keyboard.press('Control+A');
  await page.getByTitle('Negrito (Ctrl+B)').click();
  await page.keyboard.press('Control+A');
  await page.getByTitle('Grifar').click();
  await page.locator('.palette .swatch').first().click();
  await page.keyboard.press('Control+A');
  await page.getByTitle('Cor do texto').click();
  await page.locator('.palette .swatch').nth(3).click();
  const html = await intro.evaluate((el) => el.innerHTML);
  if (!/font-weight|font-weight: bold|<b>|<strong>/.test(html)) throw new Error('negrito não aplicado');
  if (!/background-color/.test(html)) throw new Error('grifo não aplicado');
  if (!/color:/.test(html)) throw new Error('cor não aplicada');
  await page.screenshot({ path: `${OUT}/10-formatacao.png` });
});

await step('estilo de parágrafo (citação)', async () => {
  await intro.click({ position: { x: 6, y: 6 } });
  await page.keyboard.press('Control+A');
  await page.locator('.tool-select').selectOption('blockquote');
  await page.waitForTimeout(300);
  const count = await intro.locator('blockquote').count();
  if (!count) throw new Error('blockquote não aplicado');
});

await step('adicionar, mover e remover desenvolvimento', async () => {
  const before = await page.locator('.dev-card').count();
  await page.getByRole('button', { name: 'Adicionar desenvolvimento' }).click();
  await page.waitForTimeout(300);
  const after = await page.locator('.dev-card').count();
  if (after !== before + 1) throw new Error(`esperava ${before + 1} pontos, veio ${after}`);
  const last = page.locator('.dev-card').last();
  await last.locator('.dev-title').fill('Ponto B');
  await last.locator('.dev-actions button[title="Mover para cima"]').click();
  const firstTitle = await page.locator('.dev-title').first().inputValue();
  if (firstTitle !== 'Ponto B') throw new Error(`ordem não mudou (${firstTitle})`);
  await page.locator('.dev-card').last().locator('.dev-actions button[title="Remover ponto"]').click();
  await page.waitForTimeout(200);
  const finalCount = await page.locator('.dev-card').count();
  if (finalCount !== before) throw new Error('não removeu o ponto');
});

await step('calibração manual do ritmo', async () => {
  await page.getByRole('button', { name: 'Calibrar' }).first().click();
  await page.waitForSelector('.calibration-grid');
  await page.fill('#manual-wpm', '165');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForSelector('.timer', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/11-calibracao.png` });
  const profile = await fetch(`${BASE}/api/profile`).then((r) => r.json());
  if (profile.profile.wpm !== 165) throw new Error(`wpm ${profile.profile.wpm}`);
  await page.getByRole('button', { name: 'Usar este ritmo' }).click();
});

await step('ajustes: tema escuro e tamanho', async () => {
  await page.locator('.topbar').getByRole('button', { name: 'Ajustes' }).click();
  await page.waitForSelector('.settings-grid');
  await page.getByRole('button', { name: 'Escuro', exact: true }).click();
  const sizeRow = page.locator('.settings-row').filter({ hasText: 'Tamanho do texto' });
  await sizeRow.locator('select').selectOption('21');
  await page.getByRole('button', { name: 'Salvar ajustes' }).click();
  await page.waitForTimeout(800);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const size = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-size'));
  if (theme !== 'dark') throw new Error('tema não mudou');
  if (!size.includes('21')) throw new Error(`tamanho ${size}`);
});

await step('estudo: referências cruzadas, Strong e nota', async () => {
  await page.locator('.verse-ref').first().click();
  await page.waitForSelector('.modal');
  await page.getByRole('button', { name: /Referências/ }).click();
  await page.waitForSelector('.ref-item');
  const subtitleBefore = await page.locator('.modal-head p').innerText();
  await page.locator('.ref-item').first().click();
  await page.waitForTimeout(1500);
  const subtitleAfter = await page.locator('.modal-head p').innerText();
  if (subtitleBefore === subtitleAfter) throw new Error('referência cruzada não navegou');

  await page.getByRole('button', { name: /Strong's/ }).click();
  await page.getByRole('button', { name: /G26/ }).first().click();
  await page.waitForSelector('.strong-card', { timeout: 15000 });
  const lemma = await page.locator('.strong-lemma').innerText();
  if (!lemma) throw new Error('Strong sem lema');
  await page.screenshot({ path: `${OUT}/12-strong.png` });

  await page.getByRole('button', { name: /Comentários/ }).click();
  await page.fill('#study-note', 'Nota automática de teste sobre a passagem.');
  await page.getByRole('button', { name: 'Salvar nota' }).click();
  await page.waitForTimeout(900);
  const notes = await fetch(`${BASE}/api/study/notes`).then((r) => r.json());
  if (!notes.notes.some((note) => note.text.includes('Nota automática'))) throw new Error('nota não salvou');
  await page.getByRole('button', { name: 'Fechar' }).click();
});

await step('comparação de versões', async () => {
  await page.getByRole('button', { name: 'Versículo' }).click();
  await page.waitForSelector('.verse-row', { timeout: 20000 });
  await page.locator('.verse-row').nth(15).click();
  await page.getByRole('button', { name: /Comparar versões/ }).click();
  await page.waitForSelector('.compare-col', { timeout: 25000 });
  const cols = await page.locator('.compare-col').count();
  if (cols < 2) throw new Error(`apenas ${cols} versões`);
  await page.screenshot({ path: `${OUT}/13-comparar.png` });
  await page.getByRole('button', { name: 'Fechar' }).click();
});

await step('música: sugestões e player', async () => {
  await page.getByRole('button', { name: 'Escolher' }).click();
  await page.waitForSelector('.music-card');
  const cards = await page.locator('.music-card').count();
  if (cards < 2) throw new Error('poucas sugestões');
  await page.locator('.music-card').first().click();
  await page.waitForSelector('.music-player', { timeout: 10000 });
  await page.locator('.music-player button[title="Fechar"]').click();
  await page.waitForTimeout(300);
  const playerCount = await page.locator('.music-player').count();
  if (playerCount) throw new Error('player não fechou');
});

await step('modo foco', async () => {
  await page.getByRole('button', { name: 'Modo foco' }).click();
  await page.waitForTimeout(300);
  if (!(await page.locator('.app.is-focus').count())) throw new Error('modo foco não ativou');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.locator('.app.is-focus').count()) throw new Error('Esc não saiu do foco');
});

await step('painel lateral no celular', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.editor-input');
  await page.locator('.rail-toggle').first().click();
  await page.waitForTimeout(300);
  if (!(await page.locator('.rail.is-mobile-open').count())) throw new Error('gaveta não abriu');
  await page.screenshot({ path: `${OUT}/14-mobile-editor.png` });
});

await browser.close();

// limpeza: remove apenas o que o teste criou e restaura o perfil original
await fetch(`${BASE}/api/sermons/${created.id}`, { method: 'DELETE' });
await fetch(`${BASE}/api/profile`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: originalProfile.name,
    wpm: originalProfile.wpm,
    settings: originalProfile.settings,
  }),
});
const allNotes = await fetch(`${BASE}/api/study/notes`).then((r) => r.json()).catch(() => ({ notes: [] }));
for (const note of allNotes.notes || []) {
  if (notesBefore.has(note.ref)) continue;
  await fetch(`${BASE}/api/study/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: note.ref, text: '' }),
  });
}

console.log(errors.length ? `\nPROBLEMAS:\n- ${errors.join('\n- ')}` : '\nTUDO OK — recursos verificados.');
process.exit(errors.length ? 1 : 0);
