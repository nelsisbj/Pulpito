export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Sem conexão com o servidor do Púlpito.', { code: 'offline' });
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(data?.error || `Erro ${response.status}`, {
      status: response.status,
      code: data?.code || 'error',
    });
  }
  return data;
}

const qs = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
};

export const api = {
  health: () => request('/health'),

  versions: () => request('/bible/versions'),
  books: () => request('/bible/books'),
  chapter: (translation, book, chapter) => request(`/bible/chapter${qs({ translation, book, chapter })}`),
  verse: (ref, translation) => request(`/bible/verse${qs({ ref, translation })}`),
  compare: (ref, translations) => request('/bible/compare', { method: 'POST', body: { ref, translations } }),
  searchBible: (q, translation) => request(`/bible/search${qs({ q, translation })}`),
  suggest: (q, translation, signal) => request(`/bible/suggest${qs({ q, translation })}`, { signal }),
  randomVerse: (translation) => request(`/bible/random${qs({ translation })}`),

  studyReference: (ref, translation) => request(`/study/reference${qs({ ref, translation })}`),
  crossrefs: (ref) => request(`/study/crossrefs${qs({ ref })}`),
  commentary: (ref, translation) => request(`/study/commentary${qs({ ref, translation })}`),
  strong: (id) => request(`/study/strongs/${encodeURIComponent(id)}`),
  strongSearch: (q) => request(`/study/strongs/search${qs({ q })}`),
  popularStrong: () => request('/study/strongs/popular'),
  notes: () => request('/study/notes'),
  saveNote: (ref, text) => request('/study/notes', { method: 'PUT', body: { ref, text } }),
  tags: () => request('/study/tags'),

  listSermons: () => request('/sermons'),
  getSermon: (id) => request(`/sermons/${id}`),
  createSermon: (data) => request('/sermons', { method: 'POST', body: data }),
  updateSermon: (id, data) => request(`/sermons/${id}`, { method: 'PUT', body: data }),
  deleteSermon: (id) => request(`/sermons/${id}`, { method: 'DELETE' }),
  duplicateSermon: (id) => request(`/sermons/${id}/duplicate`, { method: 'POST' }),
  stats: () => request('/sermons/stats'),
  analyze: (text, title, theme) => request('/sermons/analyze', { method: 'POST', body: { text, title, theme } }),
  getShare: (id) => request(`/sermons/${id}/share`),
  createShare: (id) => request(`/sermons/${id}/share`, { method: 'POST' }),
  revokeShare: (id) => request(`/sermons/${id}/share`, { method: 'DELETE' }),
  network: () => request('/network'),

  profile: () => request('/profile'),
  saveProfile: (data) => request('/profile', { method: 'PUT', body: data }),
  calibrate: (seconds, words) => request('/profile/calibration', { method: 'POST', body: { seconds, words } }),

  musicFeatured: () => request('/music/featured'),
  musicStatus: () => request('/music/status'),
  musicSearch: (q, provider) => request(`/music/search${qs({ q, provider })}`),
};
