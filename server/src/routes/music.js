import express from 'express';
import { asyncHandler } from '../lib/http.js';
import { FEATURED, musicStatus, spotifySearch, youtubeSearch } from '../services/music.js';

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json({ configured: musicStatus() });
});

router.get('/featured', (_req, res) => {
  res.json({ featured: FEATURED });
});

router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const provider = String(req.query.provider || 'youtube');
  if (q.length < 2) return res.json({ results: [], configured: musicStatus() });
  if (provider === 'spotify') {
    if (!musicStatus().spotify) {
      return res.json({ results: [], configured: musicStatus(), hint: 'Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET para buscar.' });
    }
    const results = await spotifySearch(q);
    return res.json({ results, configured: musicStatus() });
  }
  if (!musicStatus().youtube) {
    return res.json({ results: [], configured: musicStatus(), hint: 'Configure YOUTUBE_API_KEY para buscar. Você ainda pode colar um link.' });
  }
  const results = await youtubeSearch(q);
  res.json({ results, configured: musicStatus() });
}));

export default router;
