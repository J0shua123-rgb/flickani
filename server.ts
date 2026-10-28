import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { SEED_MEDIA_CATALOG } from './src/data/seedCatalog.ts';
import { searchMediaCatalog, upsertWatchProgress } from './src/utils/mediaLogic.ts';
import type { MediaItem, UserProfile, WatchProgress } from './src/types/media.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Supabase (server-side, service-role key bypasses RLS for admin operations)
// Fall back to anon key if service-role is not configured — RLS will apply.
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  '';

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Demo user — used while Auth is not yet wired in the frontend.
// All Supabase rows are scoped to this UUID so RLS policies are satisfied.
// ---------------------------------------------------------------------------
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// In-memory fallback (used when Supabase is unreachable or not configured)
// ---------------------------------------------------------------------------
let fallbackWatchlistIds: string[] = ['tmdb-76600', 'tmdb-95396', 'anilist-105398', 'tmdb-335984'];

let fallbackProgress: WatchProgress[] = [
  {
    mediaId: 'tmdb-76600',
    season: 1,
    episode: 1,
    progressPercent: 68,
    remainingMinutes: 58,
    updatedAt: '2026-10-24T17:45:00Z',
  },
  {
    mediaId: 'tmdb-95396',
    season: 2,
    episode: 1,
    progressPercent: 42,
    remainingMinutes: 31,
    updatedAt: '2026-10-24T09:20:00Z',
  },
  {
    mediaId: 'anilist-105398',
    season: 1,
    episode: 2,
    progressPercent: 81,
    remainingMinutes: 5,
    updatedAt: '2026-10-23T22:10:00Z',
  },
];

let fallbackProfile: UserProfile = {
  id: 'usr-obsidian-01',
  displayName: 'Kaelen Vance',
  handle: '@kaelen',
  email: 'kaelen.vance@obsidian.cinema',
  preferredResolver: 'preview',
  autoplayNext: true,
  ambientLighting: true,
};

// ---------------------------------------------------------------------------
// Helper — returns true if Supabase is properly configured
// ---------------------------------------------------------------------------
function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return 'No synopsis available.';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Supabase data helpers
// ---------------------------------------------------------------------------

async function dbGetProfile(): Promise<UserProfile> {
  if (!isSupabaseConfigured()) return fallbackProfile;
  const { data, error } = await db
    .from('profiles')
    .select('id, email, username, handle, display_name, preferred_resolver, autoplay_next, ambient_lighting')
    .eq('id', DEMO_USER_ID)
    .maybeSingle();

  if (error || !data) return fallbackProfile;

  return {
    id: data.id,
    displayName: data.display_name ?? data.username ?? fallbackProfile.displayName,
    handle: data.handle ?? fallbackProfile.handle,
    email: data.email ?? fallbackProfile.email,
    preferredResolver: (data.preferred_resolver as UserProfile['preferredResolver']) ?? 'preview',
    autoplayNext: data.autoplay_next ?? true,
    ambientLighting: data.ambient_lighting ?? true,
  };
}

async function dbUpsertProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  if (!isSupabaseConfigured()) {
    fallbackProfile = { ...fallbackProfile, ...updates };
    return fallbackProfile;
  }

  const row: Record<string, unknown> = {
    id: DEMO_USER_ID,
    updated_at: new Date().toISOString(),
  };
  if (updates.displayName !== undefined) row.display_name = updates.displayName;
  if (updates.handle !== undefined) row.handle = updates.handle;
  if (updates.email !== undefined) row.email = updates.email;
  if (updates.preferredResolver !== undefined) row.preferred_resolver = updates.preferredResolver;
  if (updates.autoplayNext !== undefined) row.autoplay_next = updates.autoplayNext;
  if (updates.ambientLighting !== undefined) row.ambient_lighting = updates.ambientLighting;

  const { error } = await db.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) console.error('[supabase] profile upsert error:', error.message);

  return dbGetProfile();
}

async function dbGetWatchlistIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return fallbackWatchlistIds;
  const { data, error } = await db
    .from('watchlist')
    .select('media_id')
    .eq('user_id', DEMO_USER_ID)
    .order('created_at', { ascending: false });

  if (error) return fallbackWatchlistIds;
  return (data ?? []).map((r) => r.media_id as string);
}

async function dbToggleWatchlist(mediaId: string, catalogItem?: MediaItem): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    fallbackWatchlistIds = fallbackWatchlistIds.includes(mediaId)
      ? fallbackWatchlistIds.filter((id) => id !== mediaId)
      : [mediaId, ...fallbackWatchlistIds];
    return fallbackWatchlistIds;
  }

  // Check if already in watchlist
  const { data: existing } = await db
    .from('watchlist')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .eq('media_id', mediaId)
    .maybeSingle();

  if (existing) {
    await db.from('watchlist').delete().eq('user_id', DEMO_USER_ID).eq('media_id', mediaId);
  } else {
    const item = catalogItem ?? SEED_MEDIA_CATALOG.find((m) => m.id === mediaId);
    await db.from('watchlist').insert({
      user_id: DEMO_USER_ID,
      media_id: mediaId,
      media_type: item?.kind ?? 'movie',
      title: item?.title ?? mediaId,
      poster_path: item?.posterUrl ?? null,
      year: item?.year ?? null,
      kind: item?.kind ?? null,
    });
  }

  return dbGetWatchlistIds();
}

async function dbGetProgress(): Promise<WatchProgress[]> {
  if (!isSupabaseConfigured()) return fallbackProgress;
  const { data, error } = await db
    .from('watch_history')
    .select('media_id, season, episode, progress_percentage, remaining_minutes, updated_at')
    .eq('user_id', DEMO_USER_ID)
    .order('updated_at', { ascending: false });

  if (error) return fallbackProgress;

  return (data ?? []).map((r) => ({
    mediaId: r.media_id as string,
    season: (r.season as number) ?? 1,
    episode: (r.episode as number) ?? 1,
    progressPercent: (r.progress_percentage as number) ?? 0,
    remainingMinutes: (r.remaining_minutes as number) ?? 0,
    updatedAt: r.updated_at as string,
  }));
}

async function dbUpsertProgress(update: Omit<WatchProgress, 'updatedAt'>): Promise<WatchProgress[]> {
  if (!isSupabaseConfigured()) {
    fallbackProgress = upsertWatchProgress(fallbackProgress, update);
    return fallbackProgress;
  }

  const item = SEED_MEDIA_CATALOG.find((m) => m.id === update.mediaId);
  const now = new Date().toISOString();

  // Check if row exists
  const { data: existing } = await db
    .from('watch_history')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .eq('media_id', update.mediaId)
    .maybeSingle();

  const row = {
    user_id: DEMO_USER_ID,
    media_id: update.mediaId,
    media_type: item?.kind ?? 'movie',
    title: item?.title ?? update.mediaId,
    poster_path: item?.posterUrl ?? null,
    season: update.season,
    episode: update.episode,
    progress_percentage: update.progressPercent,
    remaining_minutes: update.remainingMinutes,
    updated_at: now,
  };

  if (existing) {
    await db
      .from('watch_history')
      .update(row)
      .eq('user_id', DEMO_USER_ID)
      .eq('media_id', update.mediaId);
  } else {
    await db.from('watch_history').insert(row);
  }

  return dbGetProgress();
}

// ---------------------------------------------------------------------------
// External API helpers
// ---------------------------------------------------------------------------

async function queryAniList(searchQuery: string): Promise<MediaItem[]> {
  try {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 6) {
          media(search: $search, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
            id
            title { english romaji }
            seasonYear
            averageScore
            episodes
            genres
            description(asHtml: false)
            coverImage { extraLarge large }
            bannerImage
            studios(isMain: true) { nodes { name } }
          }
        }
      }
    `;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { search: searchQuery } }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return [];

    const payload = (await response.json()) as any;
    const mediaNodes = payload?.data?.Page?.media;
    if (!Array.isArray(mediaNodes)) return [];

    return mediaNodes.map((node: any): MediaItem => {
      const title = node.title?.english || node.title?.romaji || 'Untitled Anime';
      const episodeCount = node.episodes || 12;
      const studioName = node.studios?.nodes?.[0]?.name || 'Anime Studio';
      const poster = node.coverImage?.extraLarge || node.coverImage?.large || SEED_MEDIA_CATALOG[5].posterUrl;
      const backdrop = node.bannerImage || poster;

      return {
        id: `anilist-live-${node.id}`,
        anilistId: node.id,
        title,
        subtitle: `${studioName} · AniList Catalog`,
        kind: 'anime',
        year: node.seasonYear || 2024,
        addedAt: new Date().toISOString(),
        rating: node.averageScore ? Number((node.averageScore / 10).toFixed(1)) : 8.2,
        quality: 'HD 1080P',
        durationLabel: `${episodeCount} EPISODES`,
        genres: Array.isArray(node.genres) && node.genres.length > 0 ? node.genres.slice(0, 3) : ['Anime', 'Action'],
        synopsis: stripHtmlTags(node.description),
        directorOrStudio: studioName,
        cast: ['Original Japanese Cast'],
        posterUrl: poster,
        backdropUrl: backdrop,
        bentoSize: 'compact',
        trendingScore: node.averageScore || 82,
        sourceOrigin: 'ANILIST',
        seasons: [
          {
            seasonNumber: 1,
            title: 'Season 1',
            episodes: Array.from({ length: Math.min(episodeCount, 6) }, (_, idx) => ({
              number: idx + 1,
              title: `Episode ${idx + 1}`,
              durationMinutes: 24,
              airDate: `${node.seasonYear || 2024}-01-0${Math.min(9, idx + 1)}`,
              synopsis: `Broadcast episode ${idx + 1} of ${title}.`,
            })),
          },
        ],
      };
    });
  } catch {
    return [];
  }
}

async function queryTmdb(searchQuery: string): Promise<MediaItem[]> {
  const apiKey = process.env.TMDB_API_KEY?.trim() ?? process.env.VITE_TMDB_API_KEY?.trim();
  if (!apiKey || apiKey.includes('your_tmdb')) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const isBearer = apiKey.length > 45;
    const url = isBearer
      ? `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(searchQuery)}&include_adult=false`
      : `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(searchQuery)}&include_adult=false`;

    const response = await fetch(url, {
      headers: isBearer ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const data = (await response.json()) as any;
    if (!Array.isArray(data?.results)) return [];

    return data.results
      .filter((r: any) => (r.media_type === 'movie' || r.media_type === 'tv') && (r.poster_path || r.backdrop_path))
      .slice(0, 6)
      .map((r: any): MediaItem => {
        const isTv = r.media_type === 'tv';
        const title = r.title || r.name || 'Untitled';
        const dateStr = r.release_date || r.first_air_date || '2024-01-01';
        const year = Number(dateStr.slice(0, 4)) || 2024;
        const posterUrl = r.poster_path
          ? `https://image.tmdb.org/t/p/w780${r.poster_path}`
          : SEED_MEDIA_CATALOG[0].posterUrl;
        const backdropUrl = r.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`
          : posterUrl;

        return {
          id: `tmdb-live-${r.id}`,
          tmdbId: r.id,
          title,
          subtitle: isTv ? 'Series Broadcast' : 'Theatrical Feature',
          kind: isTv ? 'tv' : 'movie',
          year,
          addedAt: new Date().toISOString(),
          rating: r.vote_average ? Number(Number(r.vote_average).toFixed(1)) : 8.0,
          quality: '4K HDR',
          durationLabel: isTv ? 'SEASON 1' : 'FEATURE',
          genres: ['Sci-Fi', 'Drama'],
          synopsis: r.overview || 'No synopsis available.',
          directorOrStudio: 'TMDB Verified Release',
          cast: [],
          posterUrl,
          backdropUrl,
          bentoSize: 'compact',
          trendingScore: Math.round((r.popularity || 50) % 100),
          sourceOrigin: 'TMDB',
          seasons: isTv
            ? [
                {
                  seasonNumber: 1,
                  title: 'Season 1',
                  episodes: [
                    { number: 1, title: 'Pilot', durationMinutes: 48, airDate: dateStr, synopsis: r.overview || 'Series premiere episode.' },
                    { number: 2, title: 'Episode 2', durationMinutes: 46, airDate: dateStr, synopsis: `Continuation of ${title}.` },
                  ],
                },
              ]
            : undefined,
        };
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

// GET /api/catalog — returns seed catalog + persisted user state
app.get('/api/catalog', async (_req, res) => {
  const [watchlistIds, progress, profile] = await Promise.all([
    dbGetWatchlistIds(),
    dbGetProgress(),
    dbGetProfile(),
  ]);

  res.json({
    items: SEED_MEDIA_CATALOG,
    watchlistIds,
    progress,
    profile,
  });
});

// GET /api/search — local + live TMDB & AniList results
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const localMatches = searchMediaCatalog(SEED_MEDIA_CATALOG, q);

  if (!q || q.length < 2) {
    return res.json({ results: localMatches });
  }

  const [tmdbMatches, anilistMatches] = await Promise.all([queryTmdb(q), queryAniList(q)]);

  const seenTitles = new Set(localMatches.map((m) => m.title.toLowerCase()));
  const merged = [...localMatches];

  for (const item of [...tmdbMatches, ...anilistMatches]) {
    const key = item.title.toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      merged.push(item);
    }
  }

  return res.json({ results: merged.slice(0, 12) });
});

// POST /api/watchlist/toggle — persist to Supabase watchlist table
app.post('/api/watchlist/toggle', async (req, res) => {
  const mediaId = String(req.body?.mediaId || '').trim();
  if (!mediaId) return res.status(400).json({ error: 'mediaId is required' });

  const watchlistIds = await dbToggleWatchlist(mediaId);
  return res.json({ watchlistIds });
});

// POST /api/progress — persist watch progress to Supabase watch_history table
app.post('/api/progress', async (req, res) => {
  const { mediaId, season, episode, progressPercent, remainingMinutes } = req.body || {};
  if (!mediaId || typeof mediaId !== 'string') {
    return res.status(400).json({ error: 'mediaId is required' });
  }

  const progress = await dbUpsertProgress({
    mediaId,
    season: Number(season) || 1,
    episode: Number(episode) || 1,
    progressPercent: Number(progressPercent) || 15,
    remainingMinutes: Number(remainingMinutes ?? 42),
  });

  return res.json({ progress });
});

// GET /api/resolve-stream — sequential fallback loop through mirror pool
// Tries each mirror in priority order; stops at the first healthy response.
// Query params: id (TMDB ID), type ('movie'|'tv'), season, episode
app.get('/api/resolve-stream', async (req, res) => {
  const id      = String(req.query.id     || '').trim();
  const type    = String(req.query.type   || 'movie').trim();
  const season  = Number(req.query.season)  || 1;
  const episode = Number(req.query.episode) || 1;

  if (!id) {
    return res.status(400).json({ success: false, error: 'id is required' });
  }

  const isTv = type === 'tv';

  // Realistic Chrome UA — some embed servers reject non-browser agents
  const CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // Mirror pool — embed.su leads (DNS-stable, globally accessible);
  // vidsrc.cc last because it is currently 522-ing on Cloudflare.
  const mirrors: { name: string; url: string }[] = isTv
    ? [
        { name: 'embed.su',     url: `https://embed.su/embed/tv/${id}/${season}/${episode}` },
        { name: 'vidsrc.party', url: `https://www.vidsrc.party/embed/tv/${id}/${season}/${episode}` },
        { name: 'vidlink.pro',  url: `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=00ff9d&secondaryColor=0d1117` },
        { name: 'vidsrc.to',    url: `https://vidsrc.to/embed/tv/${id}/${season}/${episode}` },
        { name: 'vidsrc.cc',    url: `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}` },
      ]
    : [
        { name: 'embed.su',     url: `https://embed.su/embed/movie/${id}` },
        { name: 'vidsrc.party', url: `https://www.vidsrc.party/embed/movie/${id}` },
        { name: 'vidlink.pro',  url: `https://vidlink.pro/movie/${id}?primaryColor=00ff9d&secondaryColor=0d1117` },
        { name: 'vidsrc.to',    url: `https://vidsrc.to/embed/movie/${id}` },
        { name: 'vidsrc.cc',    url: `https://vidsrc.cc/v2/embed/movie/${id}` },
      ];

  // Sequential fallback loop — test each mirror in priority order,
  // stop as soon as one responds healthily.
  for (const mirror of mirrors) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5 s per mirror
    try {
      const r = await fetch(mirror.url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': CHROME_UA },
      });
      clearTimeout(timer);
      // Discard body immediately — we only care about status, not content
      r.body?.cancel?.().catch(() => {});
      // Accept 2xx and 3xx; reject Cloudflare 522 and any 5xx
      if (r.status < 500 && r.status !== 522) {
        console.log(`[resolve-stream] ✓ ${mirror.name} responded ${r.status} for id=${id}`);
        return res.json({ success: true, ...mirror });
      }
      console.log(`[resolve-stream] ✗ ${mirror.name} returned ${r.status} — trying next`);
    } catch (err: unknown) {
      clearTimeout(timer);
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`[resolve-stream] ✗ ${mirror.name} failed (${reason}) — trying next`);
    }
  }

  // All mirrors failed — return the LAST mirror (embed.su, most DNS-stable)
  // so the frontend can still open something rather than a broken 500.
  const lastResort = mirrors[mirrors.length - 1];
  console.warn(`[resolve-stream] all mirrors unreachable for id=${id}, using last-resort: ${lastResort.name}`);
  return res.json({ success: true, ...lastResort, fallback: true });
});

// ---------------------------------------------------------------------------
// GET /api/resolve-download
// Attempts to extract a raw playable video asset URL (mp4 / m3u8) from the
// embed player page HTML. Tries each mirror in order; returns the first hit.
// Query params: id, type ('movie'|'tv'), season, episode
// ---------------------------------------------------------------------------
app.get('/api/resolve-download', async (req, res) => {
  const id      = String(req.query.id     || '').trim();
  const type    = String(req.query.type   || 'movie').trim();
  const season  = Number(req.query.season)  || 1;
  const episode = Number(req.query.episode) || 1;
  const quality = String(req.query.quality || '1080p').trim();

  if (!id) return res.status(400).json({ success: false, error: 'id is required' });

  const isTv = type === 'tv';

  const CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // Embed page sources — each returns HTML that embeds a video player.
  // We scrape the HTML looking for raw video asset URLs.
  const sources: { name: string; embedUrl: string }[] = isTv
    ? [
        { name: 'vidsrc.to',    embedUrl: `https://vidsrc.to/embed/tv/${id}/${season}/${episode}` },
        { name: 'embed.su',     embedUrl: `https://embed.su/embed/tv/${id}/${season}/${episode}` },
        { name: 'vidsrc.party', embedUrl: `https://www.vidsrc.party/embed/tv/${id}/${season}/${episode}` },
        { name: 'vidlink.pro',  embedUrl: `https://vidlink.pro/tv/${id}/${season}/${episode}` },
      ]
    : [
        { name: 'vidsrc.to',    embedUrl: `https://vidsrc.to/embed/movie/${id}` },
        { name: 'embed.su',     embedUrl: `https://embed.su/embed/movie/${id}` },
        { name: 'vidsrc.party', embedUrl: `https://www.vidsrc.party/embed/movie/${id}` },
        { name: 'vidlink.pro',  embedUrl: `https://vidlink.pro/movie/${id}` },
      ];

  // Regex patterns that match raw video asset URLs in embed player HTML / JS.
  // Ordered by specificity — mp4 direct links first, then m3u8 streams.
  const VIDEO_URL_PATTERNS: RegExp[] = [
    // Quoted mp4/webm direct links
    /["'](https?:\/\/[^"']+\.mp4(?:\?[^"']*)?)['"]/gi,
    /["'](https?:\/\/[^"']+\.webm(?:\?[^"']*)?)['"]/gi,
    // HLS m3u8 playlist (can be downloaded via ffmpeg fallback)
    /["'](https?:\/\/[^"']+\.m3u8(?:\?[^"']*)?)['"]/gi,
    // JSON "file" or "src" keys pointing to video CDN
    /"(?:file|src|source|url)"\s*:\s*"(https?:\/\/[^"]+(?:mp4|m3u8|webm)[^"]*)"/gi,
    // unquoted blob/cdn path with video extension
    /(https?:\/\/(?:cdn|media|stream|video|vod|hls)[^'"\s]+\.(?:mp4|m3u8)(?:\?[^\s'"]*)?)/gi,
  ];

  function extractVideoUrl(html: string): string | null {
    for (const pattern of VIDEO_URL_PATTERNS) {
      pattern.lastIndex = 0;
      const m = pattern.exec(html);
      if (m) {
        const url = (m[1] || m[0]).trim();
        // Sanity check — must look like a real URL
        if (url.startsWith('http') && url.length > 20) return url;
      }
    }
    return null;
  }

  for (const source of sources) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(source.embedUrl, {
        headers: {
          'User-Agent': CHROME_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (!r.ok) {
        console.log(`[resolve-download] ${source.name} HTTP ${r.status} — skip`);
        continue;
      }

      const html = await r.text();
      const videoUrl = extractVideoUrl(html);

      if (videoUrl) {
        console.log(`[resolve-download] ✓ ${source.name} → ${videoUrl.slice(0, 80)}…`);
        return res.json({
          success: true,
          videoUrl,
          source: source.name,
          quality,
          isHls: videoUrl.includes('.m3u8'),
        });
      }

      console.log(`[resolve-download] ${source.name} — no video URL found in HTML`);
    } catch (err) {
      clearTimeout(timer);
      console.log(`[resolve-download] ${source.name} error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // All sources exhausted — no extractable direct URL found.
  return res.json({
    success: false,
    error: 'Could not extract a direct video URL from any embed source. ' +
           'The embed players likely use obfuscated JS loaders or token-protected CDN links.',
  });
});

// ---------------------------------------------------------------------------
// GET /api/download-proxy
// Server-side streaming tunnel: fetches the raw video bytes with a spoofed
// browser UA + Referer and pipes them back to the client as an attachment.
// This bypasses browser CORS entirely — the request originates from Node.js.
// Query params: url (encoded), filename
// ---------------------------------------------------------------------------
app.get('/api/download-proxy', async (req, res) => {
  const rawUrl  = String(req.query.url      || '').trim();
  const filename = String(req.query.filename || 'video.mp4').trim().replace(/[^\w\s\-_.()[\]]/g, '_');

  if (!rawUrl || !rawUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid url param is required' });
  }

  const CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // Derive a plausible Referer from the video CDN hostname
  let referer = 'https://vidsrc.to/';
  try {
    const u = new URL(rawUrl);
    referer = `${u.protocol}//${u.hostname}/`;
  } catch { /* keep default */ }

  const ctrl = new AbortController();
  // 30 min timeout — large video files take time
  const timer = setTimeout(() => ctrl.abort(), 30 * 60 * 1000);

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent': CHROME_UA,
        'Referer': referer,
        'Origin': referer.slice(0, -1),
        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        // Forward Range header if client sent one (enables resumable downloads)
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }

    // Forward key headers so browser handles the file correctly
    const contentType   = upstream.headers.get('content-type')   || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const contentRange  = upstream.headers.get('content-range');
    const acceptRanges  = upstream.headers.get('accept-ranges');

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange)  res.setHeader('Content-Range', contentRange);
    if (acceptRanges)  res.setHeader('Accept-Ranges', acceptRanges);

    // Stream bytes directly — never buffer the whole file in RAM
    if (!upstream.body) return res.status(502).json({ error: 'No body from upstream' });

    const reader = upstream.body.getReader();
    res.on('close', () => ctrl.abort()); // client disconnected — stop streaming

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const ok = res.write(Buffer.from(value));
      // Respect backpressure — wait if internal buffer is full
      if (!ok) await new Promise((r) => res.once('drain', r));
    }
    res.end();
  } catch (err) {
    clearTimeout(timer);
    if (!res.headersSent) {
      res.status(502).json({ error: `Proxy error: ${err instanceof Error ? err.message : err}` });
    }
  }
});

// POST /api/profile — persist profile settings to Supabase profiles table
app.post('/api/profile', async (req, res) => {
  const { displayName, preferredResolver, autoplayNext, ambientLighting } = req.body || {};
  if (typeof displayName === 'string' && !displayName.trim()) {
    return res.status(400).json({ error: 'Display name cannot be empty' });
  }

  const profile = await dbUpsertProfile({
    ...(typeof displayName === 'string' ? { displayName: displayName.trim() } : {}),
    ...(preferredResolver ? { preferredResolver } : {}),
    ...(typeof autoplayNext === 'boolean' ? { autoplayNext } : {}),
    ...(typeof ambientLighting === 'boolean' ? { ambientLighting } : {}),
  });

  return res.json({ profile });
});

// ---------------------------------------------------------------------------
// Dev / prod server bootstrap
// ---------------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isSupabaseConfigured()) {
    console.log(`[supabase] connected → ${SUPABASE_URL}`);
  } else {
    console.warn('[supabase] SUPABASE_URL / key not set — using in-memory fallback');
  }

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Obsidian Theater server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
