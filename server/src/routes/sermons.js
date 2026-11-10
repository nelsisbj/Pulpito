import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// Aplica o middleware de autenticação em todas as rotas
router.use(authenticateToken);

// Extrai com segurança o ID do utilizador vindo do JWT
function getUserId(req) {
  return req.user?.id || req.user?.userId || req.user?.sub || null;
}

// Converte objetos da base de dados (JSON/JSONB) para Strings puras que o React entende
function normalizeSermon(row) {
  if (!row) return null;

  let content = row.content;

  // Se o Postgres devolveu um objeto JS (devido ao tipo de coluna JSONB)
  if (typeof content === 'object' && content !== null) {
    content = content.text !== undefined ? content.text : (Object.keys(content).length === 0 ? '' : JSON.stringify(content));
  } else if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null && parsed.text !== undefined) {
        content = parsed.text;
      } else if (content === '{}' || content === '[]') {
        content = '';
      }
    } catch {
      // É uma string normal, mantém como está
    }
  }

  if (content === null || content === undefined) {
    content = '';
  }

  return {
    ...row,
    id: String(row.id),
    user_id: String(row.user_id || ''),
    title: row.title || 'Sem título',
    theme: row.theme || '', // Evita erro no Editor caso theme esteja ausente
    content: String(content),
    updated_at: row.updated_at || new Date().toISOString(),
    created_at: row.created_at || new Date().toISOString(),
  };
}

// 1. ROTAS ESPECÍFICAS (Devem ficar antes de /:id)

// GET /api/sermons/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const result = await pool.query(
      `SELECT 
        COUNT(*)::int as total,
        COALESCE(SUM(LENGTH(content::text)), 0)::int as total_words
       FROM sermons WHERE user_id = $1`,
      [userId]
    );
    res.json(result.rows[0] || { total: 0, total_words: 0 });
  } catch (err) {
    console.error('[stats error]', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
});

// POST /api/sermons/analyze
router.post('/analyze', async (req, res) => {
  res.json({ success: true });
});

// 2. ROTAS GERAIS E DINÂMICAS

// GET /api/sermons (Listar todos os sermões)
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const result = await pool.query(
      'SELECT * FROM sermons WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    const sermons = (result.rows || []).map(normalizeSermon);
    res.json({ sermons });
  } catch (err) {
    console.error('[sermons list error]', err);
    res.status(500).json({ error: 'Erro ao listar sermões.' });
  }
});

// GET /api/sermons/:id (Buscar sermão por UUID)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const result = await pool.query(
      'SELECT * FROM sermons WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Sermão não encontrado.' });
    }
    res.json(normalizeSermon(result.rows[0]));
  } catch (err) {
    console.error('[sermon get by id error]', err);
    res.status(500).json({ error: 'Erro ao procurar o sermão.' });
  }
});

// POST /api/sermons (Criar novo sermão)
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const { title, content } = req.body || {};
    const id = crypto.randomUUID();
    
    // Grava como JSON válido ({ "text": "conteudo" }) para o Postgres aceitar sem reclamar
    const jsonContent = JSON.stringify({ text: content || '' });

    const result = await pool.query(
      `INSERT INTO sermons (id, user_id, title, content, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id, userId, title || 'Sem título', jsonContent]
    );

    res.status(201).json(normalizeSermon(result.rows[0]));
  } catch (err) {
    console.error('[sermon create error]', err);
    res.status(500).json({ error: `Erro ao criar sermão: ${err.message}` });
  }
});

// PUT /api/sermons/:id (Atualizar sermão existente)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const { title, content } = req.body || {};
    const jsonContent = JSON.stringify({ text: content || '' });

    const result = await pool.query(
      'UPDATE sermons SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *',
      [title || 'Sem título', jsonContent, id, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Sermão não encontrado.' });
    }
    res.json(normalizeSermon(result.rows[0]));
  } catch (err) {
    console.error('[sermon update error]', err);
    res.status(500).json({ error: 'Erro ao atualizar sermão.' });
  }
});

// DELETE /api/sermons/:id (Apagar sermão)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const result = await pool.query(
      'DELETE FROM sermons WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Sermão não encontrado.' });
    }
    res.json({ success: true, id });
  } catch (err) {
    console.error('[sermon delete error]', err);
    res.status(500).json({ error: 'Erro ao excluir sermão.' });
  }
});

export default router;