export class HttpError extends Error {
  constructor(message, status = 400, code = 'bad_request') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function parseRefInput(input) {
  if (input && typeof input === 'object') {
    const bookId = Number(input.bookId);
    const chapter = Number(input.chapter);
    const verseStart = input.verseStart != null && input.verseStart !== '' ? Number(input.verseStart) : null;
    const verseEnd = input.verseEnd != null && input.verseEnd !== '' ? Number(input.verseEnd) : null;
    if (!bookId || !chapter) throw new HttpError('Informe livro e capítulo.', 400, 'invalid_reference');
    return {
      bookId,
      chapter,
      verseStart: Number.isFinite(verseStart) ? verseStart : null,
      verseEnd: Number.isFinite(verseEnd) && verseStart && verseEnd > verseStart ? verseEnd : null,
    };
  }
  return null;
}
