/**
 * Cria o banco da demonstração em data-demo/ com três sermões de exemplo.
 * Uso: node scripts/seed-demo-local.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data-demo');

process.env.PULPITO_DATA_DIR = dataDir;
await fs.rm(dataDir, { recursive: true, force: true });

const { SERMONS } = await import('./seed-demo.mjs');
const { initDb, createSermon, patchProfile } = await import('../server/src/db.js');

await initDb();
for (const sermon of SERMONS) {
  const created = await createSermon(sermon);
  console.log(`✓ ${created.title}`);
}
await patchProfile({
  name: 'Púlpito Demo',
  wpm: 150,
  settings: { theme: 'light', fontFamily: 'serif', fontSize: 19, translation: 'ARA' },
});

console.log(`\nDemo criado em ${dataDir}`);
console.log('Agora rode: npm run demo');
