/**
 * Desenvolvimento: API (porta 4000) + Vite (porta 5173) no mesmo terminal.
 * Uso: npm run dev
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [];

function run(args, name, color) {
  const child = spawn(node, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[${name}] saiu com código ${code}`);
    shutdown(code || 0);
  });
  children.push(child);
  return child;
}

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('\n  Púlpito · desenvolvimento');
console.log('  API  → http://127.0.0.1:4000');
console.log('  App  → http://127.0.0.1:5173\n');

run(['server/src/index.js'], 'api');
setTimeout(() => run([vite], 'web'), 350);
