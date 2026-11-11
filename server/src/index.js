import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HOST, PORT, PUBLIC_DIR, PUBLIC_URL, ACCESS_PASSWORD, DATA_DIR } from './config.js';
import { initDb } from './db.js';
import { createAccess } from './lib/access.js';
import bibleRoutes from './routes/bible.js';
import studyRoutes from './routes/study.js';
import sermonRoutes from './routes/sermons.js';
import profileRoutes from './routes/profile.js';
import musicRoutes from './routes/music.js';
import shareRoutes, { sharePage, sharePdf } from './routes/share.js';
import { BibleError } from './providers/bolls.js';
import { closePdfBrowser } from './services/pdf.js';
import authRoutes from './routes/auth.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

if (ACCESS_PASSWORD) {
  const access = createAccess(ACCESS_PASSWORD, { demo: process.env.PULPITO_DEMO === '1' });
  app.post('/__access', express.urlencoded({ extended: false }), access.login);
  app.get('/__access/logout', access.logout);
  app.use(access.middleware);
}

// CORS simples para desenvolvimento e produção
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const startedAt = Date.now();
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'Púlpito',
    version: '1.0.0',
    uptime: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  });
});

/*
 * Quando o servidor é aberto para a rede (HOST=0.0.0.0), outros dispositivos
 * podem abrir os links /s/<token>, mas não o editor. Para liberar o editor no Render,
 * defina a variável de ambiente PULPITO_ALLOW_REMOTE_EDIT=1 no painel do Render.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const remoteReadOnly = process.env.PULPITO_ALLOW_REMOTE_EDIT !== '1';

function remoteNotice() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Somente leitura · Púlpito</title>
  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3ede2;color:#211d17;font-family:Georgia,serif}.box{max-width:440px;padding:36px;text-align:center}p{font-family:Arial,sans-serif;font-size:14px;color:#6f6558;line-height:1.65}</style>
  </head><body><div class="box"><h1>Modo somente leitura</h1><p>Neste dispositivo, o Púlpito abre apenas links de sermões compartilhados. O editor fica no computador que roda o servidor.</p></div></body></html>`;
}

app.use((req, res, next) => {
  if (!remoteReadOnly || req.method === 'OPTIONS') return next();
  const forwarded = String(
    req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '',
  )
    .split(',')[0]
    .trim();
  const address = forwarded || req.socket.remoteAddress || '';
  if (LOOPBACK.has(address)) return next();
  if (
    req.path.startsWith('/s/') ||
    req.path.startsWith('/api/share') ||
    req.path === '/api/health'
  ) {
    return next();
  }
  if (req.method === 'GET' && req.path === '/') {
    return res.status(403).type('html').send(remoteNotice());
  }
  return res.status(403).json({
    error: 'O Púlpito está em modo somente leitura para outros dispositivos. Use um link de compartilhamento ou configure PULPITO_ALLOW_REMOTE_EDIT=1.',
    code: 'remote_readonly',
  });
});

app.get('/api/network', (_req, res) => {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  res.json({
    host: HOST,
    port: PORT,
    lanEnabled: HOST === '0.0.0.0' || HOST === '::',
    addresses: [...new Set(addresses)],
    publicUrl: PUBLIC_URL,
  });
});

app.use(express.json());
app.use('/api/bible', bibleRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/sermons', sermonRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/share', shareRoutes);
app.get('/s/:token/pdf', sharePdf);
app.get('/s/:token', sharePage);
app.use('/api/auth', authRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.', code: 'not_found' });
});

// Front-end compilado (produção).
if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

// Tratamento de erros com mensagens amigáveis.
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err instanceof BibleError || err instanceof Error && err.status) {
    return res.status(err.status || 500).json({ error: err.message, code: err.code || 'error' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Conteúdo grande demais.', code: 'too_large' });
  }
  console.error('[erro]', err);
  res.status(500).json({ error: 'Algo deu errado no servidor.', code: 'internal_error' });
});

async function start() {
  await initDb();
  const server = app.listen(PORT, HOST, () => {
    console.log(`\n  Púlpito · API pronta em http://${HOST}:${PORT}`);
    console.log(`  Dados em: ${DATA_DIR}\n`);
  });
  const shutdown = async () => {
    await closePdfBrowser();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});