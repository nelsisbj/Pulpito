import { readJson } from '../lib/fsx.js';
import { getChapter, versesOf } from './bolls.js';
import { BOOK_BY_ID } from '../../../shared/books.js';
import { formatReference } from '../../../shared/references.js';
import { SEED_DIR } from '../config.js';

let notesPromise = null;

function loadNotes() {
  if (!notesPromise) {
    notesPromise = readJson(`${SEED_DIR}/commentary.json`, { notes: {} })
      .then((data) => data?.notes || {})
      .catch(() => ({}));
  }
  return notesPromise;
}

/**
 * Notas de estudo originais do Púlpito para passagens-chave.
 * A chave é "livro:capítulo:versículo".
 */
export async function getStudyNotes(ref, { limit = 2 } = {}) {
  const notes = await loadNotes();
  const start = ref.verseStart || 1;
  const end = ref.verseEnd || start;
  const found = [];
  for (let verse = start; verse <= Math.min(end, start + 3); verse += 1) {
    const entry = notes[`${ref.bookId}:${ref.chapter}:${verse}`];
    if (entry) {
      found.push({
        ...entry,
        ref: formatReference({ bookId: ref.bookId, chapter: ref.chapter, verseStart: verse }),
        source: 'Púlpito · nota de estudo',
      });
    }
  }
  return found.slice(0, limit);
}

export async function getStudyNoteCount() {
  return Object.keys(await loadNotes()).length;
}

/**
 * Notas da tradução (rodapés). Algumas traduções (NAA, KJA…) trazem
 * referências e notas do editor no campo `comment`.
 */
export async function getTranslationNotes(ref, translation = 'NAA') {
  const chapter = await getChapter(translation, ref.bookId, ref.chapter);
  const verses = versesOf(chapter, ref);
  return verses
    .filter((v) => v.comment)
    .map((v) => ({
      verse: v.verse,
      text: v.comment,
      source: `${translation} · nota ${v.verse}`,
    }));
}

export async function getPassage(ref, translation = 'ARA') {
  const chapter = await getChapter(translation, ref.bookId, ref.chapter);
  const verses = versesOf(chapter, ref);
  return {
    translation,
    bookName: BOOK_BY_ID.get(ref.bookId)?.name || chapter.bookName,
    chapter: ref.chapter,
    verses,
  };
}
