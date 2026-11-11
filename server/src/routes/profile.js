import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from './auth.js';
import { calculateWpm } from '../services/timing.js';

const router = express.Router();
router.use(requireAuth);

const SAMPLE_TEXT = 'A esperança não nasce da ausência de dificuldades, mas da confiança de que Deus permanece conosco em cada caminho. Quando a manhã parece distante, ainda podemos dar o próximo passo, cuidar de quem está ao nosso lado e lembrar as promessas que nos sustentam. A fé não elimina as perguntas; ela nos ajuda a atravessá-las com humildade, coragem e amor. Que nossas palavras ofereçam consolo, que nossas escolhas revelem justiça e que a comunidade seja abrigo para quem está cansado. Em todo tempo, há espaço para recomeçar, aprender e servir com alegria.';

function profileFromRow(row) {
  const profile = row?.profile && typeof row.profile === 'object' ? row.profile : {};
  return {
    name: profile.name || 'Pregador',
    wpm: Number(profile.wpm) || 150,
    settings: profile.settings && typeof profile.settings === 'object' ? profile.settings : {},
    email: row?.email || '',
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, profile, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Perfil não encontrado.' });
    res.json({
      profile: profileFromRow(result.rows[0]),
      sample: { text: SAMPLE_TEXT, words: SAMPLE_TEXT.split(/\s+/).length },
    });
  } catch (err) {
    console.error('[profile get error]', err);
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
});

router.put('/', async (req, res) => {
  const patch = req.body && typeof req.body === 'object' ? req.body : {};
  if (patch.wpm != null && (!Number.isFinite(Number(patch.wpm)) || Number(patch.wpm) < 40 || Number(patch.wpm) > 400)) {
    return res.status(400).json({ error: 'O ritmo deve ficar entre 40 e 400 palavras por minuto.' });
  }
  try {
    const result = await pool.query(
      `UPDATE users
       SET profile = COALESCE(profile, '{}'::jsonb) || ($1::jsonb - 'settings') ||
         jsonb_build_object('settings', COALESCE(profile->'settings', '{}'::jsonb) || COALESCE($1::jsonb->'settings', '{}'::jsonb))
       WHERE id = $2
       RETURNING email, profile`,
      [JSON.stringify(patch), req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Perfil não encontrado.' });
    res.json({ profile: profileFromRow(result.rows[0]) });
  } catch (err) {
    console.error('[profile update error]', err);
    res.status(500).json({ error: 'Erro ao salvar perfil.' });
  }
});

router.post('/calibrate', async (req, res) => {
  const wpm = calculateWpm({ words: req.body?.words, seconds: req.body?.seconds });
  if (!wpm || wpm < 40 || wpm > 400) {
    return res.status(400).json({ error: 'Não foi possível calcular um ritmo válido.' });
  }
  try {
    const result = await pool.query(
      `UPDATE users SET profile = COALESCE(profile, '{}'::jsonb) || jsonb_build_object('wpm', $1)
       WHERE id = $2 RETURNING email, profile`,
      [wpm, req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Perfil não encontrado.' });
    res.json({ wpm, profile: profileFromRow(result.rows[0]) });
  } catch (err) {
    console.error('[profile calibration error]', err);
    res.status(500).json({ error: 'Erro ao salvar o ritmo de leitura.' });
  }
});

export default router;