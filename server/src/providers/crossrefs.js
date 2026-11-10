import { readJson } from '../lib/fsx.js';
import { CROSSREFS_FILE } from '../config.js';
import { BOOK_BY_ID } from '../../../shared/books.js';
import { formatReference } from '../../../shared/references.js';

let loadPromise = null;

async function loadRefs() {
  if (!loadPromise) {
    loadPromise = readJson(CROSSREFS_FILE, { refs: {} })
      .then((data) => data?.refs || {})
      .catch(() => ({}));
  }
  return loadPromise;
}

/**
 * Referências cruzadas para um versículo (ou para o primeiro versículo de um trecho).
 * Fonte: OpenBible.info (CC-BY).
 */
export async function crossReferences(ref, { limit = 14 } = {}) {
  const all = await loadRefs();
  const starts = ref?.verseStart
    ? Array.from({ length: Math.min((ref.verseEnd || ref.verseStart) - ref.verseStart + 1, 4) }, (_, i) => ref.verseStart + i)
    : [1];
  const merged = new Map();
  for (const verse of starts) {
    const rows = all[`${ref.bookId}:${ref.chapter}:${verse}`] || [];
    for (const row of rows) {
      const [bookId, chapter, verseStart, verseEnd, votes] = row;
      if (bookId === ref.bookId && chapter === ref.chapter && verseStart === verse) continue;
      const key = `${bookId}:${chapter}:${verseStart}:${verseEnd || 0}`;
      const prev = merged.get(key);
      if (!prev || prev.votes < votes) {
        merged.set(key, { bookId, chapter, verseStart, verseEnd: verseEnd || null, votes, fromVerse: verse });
      }
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, limit)
    .map((row) => {
      const target = {
        bookId: row.bookId,
        chapter: row.chapter,
        verseStart: row.verseStart,
        verseEnd: row.verseEnd,
      };
      return {
        ...target,
        votes: row.votes,
        bookName: BOOK_BY_ID.get(row.bookId)?.name || '',
        canonical: formatReference(target),
      };
    });
}

export async function crossReferenceCount() {
  const refs = await loadRefs();
  return Object.keys(refs).length;
}
