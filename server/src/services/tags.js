import { TOPICS } from '../../../shared/topics.js';
import { foldText } from '../../../shared/references.js';
import { stripHtml } from '../lib/html.js';

const PHRASES = TOPICS.map((topic) => ({
  ...topic,
  phrases: topic.keywords.map((k) => foldText(k)).filter(Boolean),
}));

function countPhrase(haystack, needle) {
  let count = 0;
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    const before = haystack[idx - 1];
    const after = haystack[idx + needle.length];
    const beforeOk = !before || !/[a-z0-9]/.test(before);
    const afterOk = !after || !/[a-z0-9]/.test(after);
    if (beforeOk && afterOk) count += 1;
    from = idx + needle.length;
  }
  return count;
}

/** Detecta temas a partir do texto do sermão. */
export function detectTags(text, { title = '', theme = '', limit = 6 } = {}) {
  const body = ` ${foldText(stripHtml(text))} `;
  const extra = ` ${foldText(`${title} ${theme}`)} `;
  const scored = [];
  for (const topic of PHRASES) {
    let bodyCount = 0;
    let extraCount = 0;
    for (const phrase of topic.phrases) {
      bodyCount += countPhrase(body, phrase);
      extraCount += countPhrase(extra, phrase);
    }
    // Uma menção solta no corpo é ruído; duas já indicam um fio condutor.
    if (!extraCount && bodyCount < 2) continue;
    const score = bodyCount + extraCount * 3;
    if (score > 0) scored.push({ id: topic.id, label: topic.label, score, bodyCount });
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt-BR'));
  const top = scored.slice(0, limit);
  const max = top[0]?.score || 1;
  return top.map((t) => ({ ...t, weight: Math.round((t.score / max) * 100) / 100 }));
}

export function sermonText(sermon) {
  const sections = sermon?.sections;
  if (!sections) return '';
  const parts = [sections.introduction?.html || ''];
  for (const dev of sections.developments || []) parts.push(dev.title || '', dev.html || '');
  parts.push(sections.conclusion?.html || '');
  return parts.join('\n');
}

export function tagsForSermon(sermon, limit = 6) {
  return detectTags(sermonText(sermon), {
    title: sermon?.title || '',
    theme: sermon?.theme || '',
    limit,
  });
}
