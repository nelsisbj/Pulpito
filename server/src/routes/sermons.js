import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Exige autenticação para todas as rotas de sermões
router.use(requireAuth);

// Listar sermões do utilizador logado
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sermons WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[sermons get error]', err);
    res.status(500).json({ error: 'Erro ao procurar sermões.' });
  }
});

// Obter um sermão específico pelo ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM sermons WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sermão não encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[sermon get by id error]', err);
    res.status(500).json({ error: 'Erro ao procurar o sermão.' });
  }
});

// Criar um novo sermão
router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body;
    const result = await pool.query(
      'INSERT INTO sermons (user_id, title, content) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, title || 'Sem título', JSON.stringify(content || {})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[sermon post error]', err);
    res.status(500).json({ error: 'Erro ao criar sermão.' });
  }
});

// Atualizar sermão
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const result = await pool.query(
      'UPDATE sermons SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *',
      [title, JSON.stringify(content || {}), id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sermão não encontrado ou sem permissão.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[sermon put error]', err);
    res.status(500).json({ error: 'Erro ao atualizar sermão.' });
  }
});

// Eliminar sermão
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM sermons WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sermão não encontrado.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[sermon delete error]', err);
    res.status(500).json({ error: 'Erro ao apagar sermão.' });
  }
});

export default router;