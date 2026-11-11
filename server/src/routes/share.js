import express from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { renderPrintHtml } from '../services/pdf.js';

const router = express.Router();

function userId(req) {
  return req.user?.userId || req.user?.id || req.user?.sub;
}

async function ownedSermon(id, ownerId) {
  const result = await pool.query('SELECT * FROM sermons WHERE id = $1 AND user_id = $2', [id, ownerId]);
  return result.rows[0] || null;
}

router.get('/sermons/:id', authenticateToken, async (req, res) => {
  try {
    const sermon = await ownedSermon(req.params.id, userId(req));
    if (!sermon) return res.status(404).json({ error: 'Sermão não encontrado.' });
    const share = sermon.content?.share || (sermon.content?.shareToken ? { token: sermon.content.shareToken } : null);
    res.json({ share });
  } catch (err) {
    console.error('[share status error]', err);
    res.status(500).json({ error: 'Erro ao verificar o link de compartilhamento.' });
  }
});

router.post('/sermons/:id', authenticateToken, async (req, res) => {
  try {
    const sermon = await ownedSermon(req.params.id, userId(req));
    if (!sermon) return res.status(404).json({ error: 'Sermão não encontrado.' });
    const share = { token: crypto.randomBytes(24).toString('base64url'), createdAt: new Date().toISOString() };
    await pool.query(
      `UPDATE sermons SET content = jsonb_set(COALESCE(content, '{}'::jsonb), '{share}', $1::jsonb, true)
       WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(share), req.params.id, userId(req)]
    );
    res.status(201).json({ share });
  } catch (err) {
    console.error('[share create error]', err);
    res.status(500).json({ error: 'Erro ao criar o link de compartilhamento.' });
  }
});

router.delete('/sermons/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sermons SET content = COALESCE(content, '{}'::jsonb) - 'share' - 'shareToken'
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, userId(req)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Sermão não encontrado.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[share revoke error]', err);
    res.status(500).json({ error: 'Erro ao revogar o link.' });
  }
});

// Busca o sermão pelo token de compartilhamento salvo em content (JSONB)
export async function findSermonByShareToken(token) {
  const result = await pool.query(
    `SELECT * FROM sermons 
    WHERE content->>'shareToken' = $1
      OR content->'share'->>'token' = $1
     LIMIT 1`,
    [token]
  );
  return result.rows[0] || null;
}

// GET /api/share/:token (retorno via JSON)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const sermon = await findSermonByShareToken(token);
    
    if (!sermon) {
      return res.status(404).json({ error: 'Sermão não encontrado ou link expirado.' });
    }

    res.json({
      id: sermon.id,
      title: sermon.title,
      content: sermon.content,
      createdAt: sermon.created_at,
      updatedAt: sermon.updated_at,
    });
  } catch (err) {
    console.error('[share api error]', err);
    res.status(500).json({ error: 'Erro ao carregar sermão compartilhado.' });
  }
});

// Renderizador da página pública HTML (/s/:token)
export async function sharePage(req, res) {
  try {
    const { token } = req.params;
    const sermon = await findSermonByShareToken(token);

    if (!sermon) {
      return res.status(404).type('html').send(`
        <!doctype html>
        <html lang="pt-BR">
          <head><meta charset="utf-8"><title>Sermão não encontrado</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #faf7f2; color: #333;">
            <h1>Sermão não encontrado</h1>
            <p>Este link de compartilhamento é inválido ou foi removido.</p>
          </body>
        </html>
      `);
    }

    const html = renderPrintHtml({ ...sermon, ...(sermon.content || {}) });
    const toolbar = `<nav style="display:flex;justify-content:flex-end;gap:8px;margin:0 0 28px;font:14px Arial,sans-serif"><a href="/s/${encodeURIComponent(token)}/pdf" style="padding:9px 12px;color:#211d17">Baixar PDF</a><button onclick="window.print()" style="padding:9px 12px;cursor:pointer">Imprimir</button></nav>`;
    res.type('html').send(html.replace('<body>', `<body>${toolbar}`).replace('</body>', '<p class="shared-note">Sermão compartilhado via Púlpito</p></body>'));
  } catch (err) {
    console.error('[share page error]', err);
    res.status(500).send('Erro interno ao exibir o sermão.');
  }
}

export async function sharePdf(req, res) {
  try {
    const sermon = await findSermonByShareToken(req.params.token);
    if (!sermon) return res.status(404).json({ error: 'Sermão não encontrado ou link expirado.' });
    const html = renderPrintHtml({ ...sermon, ...(sermon.content || {}) });
    const pdfPath = await renderSermonPdf(sermon.id, html);
    res.download(pdfPath, `sermon-${sermon.id}.pdf`);
  } catch (err) {
    console.error('[shared sermon pdf error]', err);
    res.status(500).json({ error: 'Não foi possível gerar o PDF compartilhado.' });
  }
}

export default router;