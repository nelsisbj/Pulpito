import { readJson } from '../lib/fsx.js';
import { QUOTES_FILE } from '../config.js';
import { foldText, formatReference, parseReference } from '../../../shared/references.js';
import { getVerse, search } from '../providers/bolls.js';

let quotesPromise = null;
const recent = new Map();

export function normalizePhrase(text) {
  return foldText(String(text ?? ''))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scorePhrase(query, verse) {
  const q = normalizePhrase(query);
  const v = normalizePhrase(verse);
  if (!q || !v) return 0;
  if (v.includes(q)) {
    const atStart = v.startsWith(q);
    return atStart ? 1 : 0.93;
  }
  const qw = q.split(' ');
  const vw = v.split(' ');
  let prefix = 0;
  while (prefix < qw.length && prefix < vw.length && qw[prefix] === vw[prefix]) prefix += 1;
  const prefixScore = prefix / qw.length;
  const set = new Set(vw);
  const recall = qw.filter((w) => set.has(w)).length / qw.length;
  return Math.max(prefixScore * 0.96, recall * 0.78);
}

async function loadQuotes() {
  if (!quotesPromise) {
    quotesPromise = readJson(QUOTES_FILE, { quotes: [] })
      .then((data) => (Array.isArray(data?.quotes) ? data.quotes : []))
      .catch(() => []);
  }
  return quotesPromise;
}

function quoteToResult(quote, score) {
  return {
    ref: quote.ref || formatReference(quote),
    bookId: quote.bookId,
    chapter: quote.chapter,
    verseStart: quote.verseStart,
    verseEnd: quote.verseEnd || null,
    text: quote.text,
    translation: quote.translation || 'ARA',
    score: Math.round(score * 100) / 100,
  };
}

/**
 * O índice local é ARA, mas a citação deve sair na versão escolhida.
 * Depois de identificar a referência, busca o mesmo trecho na tradução ativa.
 */
async function localizeMatch(raw, match, translation) {
  if (!translation || translation === 'ARA' || !match) return match;
  try {
    const verse = await getVerse(match, translation);
    if (!verse?.text) return match;
    const rescored = scorePhrase(raw, verse.text);
    return {
      ...match,
      text: verse.text,
      translation,
      score: Math.max(match.score, rescored),
    };
  } catch {
    return match;
  }
}

function pickBest(query, candidates) {
  const scored = [];
  for (const item of candidates) {
    const score = scorePhrase(query, item.text);
    if (score > 0.55) scored.push({ ...item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Sugere o versículo que o pregador começou a citar.
 * Primeiro tenta o índice local (rápido, offline); depois a busca semântica da API.
 */
export async function suggestVerse(query, { translation = 'ARA' } = {}) {
  const raw = String(query || '').trim();
  if (raw.length < 8) return { query: raw, match: null, alternatives: [], source: 'none' };

  const words = normalizePhrase(raw).split(' ').filter(Boolean);
  if (words.length < 3) return { query: raw, match: null, alternatives: [], source: 'none' };

  const preferred = String(translation || 'ARA').toUpperCase();
  const cacheKey = `${preferred}:${raw.toLowerCase()}`;
  const cached = recent.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.value;

  const local = await loadQuotes();
  const localScored = pickBest(raw, local);
  let match = localScored[0] || null;
  if (match) match = await localizeMatch(raw, match, preferred);
  let source = 'local';

  if (!match || match.score < 0.82) {
    let remote = [];
    try {
      remote = await search(preferred, raw, { limit: 12 });
    } catch {
      /* tradução indisponível: tenta a ARA abaixo */
    }
    if (!remote.length && preferred !== 'ARA') {
      try {
        remote = await search('ARA', raw, { limit: 12 });
      } catch {
        /* sem rede: mantém o índice local */
      }
    }
    const remoteScored = pickBest(raw, remote);
    if (remoteScored[0] && (!match || remoteScored[0].score > match.score)) {
      match = remoteScored[0];
      source = 'remote';
    }
  }

  if (!match || match.score < 0.6) {
    const value = {
      query: raw,
      match: null,
      alternatives: localScored.slice(0, 3).map((q) => quoteToResult(q, q.score)),
      source: 'none',
    };
    recent.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  const alternatives = [...localScored, ...(match ? [match] : [])]
    .filter((item) => item.ref !== match.ref)
    .filter((item, index, arr) => arr.findIndex((x) => x.ref === item.ref) === index)
    .slice(0, 3)
    .map((q) => quoteToResult(q, q.score));

  const value = {
    query: raw,
    match: quoteToResult(match, match.score),
    alternatives,
    source,
  };
  recent.set(cacheKey, { at: Date.now(), value });
  if (recent.size > 200) {
    const oldest = [...recent.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) recent.delete(oldest[0]);
  }
  return value;
}

export function parseReferenceOrNull(text) {
  return parseReference(text);
}
