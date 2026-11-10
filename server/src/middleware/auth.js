import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'pulpito_secret_key_123';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    }
    req.user = user;
    next();
  });
}