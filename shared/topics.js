// Taxonomia de temas para marcação automática dos sermões.
// As palavras-chave são comparadas sem acentos e em minúsculas.
export const TOPICS = [
  {
    id: 'amor',
    label: 'Amor de Deus',
    keywords: ['amor', 'amou', 'ama', 'amado', 'amados', 'amar', 'amoroso', 'bondade', 'bondoso'],
  },
  {
    id: 'fe',
    label: 'Fé',
    keywords: ['fe', 'crer', 'cre', 'creem', 'creu', 'crenca', 'confianca', 'confiar', 'fiel', 'fidelidade'],
  },
  {
    id: 'graca',
    label: 'Graça',
    keywords: ['graca', 'gratuito', 'imerecido', 'misericordia', 'misericordioso', 'compassao', 'compadece'],
  },
  {
    id: 'compaixao',
    label: 'Compaixão',
    keywords: ['compaixao', 'compadecer', 'compadece', 'compadecido', 'misericordia', 'misericordioso', 'se compadece', 'movido de compaixao'],
  },
  {
    id: 'encarnacao',
    label: 'Encarnação',
    keywords: ['encarnacao', 'encarnou', 'verbo se fez carne', 'deus conosco', 'emanuel', 'presepe', 'natal de cristo'],
  },
  {
    id: 'salvacao',
    label: 'Salvação',
    keywords: ['salvacao', 'salvo', 'salvos', 'salvar', 'salvador', 'redencao', 'redentor', 'remir', 'cruz', 'sangue', 'cordeiro', 'justificacao', 'justificado'],
  },
  {
    id: 'oracao',
    label: 'Oração',
    keywords: ['oracao', 'oracoes', 'orar', 'orando', 'intercessao', 'interceder', 'clamor', 'clamar', 'suplica', 'buscar a deus'],
  },
  {
    id: 'santidade',
    label: 'Santidade',
    keywords: ['santidade', 'santo', 'santos', 'santificar', 'santificacao', 'consagracao', 'consagrado', 'pureza', 'puro', 'separado'],
  },
  {
    id: 'esperanca',
    label: 'Esperança',
    keywords: ['esperanca', 'esperar', 'aguardar', 'promessa', 'prometido', 'futuro', 'amanha'],
  },
  {
    id: 'sofrimento',
    label: 'Sofrimento',
    keywords: ['sofrimento', 'sofrer', 'dor', 'dores', 'provação', 'provacao', 'provado', 'tribulacao', 'lutou', 'luta', 'enfermidade', 'doenca', 'valle', 'deserto', 'crise'],
  },
  {
    id: 'familia',
    label: 'Família',
    keywords: ['familia', 'casamento', 'casados', 'marido', 'esposa', 'pais', 'lar', 'crianca', 'criancas', 'geracao', 'filhos', 'parentes'],
  },
  {
    id: 'missoes',
    label: 'Missões',
    keywords: ['missoes', 'missionario', 'missionarios', 'evangelho', 'evangelizar', 'nacoes', 'povos', 'terra distante', 'campo'],
  },
  {
    id: 'adoracao',
    label: 'Adoração',
    keywords: ['adoracao', 'adorar', 'adoradores', 'louvor', 'louvar', 'cântico', 'cantico', 'canticos', 'hino', 'hinos', 'exaltar', 'gloria a deus'],
  },
  {
    id: 'arrependimento',
    label: 'Arrependimento',
    keywords: ['arrependimento', 'arrepender', 'arrependidos', 'conversao', 'converter', 'pecado', 'pecados', 'pecador', 'transgressao', 'iniquidade'],
  },
  {
    id: 'espirito-santo',
    label: 'Espírito Santo',
    keywords: ['espirito santo', 'espirito', 'consolador', 'pentecostes', 'dons', 'uncao', 'ungido', 'poder do alto'],
  },
  {
    id: 'discipulado',
    label: 'Discipulado',
    keywords: ['discipulo', 'discipulos', 'discipulado', 'seguir', 'chamado', 'vocacao', 'renuncia', 'tomar a cruz'],
  },
  {
    id: 'lideranca',
    label: 'Liderança',
    keywords: ['lideranca', 'lider', 'lideres', 'pastor', 'pastores', 'pastorear', 'autoridade', 'servo lider', 'governo'],
  },
  {
    id: 'financas',
    label: 'Finanças',
    keywords: ['dinheiro', 'dizimo', 'dizimos', 'oferta', 'ofertas', 'prosperidade', 'riqueza', 'riquezas', 'tesouro', 'provisao', 'sustento'],
  },
  {
    id: 'sabedoria',
    label: 'Sabedoria',
    keywords: ['sabedoria', 'sabio', 'sabios', 'prudencia', 'prudente', 'discernimento', 'entendimento', 'conselho'],
  },
  {
    id: 'justica',
    label: 'Justiça',
    keywords: ['justica', 'justo', 'justos', 'juizo', 'julgar', 'opressao', 'oprimido', 'injustica', 'direito'],
  },
  {
    id: 'paz',
    label: 'Paz',
    keywords: ['paz', 'tranquilidade', 'descanso', 'repouso', 'sossego', 'calma'],
  },
  {
    id: 'alegria',
    label: 'Alegria',
    keywords: ['alegria', 'alegre', 'alegrar', 'gozo', 'jubilo', 'festa', 'regozijo'],
  },
  {
    id: 'ressurreicao',
    label: 'Ressurreição',
    keywords: ['ressurreicao', 'ressuscitou', 'ressuscitar', 'vida eterna', 'eternidade', 'morte', 'sepulcro', 'tumulo'],
  },
  {
    id: 'segunda-vinda',
    label: 'Segunda vinda',
    keywords: ['segunda vinda', 'volta de cristo', 'volta de jesus', 'arrebatamento', 'fim dos tempos', 'ultimos dias', 'vitoria final'],
  },
  {
    id: 'igreja',
    label: 'Igreja',
    keywords: ['igreja', 'igrejas', 'corpo de cristo', 'comunhao', 'assembleia', 'congregacao', 'membros', 'comunidade'],
  },
  {
    id: 'obediencia',
    label: 'Obediência',
    keywords: ['obediencia', 'obedecer', 'obediente', 'mandamento', 'mandamentos', 'ordenanca', 'ordenancas', 'submissao'],
  },
  {
    id: 'gratidao',
    label: 'Gratidão',
    keywords: ['gratidao', 'grato', 'gratos', 'agradecer', 'agradecido', 'acao de gracas', 'reconhecimento'],
  },
  {
    id: 'perdao',
    label: 'Perdão',
    keywords: ['perdao', 'perdoar', 'perdoado', 'perdoa', 'reconciliacao', 'reconciliar', 'ofensa', 'ofendido'],
  },
  {
    id: 'humildade',
    label: 'Humildade',
    keywords: ['humildade', 'humilde', 'humildes', 'orgulho', 'soberba', 'arrogante', 'mansidao', 'manso'],
  },
  {
    id: 'evangelismo',
    label: 'Evangelismo',
    keywords: ['evangelismo', 'testemunho', 'testemunhar', 'pregar', 'pregacao', 'converter', 'ganhar almas', 'almas'],
  },
  {
    id: 'providencia',
    label: 'Providência',
    keywords: ['providencia', 'prover', 'provido', 'sustento', 'milagre', 'milagres', 'sobrenatural', 'impossivel'],
  },
  {
    id: 'identidade',
    label: 'Identidade',
    keywords: ['identidade', 'quem sou', 'filho de deus', 'filhos de deus', 'imagem de deus', 'valor', 'proposito', 'chamado'],
  },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export const TAGS = TOPICS.map((t) => ({ id: t.id, label: t.label }));
