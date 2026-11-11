import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from './auth.js';
import { parseReference } from '../../../shared/references.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { crossReferences } from '../providers/crossrefs.js';
import { getStudyNotes, getTranslationNotes } from '../providers/commentary.js';
import { getVerse, lookupStrong, searchStrong } from '../providers/bolls.js';

const router = express.Router();

// Exige autenticação para as rotas de estudo
router.use(requireAuth);

const POPULAR_STRONG = [
  { id: 'G26', label: 'Amor' },
  { id: 'G4102', label: 'Fé' },
  { id: 'G5485', label: 'Graça' },
  { id: 'G165', label: 'Eternidade' },
  { id: 'G3056', label: 'Palavra' },
  { id: 'G4991', label: 'Salvação' },
  { id: 'G1343', label: 'Justiça' },
  { id: 'G1515', label: 'Paz' },
  { id: 'G1680', label: 'Esperança' },
  { id: 'H430', label: 'Deus' },
  { id: 'H2617', label: 'Misericórdia' },
  { id: 'H7965', label: 'Paz' },
];

router.get('/reference', asyncHandler(async (req, res) => {
  const rawRef = String(req.query.ref || '');
  const ref = parseReference(rawRef);
  if (!ref) throw new HttpError('Referência bíblica inválida.', 400, 'invalid_reference');
  const translation = String(req.query.translation || 'ARA');
  const [verse, crossrefs, studyNotes, notes, userNoteResult] = await Promise.all([
    getVerse(ref, translation),
    crossReferences(ref),
    getStudyNotes(ref),
    getTranslationNotes(ref, translation),
    pool.query('SELECT content FROM study_notes WHERE user_id = $1 AND key = $2', [req.userId, rawRef]),
  ]);
  res.json({
    ref: rawRef,
    verse,
    crossrefs,
    studyNotes,
    notes,
    userNote: userNoteResult.rows[0]?.content || null,
  });
}));

router.get('/strong/popular', (_req, res) => {
  res.json({ strongs: POPULAR_STRONG });
});

router.get('/strong/search', asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.json({ results: [] });
  res.json({ results: await searchStrong(query) });
}));

router.get('/strong/:id', asyncHandler(async (req, res) => {
  res.json(await lookupStrong(req.params.id));
}));

// Listar todas as notas do usuário logado
router.get('/notes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_notes WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[study notes get error]', err);
    res.status(500).json({ error: 'Erro ao buscar notas de estudo.' });
  }
});

// Buscar uma nota específica por chave (ex: referência bíblica)
router.get('/notes/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query(
      'SELECT * FROM study_notes WHERE user_id = $1 AND key = $2',
      [req.userId, key]
    );
    res.json(result.rows[0]?.content || null);
  } catch (err) {
    console.error('[study note get error]', err);
    res.status(500).json({ error: 'Erro ao buscar nota de estudo.' });
  }
});

// Salvar ou atualizar uma nota de estudo (UPSERT)
router.put('/notes/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const content = req.body;
    const result = await pool.query(
      `INSERT INTO study_notes (user_id, key, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key)
       DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
       RETURNING *`,
      [req.userId, key, JSON.stringify(typeof content === 'string' ? { text: content } : content || {})]
    );
    res.json(result.rows[0].content);
  } catch (err) {
    console.error('[study note put error]', err);
    res.status(500).json({ error: 'Erro ao salvar nota de estudo.' });
  }
});

export default router;