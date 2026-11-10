import express from 'express';
import { asyncHandler, HttpError } from '../lib/http.js';
import { db, patchProfile } from '../db.js';
import { MINISTRY_READING } from '../data/reading-sample.js';
import { countWords } from '../lib/html.js';
import { calculateWpm } from '../services/timing.js';
import { musicStatus } from '../services/music.js';

const router = express.Router();
const SAMPLE_WORDS = countWords(MINISTRY_READING);

router.get('/', (_req, res) => {
  res.json({
    profile: db().profile,
    sample: { text: MINISTRY_READING, words: SAMPLE_WORDS },
    music: musicStatus(),
  });
});

router.put('/', asyncHandler(async (req, res) => {
  const profile = await patchProfile(req.body || {});
  res.json({ profile });
}));

router.post('/calibration', asyncHandler(async (req, res) => {
  const seconds = Number(req.body?.seconds);
  const words = Number(req.body?.words) || SAMPLE_WORDS;
  const wpm = calculateWpm({ words, seconds });
  if (!wpm) throw new HttpError('A leitura precisa durar pelo menos 10 segundos.', 400, 'invalid_calibration');
  const profile = await patchProfile({
    wpm,
    calibration: { words, seconds, wpm },
  });
  res.json({ wpm, profile, sampleWords: words });
}));

export default router;
