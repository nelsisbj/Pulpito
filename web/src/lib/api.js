const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('pulpito_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Erro na requisição.');
    error.status = response.status;
    throw error;
  }

  return data;
}

// AUTENTICAÇÃO
export async function login(email, password) {
  try {
    return await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    if (err.status === 404) {
      return await request('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    }
    throw err;
  }
}

export async function register(name, email, password) {
  try {
    return await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  } catch (err) {
    if (err.status === 404) {
      return await request('/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
    }
    throw err;
  }
}

export async function profile() {
  return request('/profile').catch(() => request('/auth/me')).catch(() => ({ profile: {} }));
}

export async function saveProfile(patch) {
  return request('/profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

// SERMÕES
export async function listSermons() {
  return request('/sermons');
}

export async function getSermon(id) {
  return request(`/sermons/${id}`);
}

export async function createSermon(data) {
  return request('/sermons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSermon(id, data) {
  return request(`/sermons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSermon(id) {
  return request(`/sermons/${id}`, {
    method: 'DELETE',
  });
}

export async function stats() {
  return request('/sermons/stats');
}

export async function analyze(text, title, theme) {
  return request('/sermons/analyze', {
    method: 'POST',
    body: JSON.stringify({ text, title, theme }),
  });
}

// BÍBLIA & AUTOCOMPLETE
export async function chapter(bookOrOpts, chapterNum, translation) {
  let b = bookOrOpts;
  let c = chapterNum;
  let t = translation || 'ARA';

  if (typeof bookOrOpts === 'object' && bookOrOpts !== null) {
    b = bookOrOpts.book || bookOrOpts.b;
    c = bookOrOpts.chapter || bookOrOpts.c;
    t = bookOrOpts.version || bookOrOpts.translation || bookOrOpts.t || 'ARA';
  }

  const query = new URLSearchParams({ book: b || '', chapter: String(c || ''), version: t, t }).toString();
  try {
    return await request(`/bible/chapter?${query}`);
  } catch (err) {
    if (err.status === 404) {
      return await request(`/bible/${encodeURIComponent(b)}/${encodeURIComponent(c)}?t=${encodeURIComponent(t)}`);
    }
    throw err;
  }
}

export async function search(queryStr, translation) {
  return request(`/bible/search?q=${encodeURIComponent(queryStr)}&t=${encodeURIComponent(translation || 'ARA')}`);
}

export async function verse(ref, translation) {
  return request(`/bible/verse?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(translation || 'ARA')}`);
}

export async function compare(ref, versionsList) {
  return request(`/bible/compare?ref=${encodeURIComponent(ref)}&v=${encodeURIComponent(versionsList || '')}`);
}

export async function suggest(candidate, translation, signal) {
  return request(`/bible/suggest?q=${encodeURIComponent(candidate)}&t=${encodeURIComponent(translation)}`, { signal });
}

export async function versions() {
  return request('/versions').catch(() => request('/bible/versions'));
}

// ESTUDO
export async function study(ref, translation) {
  return request(`/study?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(translation || 'ARA')}`)
    .catch(() => request(`/study/${encodeURIComponent(ref)}`));
}

// MÚSICA
export async function musicFeatured() {
  return request('/music/featured');
}

export async function musicStatus() {
  return request('/music/status');
}

export const api = {
  login,
  register,
  profile,
  saveProfile,
  listSermons,
  getSermon,
  createSermon,
  updateSermon,
  deleteSermon,
  stats,
  analyze,
  chapter,
  search,
  verse,
  compare,
  suggest,
  versions,
  study,
  musicFeatured,
  musicStatus,
};

export default api;