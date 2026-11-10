import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, YOUTUBE_API_KEY } from '../config.js';
import { HttpError } from '../lib/http.js';

export const FEATURED = [
  {
    provider: 'youtube',
    id: 'jfKfPfyJRdk',
    kind: 'video',
    title: 'Lo-fi para estudar',
    subtitle: 'Lofi Girl · rádio contínua',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    provider: 'youtube',
    id: '4xDzrJKXOOY',
    kind: 'video',
    title: 'Synthwave para escrever',
    subtitle: 'Lofi Girl · rádio contínua',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
  },
  {
    provider: 'spotify',
    id: '0vvXsWCC9xrXsKd4FyS8kM',
    kind: 'playlist',
    title: 'Lofi Beats',
    subtitle: 'Spotify · foco suave',
    url: 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4FyS8kM',
  },
  {
    provider: 'spotify',
    id: '37i9dQZF1DX4sWSpwq3LiO',
    kind: 'playlist',
    title: 'Peaceful Piano',
    subtitle: 'Spotify · piano instrumental',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
  },
  {
    provider: 'spotify',
    id: '37i9dQZF1DWZeKCadgRdKQ',
    kind: 'playlist',
    title: 'Deep Focus',
    subtitle: 'Spotify · concentração',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
  },
];

export const musicStatus = () => ({
  youtube: Boolean(YOUTUBE_API_KEY),
  spotify: Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
});

export async function youtubeSearch(query) {
  if (!YOUTUBE_API_KEY) {
    throw new HttpError('Busca no YouTube não configurada. Cole um link ou defina YOUTUBE_API_KEY.', 503, 'not_configured');
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('maxResults', '10');
  url.searchParams.set('q', query);
  url.searchParams.set('key', YOUTUBE_API_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new HttpError('O YouTube não respondeu como esperado.', 502, 'upstream_error');
  const data = await response.json();
  return (data.items || []).map((item) => ({
    provider: 'youtube',
    id: item.id?.videoId,
    kind: 'video',
    title: item.snippet?.title || '',
    subtitle: item.snippet?.channelTitle || '',
    thumbnail: item.snippet?.thumbnails?.medium?.url || '',
    url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
  })).filter((item) => item.id);
}

let spotifyToken = null;

async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new HttpError('Busca no Spotify não configurada. Cole um link ou defina as credenciais.', 503, 'not_configured');
  }
  if (spotifyToken && spotifyToken.expires > Date.now() + 30_000) return spotifyToken.value;
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new HttpError('Não foi possível autenticar no Spotify.', 502, 'upstream_error');
  const data = await response.json();
  spotifyToken = { value: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  return spotifyToken.value;
}

export async function spotifySearch(query) {
  const token = await getSpotifyToken();
  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'playlist,track,album');
  url.searchParams.set('limit', '8');
  url.searchParams.set('market', 'BR');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new HttpError('O Spotify não respondeu como esperado.', 502, 'upstream_error');
  const data = await response.json();
  const items = [];
  for (const playlist of data.playlists?.items || []) {
    if (!playlist) continue;
    items.push({
      provider: 'spotify',
      id: playlist.id,
      kind: 'playlist',
      title: playlist.name,
      subtitle: playlist.owner?.display_name || 'Playlist',
      thumbnail: playlist.images?.[0]?.url || '',
      url: playlist.external_urls?.spotify || '',
    });
  }
  for (const track of data.tracks?.items || []) {
    if (!track) continue;
    items.push({
      provider: 'spotify',
      id: track.id,
      kind: 'track',
      title: track.name,
      subtitle: (track.artists || []).map((a) => a.name).join(', '),
      thumbnail: track.album?.images?.[0]?.url || '',
      url: track.external_urls?.spotify || '',
    });
  }
  return items.slice(0, 12);
}
