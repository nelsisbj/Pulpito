import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

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

    const bodyText = typeof sermon.content === 'object' 
      ? (sermon.content.html || sermon.content.text || JSON.stringify(sermon.content)) 
      : sermon.content;

    res.type('html').send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${sermon.title} · Púlpito</title>
          <style>
            body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #211d17; background: #faf7f2; }
            h1 { font-size: 2.2rem; border-bottom: 1px solid #e2ddd5; padding-bottom: 12px; margin-bottom: 8px; }
            .meta { font-size: 0.85rem; color: #777; margin-bottom: 30px; font-family: sans-serif; }
            .content { font-size: 1.1rem; line-height: 1.8; }
          </style>
        </head>
        <body>
          <h1>${sermon.title}</h1>
          <div class="meta">Sermão compartilhado via Púlpito</div>
          <div class="content">${bodyText}</div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[share page error]', err);
    res.status(500).send('Erro interno ao exibir o sermão.');
  }
}

export default router;