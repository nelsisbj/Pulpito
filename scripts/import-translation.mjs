/**
 * Importa uma tradução bíblica licenciada para uso local.
 *
 * Uso:
 *   node scripts/import-translation.mjs caminho/para/nvi.json
 *
 * Formato:
 * {
 *   "id": "NVI",
 *   "name": "Nova Versão Internacional",
 *   "language": "Português",
 *   "license": "Licença do detentor dos direitos",
 *   "verses": { "43:3:16": "Porque Deus amou o mundo..." }
 * }
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../server/src/config.js';
import { readJson, writeJsonAtomic, ensureDir } from '../server/src/lib/fsx.js';
import { BOOK_BY_ID } from '../shared/books.js';

const source = process.argv[2];
if (!source) {
  console.error('Uso: node scripts/import-translation.mjs <arquivo.json>');
  process.exit(1);
}

const data = await readJson(path.resolve(source), null);
if (!data || typeof data !== 'object') {
  console.error('Arquivo inválido: não foi possível ler o JSON.');
  process.exit(1);
}

const id = String(data.id || '').trim().toUpperCase();
if (!/^[A-Z0-9_-]{2,24}$/.test(id)) {
  console.error('Informe um "id" de 2 a 24 caracteres (A-Z, 0-9, _ ou -).');
  process.exit(1);
}
if (!data.verses || typeof data.verses !== 'object') {
  console.error('O arquivo precisa ter um objeto "verses" com chaves "livro:capítulo:versículo".');
  process.exit(1);
}

const verses = {};
for (const [key, value] of Object.entries(data.verses)) {
  const match = /^(\d{1,2}):(\d{1,3}):(\d{1,3})$/.exec(String(key).trim());
  if (!match || typeof value !== 'string' || !value.trim()) continue;
  const bookId = Number(match[1]);
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const book = BOOK_BY_ID.get(bookId);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) continue;
  verses[`${bookId}:${chapter}:${verse}`] = value.trim();
}

if (!Object.keys(verses).length) {
  console.error('Nenhum versículo válido encontrado. Use chaves como "43:3:16".');
  process.exit(1);
}

const output = {
  id,
  name: String(data.name || id),
  language: String(data.language || 'Português'),
  license: String(data.license || ''),
  importedAt: new Date().toISOString(),
  verses,
};

const dir = path.join(DATA_DIR, 'translations');
await ensureDir(dir);
await writeJsonAtomic(path.join(dir, `${id}.json`), output);

console.log(`✓ ${output.name} (${id}) importada: ${Object.keys(verses).length} versículos.`);
console.log(`  Arquivo: ${path.join(dir, `${id}.json`)}`);
console.log('  A versão aparece na lista automaticamente em alguns segundos; se não aparecer, reinicie o servidor.');
