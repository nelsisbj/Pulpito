import crypto from 'node:crypto';
import { escapeHtml } from './html.js';

const COOKIE = 'pulpito_access';
const MAX_AGE = 60 * 60 * 24 * 7;

function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return out;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeNext(value) {
  const next = String(value || '/');
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

function loginPage({ error = '', next = '/', demo = false } = {}) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${demo ? 'Demo do Púlpito' : 'Púlpito'} · acesso</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(900px 500px at 50% -20%, #fffdf8, #f3ede2);
    color: #211d17; font-family: "Segoe UI", Arial, sans-serif; padding: 24px;
  }
  .card {
    width: 100%; max-width: 390px; background: #fffdf8; border: 1px solid rgba(60,46,28,.16);
    border-radius: 16px; padding: 30px; box-shadow: 0 30px 70px -45px rgba(37,28,17,.55);
  }
  .mark {
    width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center;
    background: #2f5d50; color: #f6f1e6; font-family: Georgia, serif; font-size: 22px; margin-bottom: 18px;
  }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 27px; margin: 0 0 4px; letter-spacing: -.02em; }
  p { color: #7c7162; font-size: 13.5px; line-height: 1.55; margin: 0 0 20px; }
  label { display: block; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #7c7162; margin-bottom: 6px; }
  input {
    width: 100%; height: 42px; border: 1px solid rgba(60,46,28,.2); border-radius: 9px;
    padding: 0 12px; font-size: 15px; background: #fff; color: #211d17; outline: none;
  }
  input:focus { border-color: #2f5d50; box-shadow: 0 0 0 3px rgba(47,93,80,.12); }
  button {
    width: 100%; height: 42px; margin-top: 14px; border: 0; border-radius: 9px;
    background: #2f5d50; color: #f6f1e6; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #3f7a68; }
  .error { color: #9d3a31; background: rgba(157,58,49,.08); padding: 9px 11px; border-radius: 8px; font-size: 12.5px; margin-bottom: 14px; }
  .foot { margin-top: 18px; font-size: 11px; color: #a1968a; text-align: center; }
</style>
</head>
<body>
  <form class="card" method="post" action="/__access">
    <div class="mark">✝</div>
    <h1>${demo ? 'Demo do Púlpito' : 'Púlpito'}</h1>
    <p>${demo ? 'Este é um ambiente de demonstração. Digite a senha combinada para entrar.' : 'Digite a senha de acesso.'}</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    <input type="hidden" name="next" value="${escapeHtml(next)}">
    <label for="password">Senha</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="submit">Entrar</button>
    <div class="foot">Sermões e textos ficam neste servidor de demonstração.</div>
  </form>
</body>
</html>`;
}

export function createAccess(password, { demo = false } = {}) {
  const token = crypto.createHmac('sha256', String(password)).update('pulpito-access-v1').digest('base64url');
  const passwordHash = crypto.createHash('sha256').update(String(password)).digest();
  const failures = new Map();
  const WINDOW = 10 * 60 * 1000;
  const MAX_ATTEMPTS = 8;

  function clientKey(req) {
    return String(
      req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?',
    )
      .split(',')[0]
      .trim();
  }

  function isBlocked(key) {
    const entry = failures.get(key);
    if (!entry) return false;
    if (Date.now() - entry.first > WINDOW) {
      failures.delete(key);
      return false;
    }
    return entry.count >= MAX_ATTEMPTS;
  }

  function registerFailure(key) {
    const entry = failures.get(key);
    if (!entry || Date.now() - entry.first > WINDOW) {
      failures.set(key, { count: 1, first: Date.now() });
    } else {
      entry.count += 1;
    }
    if (failures.size > 500) {
      for (const [ip, value] of failures) {
        if (Date.now() - value.first > WINDOW) failures.delete(ip);
      }
    }
  }

  function isAuthenticated(req) {
    const cookies = parseCookies(req.headers.cookie);
    return safeEqual(cookies[COOKIE] || '', token);
  }

  function middleware(req, res, next) {
    if (req.path === '/__access' || req.path === '/__access/logout') return next();
    if (req.path === '/api/health') return next();
    if (isAuthenticated(req)) return next();

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        error: 'Acesso restrito. Recarregue a página e informe a senha do demo.',
        code: 'access_required',
      });
    }
    return res.status(401).type('html').send(loginPage({ next: req.originalUrl, demo }));
  }

  function login(req, res) {
    const next = normalizeNext(req.body?.next);
    const key = clientKey(req);
    if (isBlocked(key)) {
      return res
        .status(429)
        .type('html')
        .send(loginPage({ error: 'Muitas tentativas. Aguarde alguns minutos.', next, demo }));
    }
    const provided = crypto.createHash('sha256').update(String(req.body?.password || '')).digest();
    if (!crypto.timingSafeEqual(provided, passwordHash)) {
      registerFailure(key);
      return res.status(401).type('html').send(loginPage({ error: 'Senha incorreta.', next, demo }));
    }
    failures.delete(key);
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`,
    );
    res.redirect(next);
  }

  function logout(_req, res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.redirect('/__access');
  }

  return { middleware, login, logout };
}
