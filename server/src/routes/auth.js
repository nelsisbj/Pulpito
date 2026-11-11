import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { pool } from '../db.js';

const router = express.Router();

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, profile) VALUES ($1, $2, $3) RETURNING id, email, profile',
      [email.toLowerCase().trim(), hash, JSON.stringify({ name: String(name || '').trim() })]
    );

    const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'E-mail já cadastrado.' });
    console.error('[auth error]', err);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[login error]', err);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

export default router;