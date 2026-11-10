/**
 * Gera os dados locais do Púlpito:
 *  - server/src/data/quotes.json  (versículos conhecidos para autocompletar)
 *  - confere a presença de crossrefs.json
 *
 * Uso: node scripts/setup-data.mjs [--force]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVerse } from '../server/src/providers/bolls.js';
import { parseReference, formatReference } from '../shared/references.js';
import { QUOTES_FILE, CROSSREFS_FILE, CACHE_DIR } from '../server/src/config.js';
import { ensureDir, writeJsonAtomic } from '../server/src/lib/fsx.js';

const REFS = [
  'Gênesis 1:1', 'Gênesis 1:27', 'Gênesis 12:2-3', 'Gênesis 50:20',
  'Êxodo 3:14', 'Êxodo 14:14', 'Êxodo 20:3-6', 'Êxodo 33:14',
  'Levítico 19:18', 'Números 6:24-26', 'Números 23:19',
  'Deuteronômio 6:5', 'Deuteronômio 28:1-2', 'Deuteronômio 31:6', 'Deuteronômio 31:8',
  'Josué 1:8', 'Josué 1:9', 'Josué 24:15',
  '1 Samuel 16:7', '1 Samuel 17:47',
  '2 Samuel 22:31',
  '1 Reis 8:57',
  '2 Crônicas 7:14', '2 Crônicas 16:9',
  'Neemias 8:10',
  'Jó 19:25', 'Jó 42:2',
  'Salmos 1:1-3', 'Salmos 4:8', 'Salmos 16:11', 'Salmos 23:1-4', 'Salmos 27:1',
  'Salmos 34:18', 'Salmos 37:4', 'Salmos 46:1-3', 'Salmos 51:10', 'Salmos 55:22',
  'Salmos 91:1-2', 'Salmos 100:4-5', 'Salmos 103:1-5', 'Salmos 118:24', 'Salmos 119:105',
  'Salmos 121:1-2', 'Salmos 127:1', 'Salmos 133:1', 'Salmos 139:1-3', 'Salmos 139:23-24',
  'Salmos 143:8', 'Salmos 147:3',
  'Provérbios 3:5-6', 'Provérbios 4:23', 'Provérbios 16:3', 'Provérbios 16:9',
  'Provérbios 18:10', 'Provérbios 22:6', 'Provérbios 27:17',
  'Eclesiastes 3:1', 'Eclesiastes 4:9-12', 'Eclesiastes 12:13',
  'Isaías 6:8', 'Isaías 9:6', 'Isaías 26:3', 'Isaías 40:31', 'Isaías 41:10',
  'Isaías 43:2', 'Isaías 53:5', 'Isaías 55:8-9', 'Isaías 61:1-3',
  'Jeremias 1:5', 'Jeremias 17:7-8', 'Jeremias 29:11', 'Jeremias 31:3', 'Jeremias 33:3',
  'Lamentações 3:22-23',
  'Ezequiel 36:26', 'Ezequiel 37:5',
  'Daniel 3:17-18', 'Daniel 12:3',
  'Oséias 6:3', 'Joel 2:28-29', 'Amós 5:24', 'Miquéias 6:8', 'Habacuque 3:17-19',
  'Sofonias 3:17', 'Zacarias 4:6', 'Malaquias 3:10',
  'Mateus 4:4', 'Mateus 5:14-16', 'Mateus 6:33', 'Mateus 7:7-8', 'Mateus 11:28-30',
  'Mateus 16:24', 'Mateus 18:20', 'Mateus 22:37-39', 'Mateus 28:18-20',
  'Marcos 9:23', 'Marcos 10:27', 'Marcos 12:30-31', 'Marcos 16:15',
  'Lucas 2:10-11', 'Lucas 6:38', 'Lucas 9:23', 'Lucas 15:7', 'Lucas 24:45-47',
  'João 1:1', 'João 1:12', 'João 1:14', 'João 3:16-17', 'João 4:23-24', 'João 5:24',
  'João 6:35', 'João 8:12', 'João 8:32', 'João 10:10', 'João 11:25', 'João 13:34-35',
  'João 14:1-3', 'João 14:6', 'João 14:27', 'João 15:5', 'João 15:13', 'João 16:33',
  'Atos 1:8', 'Atos 2:38', 'Atos 4:12', 'Atos 16:31', 'Atos 20:24',
  'Romanos 1:16', 'Romanos 3:23', 'Romanos 5:8', 'Romanos 6:23', 'Romanos 8:1',
  'Romanos 8:28', 'Romanos 8:31-32', 'Romanos 8:38-39', 'Romanos 10:9-10',
  'Romanos 12:1-2', 'Romanos 12:12', 'Romanos 15:13',
  '1 Coríntios 10:13', '1 Coríntios 13:4-7', '1 Coríntios 13:13', '1 Coríntios 15:57',
  '2 Coríntios 4:16-18', '2 Coríntios 5:17', '2 Coríntios 5:21', '2 Coríntios 12:9',
  'Gálatas 2:20', 'Gálatas 5:22-23', 'Gálatas 6:7', 'Gálatas 6:9',
  'Efésios 1:3', 'Efésios 2:8-10', 'Efésios 3:20', 'Efésios 6:10-11',
  'Filipenses 1:6', 'Filipenses 2:3-4', 'Filipenses 3:13-14', 'Filipenses 4:6-7',
  'Filipenses 4:13', 'Filipenses 4:19',
  'Colossenses 3:12-14', 'Colossenses 3:23',
  '1 Tessalonicenses 5:16-18', '2 Tessalonicenses 3:3',
  '1 Timóteo 4:12', '1 Timóteo 6:6', '2 Timóteo 1:7', '2 Timóteo 3:16-17',
  'Tito 2:11-12', 'Hebreus 4:12', 'Hebreus 4:16', 'Hebreus 11:1', 'Hebreus 11:6',
  'Hebreus 12:1-2', 'Hebreus 13:5', 'Hebreus 13:8',
  'Tiago 1:2-4', 'Tiago 1:5', 'Tiago 4:7-8', 'Tiago 5:16',
  '1 Pedro 2:9', '1 Pedro 5:7', '2 Pedro 3:9',
  '1 João 1:9', '1 João 4:4', '1 João 4:8', '1 João 4:18-19',
  'Apocalipse 3:20', 'Apocalipse 21:4', 'Apocalipse 22:13',
];

async function buildQuotes(force) {
  if (!force) {
    try {
      const existing = JSON.parse(await fs.readFile(QUOTES_FILE, 'utf8'));
      if (Array.isArray(existing.quotes) && existing.quotes.length > 50) {
        console.log(`• quotes.json já existe (${existing.quotes.length} versículos). Use --force para regenerar.`);
        return;
      }
    } catch {
      /* segue para gerar */
    }
  }

  const unique = [...new Set(REFS)];
  const parsed = unique
    .map((text) => ({ text, ref: parseReference(text) }))
    .filter((item) => item.ref && item.ref.verseStart);
  console.log(`• Buscando ${parsed.length} versículos na ARA...`);

  const quotes = [];
  let index = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (index < parsed.length) {
      const item = parsed[index++];
      try {
        const verse = await getVerse(item.ref, 'ARA');
        quotes.push({
          ref: formatReference(item.ref),
          bookId: item.ref.bookId,
          chapter: item.ref.chapter,
          verseStart: item.ref.verseStart,
          verseEnd: item.ref.verseEnd,
          text: verse.text,
          translation: 'ARA',
        });
      } catch (err) {
        console.warn(`  ! ${item.text}: ${err.message}`);
      }
    }
  });
  await Promise.all(workers);

  quotes.sort((a, b) => a.bookId - b.bookId || a.chapter - b.chapter || a.verseStart - b.verseStart);
  await writeJsonAtomic(QUOTES_FILE, {
    meta: {
      translation: 'ARA',
      generatedAt: new Date().toISOString(),
      count: quotes.length,
      note: 'Texto bíblico via API pública bolls.life. Use para autocompletar citações.',
    },
    quotes,
  });
  console.log(`✓ quotes.json gerado com ${quotes.length} versículos.`);
}

async function main() {
  await ensureDir(CACHE_DIR);
  await buildQuotes(process.argv.includes('--force'));
  try {
    const cross = JSON.parse(await fs.readFile(CROSSREFS_FILE, 'utf8'));
    console.log(`• Referências cruzadas: ${cross.meta?.verses || 0} versículos indexados.`);
  } catch {
    console.warn('! crossrefs.json ausente — o painel de referências cruzadas ficará vazio.');
  }
  console.log('Pronto.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
