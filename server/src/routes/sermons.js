import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import { sermonMetrics } from '../services/timing.js';
import { renderPrintHtml, renderSermonPdf, schedulePdfBackup } from '../services/pdf.js';

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
  const updatedAt = row.updated_at || new Date().toISOString();
  const createdAt = row.created_at || updatedAt;
  const normalizedSections = sections || {
    introduction: { html: parsedContent.text || '' },
    developments: [{ id: 'dev_1', title: 'Ponto 1', html: '' }],
    conclusion: { html: '' },
  };

  return {
    ...row,
    id: String(row.id),
    user_id: String(row.user_id || ''),
    title: row.title || 'Sem título',
    theme: theme,
    tags: tags,
    pdf: parsedContent.pdf || (parsedContent.pdfPath ? { generatedAt: row.updated_at } : null),
    sections: normalizedSections,
    metrics: sermonMetrics({ sections: normalizedSections }),
    content: typeof row.content === 'string' ? row.content : JSON.stringify(row.content || {}),
    updated_at: updatedAt,
    created_at: createdAt,
    updatedAt,
    createdAt,
  };
}

// GET /api/sermons/stats
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });

    const result = await pool.query('SELECT * FROM sermons WHERE user_id = $1', [userId]);
    const sermons = result.rows.map(normalizeSermon);
    const metrics = sermons.map((sermon) => sermonMetrics(sermon));
    const totalMinutes = metrics.reduce((sum, item) => sum + item.minutes, 0);
    const tagCounts = new Map();
    for (const sermon of sermons) {
      for (const tag of sermon.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    const topTags = [...tagCounts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    res.json({
      total: sermons.length,
      totalSermons: sermons.length,
      total_words: metrics.reduce((sum, item) => sum + item.words, 0),
      totalMinutes,
      averageMinutes: sermons.length ? totalMinutes / sermons.length : 0,
      topTags,
    });
  } catch (err) {
    console.error('[stats error]', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
});

// POST /api/sermons/analyze
router.post('/analyze', async (req, res) => {
  const { detectTags } = await import('../services/tags.js');
  const text = String(req.body?.text || '');
  const tags = detectTags(text, { title: req.body?.title || '', theme: req.body?.theme || '' });
  res.json({ success: true, tags });
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

router.get('/:id/backup', async (req, res) => {
  try {
    const sermon = await ownedSermon(req.params.id, getUserId(req));
    if (!sermon) return res.status(404).json({ error: 'Sermão não encontrado.' });
    res.setHeader('Content-Disposition', `attachment; filename="sermon-${req.params.id}-backup.json"`);
    res.json(normalizeSermon(sermon));
  } catch (err) {
    console.error('[sermon backup error]', err);
    res.status(500).json({ error: 'Erro ao criar o backup.' });
  }
});

router.get('/:id/print', async (req, res) => {
  try {
    const sermon = await ownedSermon(req.params.id, getUserId(req));
    if (!sermon) return res.status(404).json({ error: 'Sermão não encontrado.' });
    res.type('html').send(renderPrintHtml(normalizeSermon(sermon), { autoPrint: req.query.auto === '1' }));
  } catch (err) {
    console.error('[sermon print error]', err);
    res.status(500).json({ error: 'Erro ao preparar a impressão.' });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const sermon = await ownedSermon(req.params.id, getUserId(req));
    if (!sermon) return res.status(404).json({ error: 'Sermão não encontrado.' });
    const pdfPath = await renderSermonPdf(req.params.id, renderPrintHtml(normalizeSermon(sermon)), getUserId(req));
    res.download(pdfPath, `sermon-${req.params.id}.pdf`);
  } catch (err) {
    console.error('[sermon pdf error]', err);
    res.status(500).json({ error: 'Não foi possível gerar o PDF. Confira se o Chromium está instalado no servidor.' });
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
    const sermon = normalizeSermon(result.rows[0]);
    schedulePdfBackup(sermon, userId);
    res.json(sermon);
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
      `UPDATE sermons SET title = $1,
       content = (COALESCE(content, '{}'::jsonb) - 'sections' - 'theme' - 'tags') || $2::jsonb,
       updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *`,
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