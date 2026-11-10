const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
};

export function decodeEntities(input) {
  return String(input ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span',
  'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'div', 'sup', 'sub',
]);

const STYLE_PROPS = new Set(['color', 'background-color', 'font-weight', 'font-style', 'text-decoration']);

function sanitizeColor(value) {
  const v = String(value).trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/.test(v)) return v;
  if (/^rgba?\(\s*[\d.,%\s]+\)$/.test(v)) return v;
  if (/^[a-z]{3,24}$/.test(v)) return v;
  return null;
}

function sanitizeStyle(attrs) {
  const m = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs || '');
  if (!m) return '';
  const raw = m[2] ?? m[3] ?? '';
  const out = [];
  for (const chunk of raw.split(';')) {
    const idx = chunk.indexOf(':');
    if (idx === -1) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (!STYLE_PROPS.has(prop) || !value) continue;
    if (prop === 'color' || prop === 'background-color') {
      const c = sanitizeColor(value);
      if (c) out.push(`${prop}: ${c}`);
    } else if (prop === 'font-weight') {
      if (/^(bold|normal|[1-9]00|bolder|lighter)$/i.test(value)) out.push(`font-weight: ${value.toLowerCase()}`);
    } else if (prop === 'font-style') {
      if (/^(italic|normal|oblique)$/i.test(value)) out.push(`font-style: ${value.toLowerCase()}`);
    } else if (prop === 'text-decoration') {
      if (/^(underline|line-through|none|underline line-through)$/i.test(value)) out.push(`text-decoration: ${value.toLowerCase()}`);
    }
  }
  return out.join('; ');
}

/**
 * Sanitiza HTML vindo do editor ou de fontes externas.
 * Mantém apenas formatação segura (negrito, itálico, cores etc.).
 */
export function sanitizeHtml(input, { allowHeadings = true } = {}) {
  let html = String(input ?? '');
  if (!html) return '';
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<(script|style|iframe|object|embed|svg|math|link|meta|form)[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<\/?(script|style|iframe|object|embed|svg|math|link|meta|form)[^>]*>/gi, '');
  html = html.replace(/(\s)on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript:/gi, '');

  // Spans de referência são apenas visuais: guarda o texto, descarta a marcação.
  html = html.replace(/<span[^>]*data-ref="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  html = html.replace(/<\/?([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g, (match, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    const closing = /^<\s*\//.test(match);
    if (tag === 'font') {
      if (closing) return '</span>';
      const color = /color\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs || '');
      const c = color ? sanitizeColor(color[2] ?? color[3] ?? '') : null;
      return c ? `<span style="color: ${c}">` : '<span>';
    }
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (tag === 'br') return '<br>';
    if (!allowHeadings && (tag === 'h2' || tag === 'h3')) return closing ? '' : '<p>';
    if (closing) return `</${tag}>`;
    if (tag === 'span') {
      const style = sanitizeStyle(attrs);
      return style ? `<span style="${style}">` : '<span>';
    }
    return `<${tag}>`;
  });

  return html.trim();
}

/** Texto puro (sem tags) a partir de HTML. */
export function stripHtml(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove marcadores de nota (ⓐ, ⓩ, ①) comuns nas traduções. */
export function cleanVerseText(text) {
  const out = decodeEntities(String(text ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/[\u24B6-\u24E9\u2460-\u24FF\u2776-\u2793]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  // Algumas traduções (ARA, por exemplo) embrulham o versículo em aspas simples.
  return out.replace(/^[\s'"“‘]+/, '').replace(/[\s'"”’]+$/, '');
}

/** HTML enxuto e seguro para exibição de versículos. */
export function cleanVerseHtml(html) {
  const safe = String(html ?? '')
    .replace(/<(?!\/?(i|b|em|strong|br)\b)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '<br>');
  return safe.replace(/[\u24B6-\u24E9\u2460-\u24FF\u2776-\u2793]/g, '').trim();
}

export function countWords(text) {
  const plain = stripHtml(text);
  if (!plain) return 0;
  const matches = plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu);
  return matches ? matches.length : 0;
}
