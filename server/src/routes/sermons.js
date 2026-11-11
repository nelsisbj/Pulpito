import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticateToken);

function getUserId(req) {
  return req.user?.id || req.user?.userId || req.user?.sub || null;
}

// Normaliza os dados do banco para o formato esperado pelo Editor.jsx
function normalizeSermon(row) {
  if (!row) return null;

  let parsedContent = {};
  if (typeof row.content === 'object' && row.content !== null) {
    parsedContent = row.content;
  } else if (typeof row.content === 'string' && row.content.trim()) {
    try {
      parsedContent = JSON.parse(row.content);
    } catch {
      parsedContent = { text: row.content };
    }
  }

  const sections = parsedContent.sections || (parsedContent.introduction ? parsedContent : null);
  const theme = row.theme || parsedContent.theme || '';
  const tags = Array.isArray(row.tags) ? row.tags : (Array.isArray(parsedContent.tags) ? parsedContent.tags : []);

  return {
    ...row,
    id: String(row.id),
    user_id: String(row.user_id || ''),
    title: row.title || 'Sem título',
    theme: theme,
    tags: tags,
    sections: sections || {
      introduction: { html: parsedContent.text || '' },
      developments: [{ id: 'dev_1', title: 'Ponto 1', html: '' }],
      conclusion: { html: '' },
    },
    content: typeof row.content === 'string' ? row.content : JSON.stringify(row.content || {}),
    updated_at: row.updated_at || new Date().toISOString(),
    created_at: row.created_at || new Date().toISOString(),
  };
}

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
  res.json({ success: true, tags: [] });
});

// GET /api/sermons (Listar todos)
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

// GET /api/sermons/:id (Buscar por UUID)
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

// POST /api/sermons (Criar sermão)
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const { title, theme, sections, tags, content } = req.body || {};
    const id = crypto.randomUUID();

    const jsonContent = JSON.stringify({
      sections: sections || { introduction: { html: content || '' }, developments: [{ id: 'dev_1', title: 'Ponto 1', html: '' }], conclusion: { html: '' } },
      theme: theme || '',
      tags: tags || [],
    });

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

// PUT /api/sermons/:id (Atualizar sermão)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const { title, theme, sections, tags, content } = req.body || {};

    const jsonContent = JSON.stringify({
      sections: sections || { introduction: { html: content || '' }, developments: [{ id: 'dev_1', title: 'Ponto 1', html: '' }], conclusion: { html: '' } },
      theme: theme || '',
      tags: tags || [],
    });

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

// DELETE /api/sermons/:id (Excluir sermão)
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