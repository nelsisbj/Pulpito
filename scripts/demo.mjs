/**
 * Sobe a instância de DEMONSTRAÇÃO em uma porta separada, com dados próprios.
 * Uso: npm run demo
 *
 * Variáveis:
 *   PULPITO_DEMO_PASSWORD  senha compartilhada (se vazia, gera uma aleatória)
 *   PULPITO_DEMO_PORT      porta (padrão 4100)
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data-demo');
const port = String(process.env.PULPITO_DEMO_PORT || 4100);
const password = process.env.PULPITO_DEMO_PASSWORD || crypto.randomBytes(4).toString('hex');
const demo = process.env.PULPITO_DEMO !== '0';

const env = {
  ...process.env,
  PORT: port,
  HOST: '0.0.0.0',
  PULPITO_DATA_DIR: dataDir,
  PULPITO_ALLOW_REMOTE_EDIT: '1',
  PULPITO_AUTO_PDF: '0',
  PULPITO_ACCESS_PASSWORD: password,
  PULPITO_DEMO: demo ? '1' : '0',
};

if (!fs.existsSync(path.join(dataDir, 'pulpito.json'))) {
  console.log('• criando dados de demonstração…');
  const seed = spawnSync(process.execPath, ['scripts/seed-demo-local.mjs'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (seed.status !== 0) process.exit(seed.status || 1);
}

console.log('\n  Púlpito · DEMONSTRAÇÃO');
console.log(`  URL local: http://127.0.0.1:${port}`);
console.log(`  Senha:     ${password}`);
console.log('  Dados:     data-demo/ (separados dos seus sermões reais)');
console.log('  Encerre com Ctrl+C.\n');

const child = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env,
  stdio: 'inherit',
});

const shutdown = () => {
  try {
    child.kill();
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(0), 200);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('exit', (code) => process.exit(code || 0));
