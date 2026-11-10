import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Exige autenticação para as rotas de estudo
router.use(requireAuth);

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
      [req.userId, key, JSON.stringify(content || {})]
    );
    res.json(result.rows[0].content);
  } catch (err) {
    console.error('[study note put error]', err);
    res.status(500).json({ error: 'Erro ao salvar nota de estudo.' });
  }
});

export default router;