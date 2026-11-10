import { countWords, stripHtml } from '../lib/html.js';

export const DEFAULT_WPM = 150;

/** Estimativa em minutos para um bloco de HTML. */
export function minutesFor(html, wpm = DEFAULT_WPM) {
  const words = countWords(html);
  const rate = Number(wpm) > 40 ? Number(wpm) : DEFAULT_WPM;
  return { words, minutes: Math.round((words / rate) * 10) / 10 };
}

/**
 * Métricas do sermão: palavras e minutos por seção + total.
 * O fator de pausa compensa respiração, transições e momentos de silêncio.
 */
export function sermonMetrics(sermon, wpm = DEFAULT_WPM, pauseFactor = 1.1) {
  const sections = sermon?.sections || {};
  const introduction = minutesFor(sections.introduction?.html, wpm);
  const developments = (sections.developments || []).map((dev) => ({
    id: dev.id,
    title: dev.title || '',
    ...minutesFor(dev.html, wpm),
  }));
  const conclusion = minutesFor(sections.conclusion?.html, wpm);
  const words =
    introduction.words + conclusion.words + developments.reduce((sum, d) => sum + d.words, 0);
  const raw = words / (Number(wpm) > 40 ? Number(wpm) : DEFAULT_WPM);
  const minutes = Math.round(raw * pauseFactor * 10) / 10;
  return {
    wpm: Number(wpm) || DEFAULT_WPM,
    words,
    rawMinutes: Math.round(raw * 10) / 10,
    minutes,
    pauseFactor,
    sections: { introduction, developments, conclusion },
    plainText: stripHtml(
      [
        sections.introduction?.html,
        ...(sections.developments || []).flatMap((d) => [d.title, d.html]),
        sections.conclusion?.html,
      ].join(' '),
    ),
  };
}

/** Calcula palavras por minuto a partir de uma leitura cronometrada. */
export function calculateWpm({ words, seconds }) {
  const w = Number(words);
  const s = Number(seconds);
  if (!Number.isFinite(w) || !Number.isFinite(s) || w < 20 || s < 10) return null;
  return Math.round((w / (s / 60)) * 10) / 10;
}
