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

async function fileRequest(endpoint) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível baixar o arquivo.');
  }
  return response;
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
  return request('/profile');
}

export async function saveProfile(patch) {
  return request('/profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function calibrate(seconds, words) {
  return request('/profile/calibrate', {
    method: 'POST',
    body: JSON.stringify({ seconds, words }),
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

export async function duplicateSermon(id) {
  const sermon = await getSermon(id);
  return createSermon({
    title: `${sermon.title || 'Sem título'} (cópia)`,
    theme: sermon.theme || '',
    sections: sermon.sections,
    tags: sermon.tags || [],
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

export async function sermonPdf(id) {
  return (await fileRequest(`/sermons/${encodeURIComponent(id)}/pdf`)).blob();
}

export async function sermonBackup(id) {
  return (await fileRequest(`/sermons/${encodeURIComponent(id)}/backup`)).blob();
}

export async function sermonPrint(id) {
  return (await fileRequest(`/sermons/${encodeURIComponent(id)}/print?auto=1`)).text();
}

// BÍBLIA & AUTOCOMPLETE
export async function chapter(translationOrOpts, bookNum, chapterNum) {
  let b;
  let c;
  let t;

  if (typeof translationOrOpts === 'object' && translationOrOpts !== null) {
    b = translationOrOpts.book || translationOrOpts.b;
    c = translationOrOpts.chapter || translationOrOpts.c;
    t = translationOrOpts.version || translationOrOpts.translation || translationOrOpts.t || 'ARA';
  } else if (/^\d+$/.test(String(translationOrOpts))) {
    b = translationOrOpts;
    c = bookNum;
    t = chapterNum || 'ARA';
  } else {
    t = translationOrOpts || 'ARA';
    b = bookNum;
    c = chapterNum;
  }

  const query = new URLSearchParams({ book: b || '', chapter: String(c || ''), translation: t }).toString();
  return request(`/bible/chapter?${query}`);
}

export async function search(queryStr, translation) {
  return request(`/bible/search?q=${encodeURIComponent(queryStr)}&translation=${encodeURIComponent(translation || 'ARA')}`);
}

export async function verse(ref, translation) {
  return request(`/bible/verse?ref=${encodeURIComponent(ref)}&translation=${encodeURIComponent(translation || 'ARA')}`);
}

export async function compare(ref, versionsList) {
  return request('/bible/compare', {
    method: 'POST',
    body: JSON.stringify({ ref, translations: versionsList }),
  });
}

export async function suggest(candidate, translation, signal) {
  return request(`/bible/suggest?q=${encodeURIComponent(candidate)}&translation=${encodeURIComponent(translation)}`, { signal });
}

export async function versions() {
  return request('/versions').catch(() => request('/bible/versions'));
}

// ESTUDO
export async function study(ref, translation) {
  return studyReference(ref, translation);
}

export async function studyReference(ref, translation) {
  return request(`/study/reference?ref=${encodeURIComponent(ref)}&translation=${encodeURIComponent(translation || 'ARA')}`);
}

export async function popularStrong() {
  return request('/study/strong/popular');
}

export async function strong(id) {
  return request(`/study/strong/${encodeURIComponent(id)}`);
}

export async function strongSearch(query) {
  return request(`/study/strong/search?q=${encodeURIComponent(query)}`);
}

export async function saveNote(ref, text) {
  return request(`/study/notes/${encodeURIComponent(ref)}`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  });
}

// MÚSICA
export async function musicFeatured() {
  return request('/music/featured');
}

export async function musicStatus() {
  return request('/music/status');
}

export async function musicSearch(query, provider) {
  return request(`/music/search?q=${encodeURIComponent(query)}&provider=${encodeURIComponent(provider)}`);
}

// COMPARTILHAMENTO E REDE
export async function network() {
  return request('/network');
}

export async function getShare(id) {
  return request(`/share/sermons/${encodeURIComponent(id)}`);
}

export async function createShare(id) {
  return request(`/share/sermons/${encodeURIComponent(id)}`, { method: 'POST' });
}

export async function revokeShare(id) {
  return request(`/share/sermons/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export const api = {
  login,
  register,
  profile,
  saveProfile,
  calibrate,
  listSermons,
  getSermon,
  createSermon,
  updateSermon,
  deleteSermon,
  duplicateSermon,
  stats,
  analyze,
  sermonPdf,
  sermonBackup,
  sermonPrint,
  chapter,
  search,
  verse,
  compare,
  suggest,
  versions,
  study,
  studyReference,
  popularStrong,
  strong,
  strongSearch,
  saveNote,
  musicFeatured,
  musicStatus,
  musicSearch,
  network,
  getShare,
  createShare,
  revokeShare,
};

export default api;