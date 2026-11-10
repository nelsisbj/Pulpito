import crypto from 'node:crypto';
import { DB_FILE } from './config.js';
import { ensureDir, readJson, writeJsonAtomic } from './lib/fsx.js';
import { sanitizeHtml } from './lib/html.js';
import { DEFAULT_WPM, sermonMetrics } from './services/timing.js';
import { tagsForSermon } from './services/tags.js';
import { formatReference } from '../../shared/references.js';

const now = () => new Date().toISOString();

function defaultSettings() {
  return {
    theme: 'light',
    fontFamily: 'serif',
    fontSize: 19,
    lineHeight: 1.8,
    wide: false,
    translation: 'ARA',
    compareTranslations: ['ARA', 'NAA', 'NTLH'],
    musicVolume: 0.35,
    focusByDefault: false,
  };
}

function defaultProfile() {
  return {
    name: 'Pregador',
    wpm: DEFAULT_WPM,
    calibration: null,
    settings: defaultSettings(),
    createdAt: now(),
  };
}

function blankState() {
  return { version: 1, profile: defaultProfile(), sermons: [], notes: {} };
}

let state = null;
let queue = Promise.resolve();

export async function initDb() {
  if (state) return state;
  await ensureDir(DB_FILE.replace(/[\\/][^\\/]+$/, ''));
  const loaded = await readJson(DB_FILE, null);
  state = loaded && typeof loaded === 'object' ? { ...blankState(), ...loaded } : blankState();
  state.profile = { ...defaultProfile(), ...(state.profile || {}) };
  state.profile.settings = { ...defaultSettings(), ...(state.profile.settings || {}) };
  if (!Array.isArray(state.sermons)) state.sermons = [];
  if (!state.notes || typeof state.notes !== 'object') state.notes = {};
  return state;
}

export function db() {
  return state;
}

export async function persist() {
  await writeJsonAtomic(DB_FILE, state);
}

/** Executa uma mutação serializada e persiste. */
export function update(mutator) {
  queue = queue.then(async () => {
    const result = await mutator(state);
    await persist();
    return result;
  });
  return queue;
}

export function newId(prefix = 's') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function sanitizeSermonInput(input = {}) {
  const rawSections = input && typeof input.sections === 'object' && input.sections !== null ? input.sections : input || {};
  const intro = rawSections.introduction?.html ?? rawSections.introduction ?? '';
  const conclusion = rawSections.conclusion?.html ?? rawSections.conclusion ?? '';
  const devs = Array.isArray(rawSections.developments) ? rawSections.developments : [];
  const developments = devs.slice(0, 40).map((dev, index) => ({
    id: typeof dev?.id === 'string' && dev.id ? dev.id : newId('dev'),
    title: String(dev?.title ?? `Ponto ${index + 1}`).slice(0, 140),
    html: sanitizeHtml(typeof dev?.html === 'string' ? dev.html : ''),
  }));
  if (!developments.length) {
    developments.push({ id: newId('dev'), title: 'Ponto 1', html: '' });
  }
  return {
    introduction: { html: sanitizeHtml(String(intro)) },
    developments,
    conclusion: { html: sanitizeHtml(String(conclusion)) },
  };
}

export function publicSermon(sermon, profile = state?.profile) {
  const metrics = sermonMetrics(sermon, profile?.wpm ?? DEFAULT_WPM);
  return {
    ...sermon,
    metrics: {
      words: metrics.words,
      minutes: metrics.minutes,
      rawMinutes: metrics.rawMinutes,
      sections: metrics.sections,
    },
  };
}

export async function createSermon(input = {}) {
  const sections = sanitizeSermonInput(input.sections);
  const sermon = {
    id: newId(),
    title: String(input.title || 'Sermão sem título').slice(0, 180),
    theme: String(input.theme || '').slice(0, 180),
    mainVerse: input.mainVerse ? formatReference(input.mainVerse) : '',
    sections,
    tags: [],
    notes: '',
    createdAt: now(),
    updatedAt: now(),
    lastOpenedAt: now(),
  };
  sermon.tags = tagsForSermon(sermon).map((t) => t.label);
  await update((s) => {
    s.sermons.unshift(sermon);
  });
  return sermon;
}

export function getSermon(id) {
  return state?.sermons.find((s) => s.id === id) || null;
}

export function findSermonByShareToken(token) {
  if (!token) return null;
  return state?.sermons.find((sermon) => sermon.share?.token === token) || null;
}

export async function patchSermon(id, patch = {}) {
  const sermon = getSermon(id);
  if (!sermon) return null;
  if (typeof patch.title === 'string') sermon.title = patch.title.slice(0, 180) || 'Sermão sem título';
  if (typeof patch.theme === 'string') sermon.theme = patch.theme.slice(0, 180);
  if (typeof patch.mainVerse === 'string') sermon.mainVerse = patch.mainVerse.slice(0, 80);
  if (patch.sections) sermon.sections = sanitizeSermonInput(patch.sections);
  if (Array.isArray(patch.tags)) {
    sermon.tags = patch.tags
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 12);
  } else if (patch.sections || patch.title || patch.theme) {
    sermon.tags = tagsForSermon(sermon).map((t) => t.label);
  }
  sermon.updatedAt = now();
  await update(() => {});
  return sermon;
}

export async function deleteSermon(id) {
  let removed = false;
  await update((s) => {
    const before = s.sermons.length;
    s.sermons = s.sermons.filter((item) => item.id !== id);
    removed = s.sermons.length < before;
  });
  return removed;
}

export function allSermons() {
  return [...(state?.sermons || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function patchProfile(patch = {}) {
  const profile = state.profile;
  if (typeof patch.name === 'string' && patch.name.trim()) profile.name = patch.name.trim().slice(0, 80);
  if (patch.wpm != null) {
    const wpm = Number(patch.wpm);
    if (Number.isFinite(wpm) && wpm >= 40 && wpm <= 400) profile.wpm = Math.round(wpm * 10) / 10;
  }
  if (patch.calibration && typeof patch.calibration === 'object') {
    profile.calibration = {
      words: Number(patch.calibration.words) || 0,
      seconds: Number(patch.calibration.seconds) || 0,
      wpm: Number(patch.calibration.wpm) || profile.wpm,
      at: now(),
    };
  }
  if (patch.settings && typeof patch.settings === 'object') {
    profile.settings = { ...profile.settings, ...patch.settings };
  }
  await update(() => {});
  return profile;
}

export function getStats() {
  const sermons = allSermons();
  const tagCounts = new Map();
  let words = 0;
  let minutes = 0;
  for (const sermon of sermons) {
    const metrics = sermonMetrics(sermon, state.profile.wpm);
    words += metrics.words;
    minutes += metrics.minutes;
    for (const tag of sermon.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, 10);
  return {
    totalSermons: sermons.length,
    totalWords: words,
    totalMinutes: Math.round(minutes),
    averageMinutes: sermons.length ? Math.round((minutes / sermons.length) * 10) / 10 : 0,
    topTags,
    wpm: state.profile.wpm,
    recent: sermons.slice(0, 6).map((s) => ({
      id: s.id,
      title: s.title,
      theme: s.theme,
      updatedAt: s.updatedAt,
      minutes: sermonMetrics(s, state.profile.wpm).minutes,
      tags: s.tags,
    })),
  };
}

export function getNote(ref) {
  const note = state.notes[ref];
  return note ? { ...note, ref } : { ref, text: '', updatedAt: null };
}

export async function putNote(ref, text) {
  const clean = sanitizeHtml(String(text || ''));
  const note = { text: clean, updatedAt: now() };
  if (!clean || !clean.replace(/<[^>]+>/g, '').trim()) {
    delete state.notes[ref];
  } else {
    state.notes[ref] = note;
  }
  await update(() => {});
  return { ref, ...note };
}

export function allNotes() {
  return Object.entries(state.notes).map(([ref, note]) => ({ ref, ...note }));
}
