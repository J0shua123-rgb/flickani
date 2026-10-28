export type MediaKind = 'movie' | 'tv' | 'anime';

export type SortMode = 'recent' | 'trending' | 'rating';

export type GenreFilter = 'All' | 'Sci-Fi' | 'Cyberpunk' | 'Thriller' | 'Drama' | 'Action';

export type NavTab = 'home' | 'tv' | 'movies' | 'library' | 'profile';

export type EmbedProviderId = 'vidlink' | 'vidsrc' | 'twoembed' | 'preview';

export interface EpisodeItem {
  number: number;
  title: string;
  durationMinutes: number;
  synopsis: string;
  airDate: string;
}

export interface SeasonItem {
  seasonNumber: number;
  title: string;
  episodes: EpisodeItem[];
}

export interface MediaItem {
  id: string;
  tmdbId?: number;
  imdbId?: string;
  anilistId?: number;
  title: string;
  subtitle?: string;
  kind: MediaKind;
  year: number;
  addedAt: string; // ISO date string for sorting by Most Recently
  rating: number; // e.g. 8.9
  quality: '4K HDR' | '4K IMAX' | 'HD 1080P';
  durationLabel: string; // e.g. "2h 46m" or "SEASON 2"
  genres: string[];
  synopsis: string;
  directorOrStudio: string;
  cast: string[];
  posterUrl: string;
  backdropUrl: string;
  bentoSize?: 'hero' | 'wide' | 'tall' | 'standard' | 'compact';
  trendingScore: number;
  seasons?: SeasonItem[];
  sourceOrigin: 'TMDB' | 'ANILIST' | 'CURATED';
}

export interface WatchProgress {
  mediaId: string;
  season: number;
  episode: number;
  progressPercent: number; // 0 to 100
  remainingMinutes: number;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  handle: string;
  email: string;
  preferredResolver: EmbedProviderId;
  autoplayNext: boolean;
  ambientLighting: boolean;
}
