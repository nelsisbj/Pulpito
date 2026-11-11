import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findReferences,
  foldText,
  formatReference,
  parseReference,
} from '../../shared/references.js';
import { detectTags } from '../src/services/tags.js';
import { calculateWpm, sermonMetrics } from '../src/services/timing.js';
import { cleanVerseText, countWords, sanitizeHtml, stripHtml } from '../src/lib/html.js';
import { scorePhrase } from '../src/services/suggest.js';
import { crossReferences } from '../src/providers/crossrefs.js';
import { getStudyNotes } from '../src/providers/commentary.js';
import { renderPrintHtml } from '../src/services/pdf.js';
import { chapter } from '../../web/src/lib/api.js';

test('cliente da Bíblia envia versão, livro e capítulo no contrato do painel', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const calls = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null },
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response('{"verses":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await chapter('ARA', 43, 3);
    const url = new URL(calls[0].url, 'http://localhost');
    assert.equal(url.pathname, '/api/bible/chapter');
    assert.equal(url.searchParams.get('translation'), 'ARA');
    assert.equal(url.searchParams.get('book'), '43');
    assert.equal(url.searchParams.get('chapter'), '3');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});

test('interpreta referências em português', () => {
  const ref = parseReference('João 3:16');
  assert.equal(ref.bookId, 43);
  assert.equal(ref.chapter, 3);
  assert.equal(ref.verseStart, 16);
  assert.equal(ref.canonical, 'João 3:16');
});

test('resolve livros numerados e abreviações', () => {
  assert.equal(parseReference('1 João 4:8').bookId, 62);
  assert.equal(parseReference('1Jo 4:8').bookId, 62);
  assert.equal(parseReference('Rm 8:28-30').bookId, 45);
  assert.deepEqual(
    [parseReference('Rm 8:28-30').verseStart, parseReference('Rm 8:28-30').verseEnd],
    [28, 30],
  );
});

test('desambigua "Jó" e "João" pela quantidade de capítulos', () => {
  assert.equal(parseReference('Jó 42:1').bookId, 18);
  assert.equal(parseReference('Jo 3:16').bookId, 43);
});

test('aceita capítulo sem versículo e separador com ponto', () => {
  const chapter = parseReference('Salmos 23');
  assert.equal(chapter.bookId, 19);
  assert.equal(chapter.chapter, 23);
  assert.equal(chapter.verseStart, null);
  assert.equal(parseReference('Gênesis 1.1').verseStart, 1);
});

test('rejeita texto que não é referência', () => {
  assert.equal(parseReference('a graça que transforma'), null);
  assert.equal(parseReference(''), null);
});

test('encontra referências no meio do texto', () => {
  const text = 'Leia João 3:16 e depois Rm 8:28 para meditar.';
  const refs = findReferences(text);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].ref.bookId, 43);
  assert.equal(text.slice(refs[1].start, refs[1].end), 'Rm 8:28');
});

test('foldText preserva o comprimento (índices 1:1)', () => {
  const input = 'Ação, coração e fé';
  assert.equal(foldText(input).length, input.length);
});

test('formata referências com faixa', () => {
  assert.equal(
    formatReference({ bookId: 45, chapter: 8, verseStart: 28, verseEnd: 30 }),
    'Romanos 8:28-30',
  );
});

test('detecta temas pelo conteúdo e pelo tema declarado', () => {
  const body = '<p>A graça de Deus nos alcança. A graça é suficiente, e a graça transforma.</p>';
  const tags = detectTags(body, { theme: 'graça e salvação' });
  assert.equal(tags[0].label, 'Graça');
  assert.ok(tags.some((tag) => tag.label === 'Salvação'));
  assert.ok(tags[0].score >= 3);
});

test('conta palavras ignorando HTML', () => {
  assert.equal(countWords('<p>Deus é amor.</p>'), 3);
  assert.equal(stripHtml('<p>Deus <b>é</b> amor.</p>'), 'Deus é amor.');
});

test('estima duração com fator de pausa', () => {
  const metrics = sermonMetrics(
    {
      sections: {
        introduction: { html: '<p>' + Array(50).fill('palavra').join(' ') + '</p>' },
        developments: [{ id: 'd1', title: 'Ponto', html: '<p>' + Array(50).fill('palavra').join(' ') + '</p>' }],
        conclusion: { html: '<p>' + Array(50).fill('palavra').join(' ') + '</p>' },
      },
    },
    150,
    1.1,
  );
  assert.equal(metrics.words, 150);
  assert.equal(metrics.rawMinutes, 1);
  assert.equal(metrics.minutes, 1.1);
});

test('calcula palavras por minuto', () => {
  assert.equal(calculateWpm({ words: 300, seconds: 120 }), 150);
  assert.equal(calculateWpm({ words: 10, seconds: 5 }), null);
});

test('sanitiza HTML removendo scripts, eventos e spans visuais', () => {
  const html = sanitizeHtml(
    '<p onclick="alert(1)">Oi <script>alert(1)</script><b>mundo</b> <span class="verse-ref" data-ref="João 3:16">João 3:16</span></p>',
  );
  assert.ok(!html.includes('script'));
  assert.ok(!html.includes('onclick'));
  assert.ok(!html.includes('data-ref'));
  assert.ok(html.includes('<b>mundo</b>'));
  assert.ok(html.includes('João 3:16'));
});

test('limpa aspas externas e marcadores de nota dos versículos', () => {
  assert.equal(cleanVerseText("'Porque Deus amou o mundo.'"), 'Porque Deus amou o mundo.');
  assert.equal(cleanVerseText('Texto ⓐ com nota'), 'Texto com nota');
});

test('pontuação de citação', () => {
  const verse = 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.';
  assert.equal(scorePhrase('Porque Deus amou o mundo', verse), 1);
  assert.ok(scorePhrase('Deus amou o mundo', verse) > 0.9);
  assert.ok(scorePhrase('totalmente outra coisa', verse) < 0.5);
});

test('referências cruzadas de João 3:16 incluem Romanos 5:8', async () => {
  const refs = await crossReferences({ bookId: 43, chapter: 3, verseStart: 16, verseEnd: null });
  assert.ok(refs.length > 0);
  assert.ok(refs.some((item) => item.canonical === 'Romanos 5:8'));
});

test('notas de estudo existem para João 3:16', async () => {
  const notes = await getStudyNotes({ bookId: 43, chapter: 3, verseStart: 16, verseEnd: null });
  assert.equal(notes[0].title, 'O amor que se dá');
  assert.ok(notes[0].body.length > 80);
});

test('gera HTML de impressão com seções e referências', () => {
  const html = renderPrintHtml(
    {
      title: 'Sermão de teste',
      theme: 'graça',
      tags: ['Graça'],
      sections: {
        introduction: { html: '<p>Leia João 3:16.</p>' },
        developments: [{ title: 'Ponto um', html: '<p>Porque Deus amou o mundo.</p>' }],
        conclusion: { html: '<p>Amém.</p>' },
      },
    },
    { wpm: 150 },
  );
  assert.ok(html.includes('Sermão de teste'));
  assert.ok(html.includes('Introdução'));
  assert.ok(html.includes('Ponto um'));
  assert.ok(html.includes('Referências citadas'));
  assert.ok(!html.includes('<script>'));
});
