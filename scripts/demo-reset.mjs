/**
 * Apaga os dados da demonstração. Pare o demo antes de rodar.
 * Uso: npm run demo:reset
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data-demo');

await fs.rm(path.join(dataDir, 'pulpito.json'), { force: true });
await fs.rm(path.join(dataDir, 'pdfs'), { recursive: true, force: true });
console.log('Dados da demonstração apagados. Na próxima vez, npm run demo recria os exemplos.');
