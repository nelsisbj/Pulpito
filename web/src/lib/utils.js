export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export function formatMinutes(minutes) {
  const value = Number(minutes) || 0;
  if (value < 1) return 'menos de 1 min';
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 60) return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} min`;
  const hours = Math.floor(rounded / 60);
  const rest = Math.round(rounded % 60);
  return `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
}

/** Duração curta: segundos quando abaixo de 1 minuto. */
export function formatDuration(minutes) {
  const value = Number(minutes) || 0;
  if (value < 1 / 60) return '0 s';
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} s`;
  return formatMinutes(value);
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function htmlToText(html) {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = String(html);
  return (template.content.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function countWords(html) {
  const text = htmlToText(html);
  if (!text) return 0;
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu);
  return matches ? matches.length : 0;
}

export function sermonWords(sermon) {
  if (!sermon?.sections) return 0;
  const { introduction, developments = [], conclusion } = sermon.sections;
  return (
    countWords(introduction?.html) +
    countWords(conclusion?.html) +
    developments.reduce((sum, dev) => sum + countWords(dev?.html), 0)
  );
}

export function debounce(fn, wait = 300) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function parseMusicLink(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      let id = '';
      let kind = 'video';
      if (host === 'youtu.be') {
        id = url.pathname.slice(1);
      } else if (url.pathname === '/watch') {
        id = url.searchParams.get('v') || '';
        if (url.searchParams.get('list')) {
          kind = 'playlist';
          id = url.searchParams.get('list');
        }
      } else if (url.pathname.startsWith('/playlist')) {
        kind = 'playlist';
        id = url.searchParams.get('list') || '';
      } else if (url.pathname.startsWith('/embed/')) {
        id = url.pathname.split('/')[2] || '';
      }
      id = id.replace(/[^A-Za-z0-9_-]/g, '');
      if (!id) return null;
      return {
        provider: 'youtube',
        kind,
        id,
        title: kind === 'playlist' ? 'Playlist do YouTube' : 'Vídeo do YouTube',
        subtitle: 'Link colado',
        url: raw,
      };
    }
    if (host === 'open.spotify.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const kind = parts[0];
      const id = parts[1];
      if (!['playlist', 'album', 'track', 'artist', 'episode', 'show'].includes(kind) || !id) return null;
      return {
        provider: 'spotify',
        kind,
        id,
        title: 'Spotify',
        subtitle: `Link colado · ${kind}`,
        url: raw,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeEmbed(item) {
  if (!item?.id) return '';
  if (item.kind === 'playlist') {
    const params = new URLSearchParams({ rel: '0' });
    if (item.autoplay) params.set('autoplay', '1');
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(item.id)}&${params}`;
  }
  const params = new URLSearchParams({ rel: '0' });
  if (item.autoplay) params.set('autoplay', '1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.id)}?${params}`;
}

export function spotifyEmbed(item) {
  if (!item?.id) return '';
  const kind = item.kind || 'playlist';
  return `https://open.spotify.com/embed/${kind}/${encodeURIComponent(item.id)}?utm_source=generator&theme=0`;
}

export function truncate(text, max = 120) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}
