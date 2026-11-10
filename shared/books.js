// Cânone protestante (66 livros) com nomes em português, abreviações e apelidos.
// O `id` corresponde ao bookid usado pela API bolls.life.
export const BOOKS = [
  { id: 1, name: 'Gênesis', abbrev: 'Gn', aliases: ['genesis', 'gen', 'gn'], testament: 'AT', chapters: 50 },
  { id: 2, name: 'Êxodo', abbrev: 'Êx', aliases: ['exodo', 'ex', 'exo'], testament: 'AT', chapters: 40 },
  { id: 3, name: 'Levítico', abbrev: 'Lv', aliases: ['levitico', 'lev', 'lv'], testament: 'AT', chapters: 27 },
  { id: 4, name: 'Números', abbrev: 'Nm', aliases: ['numeros', 'num', 'nm'], testament: 'AT', chapters: 36 },
  { id: 5, name: 'Deuteronômio', abbrev: 'Dt', aliases: ['deuteronomio', 'deut', 'dt'], testament: 'AT', chapters: 34 },
  { id: 6, name: 'Josué', abbrev: 'Js', aliases: ['josue', 'jos', 'js'], testament: 'AT', chapters: 24 },
  { id: 7, name: 'Juízes', abbrev: 'Jz', aliases: ['juizes', 'juiz', 'jz'], testament: 'AT', chapters: 21 },
  { id: 8, name: 'Rute', abbrev: 'Rt', aliases: ['rute', 'rt'], testament: 'AT', chapters: 4 },
  { id: 9, name: '1 Samuel', abbrev: '1Sm', aliases: ['1 samuel', '1sam', '1 sm', '1sm', 'i samuel'], testament: 'AT', chapters: 31 },
  { id: 10, name: '2 Samuel', abbrev: '2Sm', aliases: ['2 samuel', '2sam', '2 sm', '2sm', 'ii samuel'], testament: 'AT', chapters: 24 },
  { id: 11, name: '1 Reis', abbrev: '1Rs', aliases: ['1 reis', '1reis', '1 rs', '1rs', 'i reis'], testament: 'AT', chapters: 22 },
  { id: 12, name: '2 Reis', abbrev: '2Rs', aliases: ['2 reis', '2reis', '2 rs', '2rs', 'ii reis'], testament: 'AT', chapters: 25 },
  { id: 13, name: '1 Crônicas', abbrev: '1Cr', aliases: ['1 cronicas', '1cronicas', '1 cr', '1cr', 'i cronicas'], testament: 'AT', chapters: 29 },
  { id: 14, name: '2 Crônicas', abbrev: '2Cr', aliases: ['2 cronicas', '2cronicas', '2 cr', '2cr', 'ii cronicas'], testament: 'AT', chapters: 36 },
  { id: 15, name: 'Esdras', abbrev: 'Ed', aliases: ['esdras', 'ed'], testament: 'AT', chapters: 10 },
  { id: 16, name: 'Neemias', abbrev: 'Ne', aliases: ['neemias', 'nee', 'ne'], testament: 'AT', chapters: 13 },
  { id: 17, name: 'Ester', abbrev: 'Et', aliases: ['ester', 'est', 'et'], testament: 'AT', chapters: 10 },
  { id: 18, name: 'Jó', abbrev: 'Jó', aliases: ['jo', 'job'], testament: 'AT', chapters: 42 },
  { id: 19, name: 'Salmos', abbrev: 'Sl', aliases: ['salmos', 'salmo', 'sl', 'ps', 'psalm'], testament: 'AT', chapters: 150 },
  { id: 20, name: 'Provérbios', abbrev: 'Pv', aliases: ['proverbios', 'prov', 'pv'], testament: 'AT', chapters: 31 },
  { id: 21, name: 'Eclesiastes', abbrev: 'Ec', aliases: ['eclesiastes', 'ecl', 'ec'], testament: 'AT', chapters: 12 },
  { id: 22, name: 'Cantares', abbrev: 'Ct', aliases: ['cantares', 'cantico dos canticos', 'canticos', 'ct'], testament: 'AT', chapters: 8 },
  { id: 23, name: 'Isaías', abbrev: 'Is', aliases: ['isaias', 'isa', 'is'], testament: 'AT', chapters: 66 },
  { id: 24, name: 'Jeremias', abbrev: 'Jr', aliases: ['jeremias', 'jer', 'jr'], testament: 'AT', chapters: 52 },
  { id: 25, name: 'Lamentações', abbrev: 'Lm', aliases: ['lamentacoes', 'lam', 'lm'], testament: 'AT', chapters: 5 },
  { id: 26, name: 'Ezequiel', abbrev: 'Ez', aliases: ['ezequiel', 'eze', 'ez'], testament: 'AT', chapters: 48 },
  { id: 27, name: 'Daniel', abbrev: 'Dn', aliases: ['daniel', 'dan', 'dn'], testament: 'AT', chapters: 12 },
  { id: 28, name: 'Oséias', abbrev: 'Os', aliases: ['oseias', 'ose', 'os'], testament: 'AT', chapters: 14 },
  { id: 29, name: 'Joel', abbrev: 'Jl', aliases: ['joel', 'jl'], testament: 'AT', chapters: 3 },
  { id: 30, name: 'Amós', abbrev: 'Am', aliases: ['amos', 'am'], testament: 'AT', chapters: 9 },
  { id: 31, name: 'Obadias', abbrev: 'Ob', aliases: ['obadias', 'oba', 'ob'], testament: 'AT', chapters: 1 },
  { id: 32, name: 'Jonas', abbrev: 'Jn', aliases: ['jonas', 'jon', 'jn'], testament: 'AT', chapters: 4 },
  { id: 33, name: 'Miquéias', abbrev: 'Mq', aliases: ['miqueias', 'miq', 'mq'], testament: 'AT', chapters: 7 },
  { id: 34, name: 'Naum', abbrev: 'Na', aliases: ['naum', 'na'], testament: 'AT', chapters: 3 },
  { id: 35, name: 'Habacuque', abbrev: 'Hc', aliases: ['habacuque', 'hab', 'hc'], testament: 'AT', chapters: 3 },
  { id: 36, name: 'Sofonias', abbrev: 'Sf', aliases: ['sofonias', 'sof', 'sf'], testament: 'AT', chapters: 3 },
  { id: 37, name: 'Ageu', abbrev: 'Ag', aliases: ['ageu', 'ag'], testament: 'AT', chapters: 2 },
  { id: 38, name: 'Zacarias', abbrev: 'Zc', aliases: ['zacarias', 'zac', 'zc'], testament: 'AT', chapters: 14 },
  { id: 39, name: 'Malaquias', abbrev: 'Ml', aliases: ['malaquias', 'mal', 'ml'], testament: 'AT', chapters: 4 },
  { id: 40, name: 'Mateus', abbrev: 'Mt', aliases: ['mateus', 'mat', 'mt'], testament: 'NT', chapters: 28 },
  { id: 41, name: 'Marcos', abbrev: 'Mc', aliases: ['marcos', 'mar', 'mc'], testament: 'NT', chapters: 16 },
  { id: 42, name: 'Lucas', abbrev: 'Lc', aliases: ['lucas', 'luc', 'lc'], testament: 'NT', chapters: 24 },
  { id: 43, name: 'João', abbrev: 'Jo', aliases: ['joao', 'joa', 'jo'], testament: 'NT', chapters: 21 },
  { id: 44, name: 'Atos', abbrev: 'At', aliases: ['atos', 'at', 'act'], testament: 'NT', chapters: 28 },
  { id: 45, name: 'Romanos', abbrev: 'Rm', aliases: ['romanos', 'rom', 'rm'], testament: 'NT', chapters: 16 },
  { id: 46, name: '1 Coríntios', abbrev: '1Co', aliases: ['1 corintios', '1corintios', '1 co', '1co', 'i corintios'], testament: 'NT', chapters: 16 },
  { id: 47, name: '2 Coríntios', abbrev: '2Co', aliases: ['2 corintios', '2corintios', '2 co', '2co', 'ii corintios'], testament: 'NT', chapters: 13 },
  { id: 48, name: 'Gálatas', abbrev: 'Gl', aliases: ['galatas', 'gal', 'gl'], testament: 'NT', chapters: 6 },
  { id: 49, name: 'Efésios', abbrev: 'Ef', aliases: ['efesios', 'efe', 'ef'], testament: 'NT', chapters: 6 },
  { id: 50, name: 'Filipenses', abbrev: 'Fp', aliases: ['filipenses', 'fil', 'fp'], testament: 'NT', chapters: 4 },
  { id: 51, name: 'Colossenses', abbrev: 'Cl', aliases: ['colossenses', 'col', 'cl'], testament: 'NT', chapters: 4 },
  { id: 52, name: '1 Tessalonicenses', abbrev: '1Ts', aliases: ['1 tessalonicenses', '1tessalonicenses', '1 ts', '1ts', 'i tessalonicenses'], testament: 'NT', chapters: 5 },
  { id: 53, name: '2 Tessalonicenses', abbrev: '2Ts', aliases: ['2 tessalonicenses', '2tessalonicenses', '2 ts', '2ts', 'ii tessalonicenses'], testament: 'NT', chapters: 3 },
  { id: 54, name: '1 Timóteo', abbrev: '1Tm', aliases: ['1 timoteo', '1timoteo', '1 tm', '1tm', 'i timoteo'], testament: 'NT', chapters: 6 },
  { id: 55, name: '2 Timóteo', abbrev: '2Tm', aliases: ['2 timoteo', '2timoteo', '2 tm', '2tm', 'ii timoteo'], testament: 'NT', chapters: 4 },
  { id: 56, name: 'Tito', abbrev: 'Tt', aliases: ['tito', 'tit', 'tt'], testament: 'NT', chapters: 3 },
  { id: 57, name: 'Filemom', abbrev: 'Fm', aliases: ['filemom', 'filemon', 'fm'], testament: 'NT', chapters: 1 },
  { id: 58, name: 'Hebreus', abbrev: 'Hb', aliases: ['hebreus', 'heb', 'hb'], testament: 'NT', chapters: 13 },
  { id: 59, name: 'Tiago', abbrev: 'Tg', aliases: ['tiago', 'tia', 'tg'], testament: 'NT', chapters: 5 },
  { id: 60, name: '1 Pedro', abbrev: '1Pe', aliases: ['1 pedro', '1pedro', '1 pe', '1pe', 'i pedro'], testament: 'NT', chapters: 5 },
  { id: 61, name: '2 Pedro', abbrev: '2Pe', aliases: ['2 pedro', '2pedro', '2 pe', '2pe', 'ii pedro'], testament: 'NT', chapters: 3 },
  { id: 62, name: '1 João', abbrev: '1Jo', aliases: ['1 joao', '1joao', '1 jo', '1jo', 'i joao'], testament: 'NT', chapters: 5 },
  { id: 63, name: '2 João', abbrev: '2Jo', aliases: ['2 joao', '2joao', '2 jo', '2jo', 'ii joao'], testament: 'NT', chapters: 1 },
  { id: 64, name: '3 João', abbrev: '3Jo', aliases: ['3 joao', '3joao', '3 jo', '3jo', 'iii joao'], testament: 'NT', chapters: 1 },
  { id: 65, name: 'Judas', abbrev: 'Jd', aliases: ['judas', 'jud', 'jd'], testament: 'NT', chapters: 1 },
  { id: 66, name: 'Apocalipse', abbrev: 'Ap', aliases: ['apocalipse', 'apo', 'ap', 'revelation'], testament: 'NT', chapters: 22 },
];

export const BOOK_BY_ID = new Map(BOOKS.map((b) => [b.id, b]));

export const BOOK_ALIASES = (() => {
  const map = new Map();
  for (const book of BOOKS) {
    const names = [book.name, book.abbrev, ...book.aliases];
    for (const n of names) {
      const key = n
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, book.id);
    }
  }
  return map;
})();

export const CHAPTER_COUNTS = Object.fromEntries(BOOKS.map((b) => [b.id, b.chapters]));

export function bookName(id) {
  return BOOK_BY_ID.get(Number(id))?.name ?? '';
}
