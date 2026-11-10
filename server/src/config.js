import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

// Carrega .env simples, sem dependências (não sobrescreve variáveis já definidas).
try {
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || line.trim().startsWith('#')) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
} catch {
  /* .env é opcional */
}

export const PORT = Number(process.env.PORT || 4000);
export const HOST = process.env.HOST || '127.0.0.1';
export const DATA_DIR = process.env.PULPITO_DATA_DIR || path.join(ROOT, 'data');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const PDF_DIR = path.join(DATA_DIR, 'pdfs');
export const DB_FILE = path.join(DATA_DIR, 'pulpito.json');
export const PUBLIC_DIR = path.join(ROOT, 'server', 'public');
export const QUOTES_FILE = path.join(ROOT, 'server', 'src', 'data', 'quotes.json');
export const CROSSREFS_FILE = path.join(ROOT, 'server', 'src', 'data', 'crossrefs.json');
export const SEED_DIR = path.join(ROOT, 'server', 'src', 'data');

export const BIBLE_BASE = process.env.BIBLE_API_BASE || 'https://bolls.life';

// Traduções com texto liberado para uso. A NVI/NVIPT é bloqueada pela editora
// e retorna uma mensagem de protesto no lugar dos versículos — fica de fora.
export const BLOCKED_TRANSLATIONS = new Set(['NVIPT', 'NIV', 'NVI']);

export const DEFAULT_TRANSLATION = process.env.DEFAULT_TRANSLATION || 'ARA';
export const DEFAULT_COMPARE = ['ARA', 'NAA', 'NTLH'];
export const PUBLIC_URL = process.env.PULPITO_PUBLIC_URL || '';
export const ACCESS_PASSWORD = process.env.PULPITO_ACCESS_PASSWORD || '';

export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
