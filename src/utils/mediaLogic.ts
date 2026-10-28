import {
  EmbedProviderId,
  GenreFilter,
  MediaItem,
  NavTab,
  SortMode,
  WatchProgress,
} from '../types/media';

export interface FilterCriteria {
  tab: NavTab;
  genre: GenreFilter;
  sortBy: SortMode;
  watchlistIds: string[];
}

/**
 * Pure filtering and sorting pipeline for Bento-Grid & Mobile carousels.
 */
export function filterAndSortMedia(
  items: MediaItem[],
  criteria: FilterCriteria
): MediaItem[] {
  const { tab, genre, sortBy, watchlistIds } = criteria;

  const filtered = items.filter((item) => {
    if (tab === 'movies' && item.kind !== 'movie') return false;
    if (tab === 'tv' && item.kind !== 'tv' && item.kind !== 'anime') return false;
    if (tab === 'library' && !watchlistIds.includes(item.id)) return false;

    if (genre !== 'All') {
      const hasGenre = item.genres.some(
        (g) => g.toLowerCase() === genre.toLowerCase()
      );
      if (!hasGenre) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
    if (sortBy === 'rating') {
      return b.rating - a.rating || b.trendingScore - a.trendingScore;
    }
    // Default 'trending'
    return b.trendingScore - a.trendingScore;
  });

  return sorted;
}

/**
 * Pure Spotlight (Cmd+K) search matcher across title, subtitle, genres, studio, and cast.
 */
export function searchMediaCatalog(
  items: MediaItem[],
  query: string
): MediaItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...items].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8);
  }

  return items
    .map((item) => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const subtitleLower = (item.subtitle || '').toLowerCase();
      const studioLower = item.directorOrStudio.toLowerCase();

      if (titleLower === normalized) score += 100;
      else if (titleLower.startsWith(normalized)) score += 60;
      else if (titleLower.includes(normalized)) score += 40;

      if (subtitleLower.includes(normalized)) score += 20;
      if (studioLower.includes(normalized)) score += 15;
      if (item.genres.some((g) => g.toLowerCase().includes(normalized))) score += 15;
      if (item.cast.some((c) => c.toLowerCase().includes(normalized))) score += 10;

      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.trendingScore - a.item.trendingScore)
    .map((entry) => entry.item);
}

/**
 * Resolves external embed URLs from TMDB IDs and Season/Episode numbers.
 * Providers (in order of preference):
 *   vidlink  — VidLink Pro  (primary · emerald cyberpunk theme · cleanest UX)
 *   vidsrc   — VidSrc.party (mirror 1 · high-uptime · TMDB path-based)
 *   twoembed — embed.su     (mirror 2 · active fallback · DNS-stable)
 */
export function resolveEmbedUrl(
  media: Pick<MediaItem, 'kind' | 'tmdbId' | 'imdbId'>,
  provider: EmbedProviderId,
  season = 1,
  episode = 1
): string | null {
  if (provider === 'preview') {
    return null;
  }

  const externalId = media.tmdbId ? String(media.tmdbId) : media.imdbId;
  if (!externalId) {
    return null;
  }

  const isSeries = media.kind === 'tv' || media.kind === 'anime';
  const safeSeason = Math.max(1, Math.floor(season));
  const safeEpisode = Math.max(1, Math.floor(episode));

  // VidLink cyberpunk emerald theme params
  const vidlinkParams = 'primaryColor=00ff9d&secondaryColor=0d1117';

  switch (provider) {
    case 'vidlink':
      // VidLink Pro — primary, cleanest embed with branded emerald UI
      return isSeries
        ? `https://vidlink.pro/tv/${encodeURIComponent(externalId)}/${safeSeason}/${safeEpisode}?${vidlinkParams}`
        : `https://vidlink.pro/movie/${encodeURIComponent(externalId)}?${vidlinkParams}`;
    case 'vidsrc':
      // VidSrc.party — high-uptime mirror, TMDB path-based (replaces .cc)
      return isSeries
        ? `https://www.vidsrc.party/embed/tv/${encodeURIComponent(externalId)}/${safeSeason}/${safeEpisode}`
        : `https://www.vidsrc.party/embed/movie/${encodeURIComponent(externalId)}`;
    case 'twoembed':
      // embed.su — active mirror (2embed.cc is DNS-dead; same URL schema)
      return isSeries
        ? `https://embed.su/embed/tv/${encodeURIComponent(externalId)}/${safeSeason}/${safeEpisode}`
        : `https://embed.su/embed/movie/${encodeURIComponent(externalId)}`;
    default:
      return null;
  }
}

/**
 * Computes deterministic updated Continue Watching list after watching or scrubbing an item.
 */
export function upsertWatchProgress(
  existing: WatchProgress[],
  update: Omit<WatchProgress, 'updatedAt'> & { updatedAt?: string }
): WatchProgress[] {
  const clampedPercent = Math.max(1, Math.min(100, Math.round(update.progressPercent)));
  const clampedRemaining = Math.max(0, Math.round(update.remainingMinutes));
  const timestamp = update.updatedAt ?? new Date().toISOString();

  const nextEntry: WatchProgress = {
    mediaId: update.mediaId,
    season: Math.max(1, update.season),
    episode: Math.max(1, update.episode),
    progressPercent: clampedPercent,
    remainingMinutes: clampedRemaining,
    updatedAt: timestamp,
  };

  const filtered = existing.filter((entry) => entry.mediaId !== update.mediaId);
  return [nextEntry, ...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Assigns dynamic Bento-Grid span classes on desktop (6-column layout) based on index & item properties.
 */
export function getBentoSlotClass(index: number, totalCount: number): string {
  if (totalCount <= 2) {
    return 'lg:col-span-3 lg:row-span-2 min-h-[340px]';
  }
  // Asymmetric cinematic Bento rhythm across a 6-column, 2-row desktop grid:
  // Slot 0: Large Featured 3x2 (Left half)
  // Slot 1: Wide Cinema 3x1 (Top right)
  // Slot 2: Medium Cinema 2x1 (Bottom middle-right)
  // Slot 3: Compact Vertical 1x1 (Bottom far-right)
  switch (index) {
    case 0:
      return 'md:col-span-2 lg:col-span-3 lg:row-span-2 min-h-[360px] lg:min-h-[436px]';
    case 1:
      return 'md:col-span-2 lg:col-span-3 lg:row-span-1 min-h-[210px]';
    case 2:
      return 'md:col-span-1 lg:col-span-2 lg:row-span-1 min-h-[210px]';
    default:
      return 'md:col-span-1 lg:col-span-1 lg:row-span-1 min-h-[210px]';
  }
}
