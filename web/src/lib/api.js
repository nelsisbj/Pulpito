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

export async function versions() {
  return request('/versions');
}

export async function saveProfile(patch) {
  return request('/profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function analyze(text, title, theme) {
  return request('/sermons/analyze', {
    method: 'POST',
    body: JSON.stringify({ text, title, theme }),
  });
}

export async function suggest(candidate, translation, signal) {
  return request(`/bible/suggest?q=${encodeURIComponent(candidate)}&t=${encodeURIComponent(translation)}`, { signal });
}

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
  listSermons,
  getSermon,
  createSermon,
  updateSermon,
  deleteSermon,
  stats,
  versions,
  saveProfile,
  analyze,
  suggest,
  musicFeatured,
  musicStatus,
};

export default api;