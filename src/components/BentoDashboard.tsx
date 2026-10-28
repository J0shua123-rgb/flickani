import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, Check, Play, SlidersHorizontal, Star } from 'lucide-react';
import {
  GenreFilter,
  MediaItem,
  NavTab,
  SortMode,
  WatchProgress,
} from '../types/media';
import { getBentoSlotClass } from '../utils/mediaLogic';
import { ResilientImage } from './ResilientImage';

interface BentoDashboardProps {
  activeTab: NavTab;
  items: MediaItem[];
  allCatalog: MediaItem[];
  continueWatching: WatchProgress[];
  watchlistIds: string[];
  selectedGenre: GenreFilter;
  sortBy: SortMode;
  showGenreBar: boolean;
  onToggleGenreBar: () => void;
  onSelectGenre: (genre: GenreFilter) => void;
  onChangeSort: (sort: SortMode) => void;
  onHoverBackdrop: (url: string | null) => void;
  onOpenTheater: (item: MediaItem, season?: number, episode?: number) => void;
  onToggleWatchlist: (mediaId: string) => void;
  onResetFilters: () => void;
}

const GENRE_OPTIONS: GenreFilter[] = [
  'All',
  'Sci-Fi',
  'Cyberpunk',
  'Thriller',
  'Drama',
  'Action',
];

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  activeTab,
  items,
  allCatalog,
  continueWatching,
  watchlistIds,
  selectedGenre,
  sortBy,
  showGenreBar,
  onToggleGenreBar,
  onSelectGenre,
  onChangeSort,
  onHoverBackdrop,
  onOpenTheater,
  onToggleWatchlist,
  onResetFilters,
}) => {
  const featuredItem = items[0];
  const secondaryBentoItems = items.slice(1, 4);
  const compactRecentItems = items.slice(4);

  const continueWatchingHydrated = continueWatching
    .map((entry) => {
      const media = allCatalog.find((m) => m.id === entry.mediaId);
      return media ? { entry, media } : null;
    })
    .filter((x): x is { entry: WatchProgress; media: MediaItem } => Boolean(x));

  const sectionHeading =
    activeTab === 'movies'
      ? 'Cinema Features'
      : activeTab === 'tv'
      ? 'Series & Anime Broadcasts'
      : activeTab === 'library'
      ? 'Saved Library'
      : 'Featured Bento Spotlight';

  return (
    <div className="space-y-10 pb-24 md:pb-14">
      {/* Contextual Filters & Feed Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              {sectionHeading}
            </h1>
            <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-zinc-400 tabular-nums">
              {items.length} {items.length === 1 ? 'Title' : 'Titles'} Available · {selectedGenre}
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleGenreBar}
              aria-expanded={showGenreBar}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150 min-h-[40px] whitespace-nowrap shrink-0 ${
                showGenreBar || selectedGenre !== 'All'
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-500/15'
                  : 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-emerald-500/40 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
              Filters {selectedGenre !== 'All' ? `· ${selectedGenre}` : ''}
            </button>

            <div
              role="group"
              aria-label="Sort media feed"
              className="inline-flex items-center rounded-xl border border-white/10 bg-zinc-900/85 p-1"
            >
              <button
                type="button"
                onClick={() => onChangeSort('recent')}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  sortBy === 'recent'
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Most Recently
              </button>
              <button
                type="button"
                onClick={() => onChangeSort('trending')}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  sortBy === 'trending'
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Trending
              </button>
              <button
                type="button"
                onClick={() => onChangeSort('rating')}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  sortBy === 'rating'
                    ? 'bg-emerald-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Top Rated
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Genre Filter Strip */}
        {showGenreBar && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            role="group"
            aria-label="Filter by genre"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
          >
            {GENRE_OPTIONS.map((genre) => {
              const active = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onSelectGenre(genre)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition-all min-h-[40px] whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Empty State Handling */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-12 text-center">
          <h2 className="font-display text-xl font-semibold text-white">
            {activeTab === 'library'
              ? 'Your Library is currently empty'
              : 'No titles match the active filter'}
          </h2>
          <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
            {activeTab === 'library'
              ? 'Save any movie, series, or anime to keep quick access to it across sessions.'
              : 'Adjust your genre selection or reset filters to explore the full catalog.'}
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
          >
            {activeTab === 'library' ? 'Browse All Titles' : 'Reset Filters'}
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP & TABLET ASYMMETRICAL BENTO-GRID + MOBILE STACKED FEATURED HERO */}
          <section aria-label="Dynamic Bento Spotlight">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Slot 0: Primary Featured Bento Card (Stacked vertical Bento on mobile, 3x2 Hero on desktop) */}
              {featuredItem && (
                <motion.article
                  whileHover={{ scale: 1.008 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => onHoverBackdrop(featuredItem.backdropUrl)}
                  onMouseLeave={() => onHoverBackdrop(null)}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 transition-colors duration-200 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/15 ${getBentoSlotClass(
                    0,
                    items.length
                  )}`}
                >
                  <ResilientImage
                    src={featuredItem.backdropUrl}
                    alt={featuredItem.title}
                    fallbackTitle={featuredItem.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Measured Contrast Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/55 to-transparent" />

                  <div className="relative z-10 flex h-full min-h-[360px] lg:min-h-[430px] flex-col justify-end p-6 sm:p-8">
                    {/* Unboxed Monospace Kicker */}
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-300 tabular-nums">
                      <span className="text-emerald-400 font-semibold">
                        {featuredItem.quality}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{featuredItem.year}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-zinc-100">
                        <Star className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                        {featuredItem.rating.toFixed(1)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{featuredItem.durationLabel}</span>
                    </div>

                    <h2 className="mt-2 font-display text-2xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                      {featuredItem.title}
                    </h2>

                    <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-zinc-300 line-clamp-2 sm:line-clamp-3">
                      {featuredItem.synopsis}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenTheater(featuredItem)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition-all duration-150 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 min-h-[44px] whitespace-nowrap shrink-0"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        Watch Now
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleWatchlist(featuredItem.id)}
                        aria-label={
                          watchlistIds.includes(featuredItem.id)
                            ? `Remove ${featuredItem.title} from Library`
                            : `Add ${featuredItem.title} to Library`
                        }
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium backdrop-blur-md transition-all duration-150 min-h-[44px] whitespace-nowrap shrink-0 ${
                          watchlistIds.includes(featuredItem.id)
                            ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                            : 'border-white/15 bg-black/50 text-zinc-200 hover:border-emerald-500/50 hover:text-white'
                        }`}
                      >
                        {watchlistIds.includes(featuredItem.id) ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-400" />
                            In Library
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-4 w-4" />
                            Watchlist
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.article>
              )}

              {/* Desktop / Tablet Secondary Asymmetrical Bento Slots */}
              {secondaryBentoItems.map((item, idx) => {
                const slotIndex = idx + 1;
                const isSaved = watchlistIds.includes(item.id);
                return (
                  <motion.article
                    key={item.id}
                    whileHover={{ scale: 1.015 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    onMouseEnter={() => onHoverBackdrop(item.backdropUrl)}
                    onMouseLeave={() => onHoverBackdrop(null)}
                    className={`hidden md:flex group relative flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 transition-colors duration-200 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/15 ${getBentoSlotClass(
                      slotIndex,
                      items.length
                    )}`}
                  >
                    <ResilientImage
                      src={slotIndex === 1 ? item.backdropUrl : item.posterUrl}
                      alt={item.title}
                      fallbackTitle={item.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/50 to-black/15" />

                    {/* Top Right Quick Save Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(item.id);
                      }}
                      aria-label={
                        isSaved
                          ? `Remove ${item.title} from Library`
                          : `Save ${item.title} to Library`
                      }
                      className={`absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all ${
                        isSaved
                          ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 bg-black/50 text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:border-emerald-500/50'
                      }`}
                    >
                      {isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                    </button>

                    {/* Primary Card Click Surface */}
                    <button
                      type="button"
                      onClick={() => onOpenTheater(item)}
                      className="relative z-10 flex h-full w-full flex-col justify-end p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
                    >
                      {/* Centered Watch Now pill overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <span className="flex items-center gap-2 rounded-full border border-emerald-400/60 bg-black/70 px-4 py-2 text-xs font-semibold text-emerald-300 backdrop-blur-md shadow-lg shadow-emerald-500/20">
                          <Play className="h-3.5 w-3.5 fill-current" />
                          Watch Now
                        </span>
                      </div>

                      <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-300 tabular-nums truncate">
                        <span className="text-emerald-400">{item.quality}</span> · {item.durationLabel}
                      </div>
                      <h3 className="mt-1 font-display text-lg font-bold text-white group-hover:text-emerald-200 transition-colors truncate">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-zinc-400 tabular-nums whitespace-nowrap truncate">
                        <span>{item.year} ·</span>
                        <Star className="h-3 w-3 fill-emerald-400 text-emerald-400 shrink-0" />
                        <span className="truncate">{item.rating.toFixed(1)} · {item.genres[0]}</span>
                      </p>
                    </button>
                  </motion.article>
                );
              })}
            </div>
          </section>

          {/* CONTINUE WATCHING PERSONALIZED PROGRESS SECTION */}
          {activeTab === 'home' && continueWatchingHydrated.length > 0 && (
            <section aria-label="Continue Watching">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-lg sm:text-xl font-semibold text-white">
                  Continue Watching
                </h2>
                <span className="font-mono text-xs uppercase text-zinc-400 tabular-nums">
                  {continueWatchingHydrated.length} Active
                </span>
              </div>

              {/* Touch-optimized horizontal scrollable list on mobile; 3-column Bento strip on desktop */}
              <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
                {continueWatchingHydrated.map(({ entry, media }) => {
                  const isSeries = media.kind === 'tv' || media.kind === 'anime';
                  return (
                    <button
                      key={media.id}
                      type="button"
                      onMouseEnter={() => onHoverBackdrop(media.backdropUrl)}
                      onMouseLeave={() => onHoverBackdrop(null)}
                      onClick={() => onOpenTheater(media, entry.season, entry.episode)}
                      className="group relative min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/75 text-left transition-all duration-150 hover:scale-[1.012] hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden">
                        <ResilientImage
                          src={media.backdropUrl}
                          alt={`Resume ${media.title}`}
                          fallbackTitle={media.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-black/40 to-transparent" />

                        <div className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/50 bg-black/70 text-emerald-400 backdrop-blur-md transition-transform duration-150 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-zinc-950">
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </span>
                        </div>

                        <div className="absolute bottom-3 left-4 right-4">
                          <div className="flex items-center justify-between text-xs font-mono uppercase text-zinc-300 tabular-nums mb-1.5">
                            <span>
                              {isSeries ? `S${entry.season}:E${entry.episode}` : 'Feature'}
                            </span>
                            <span className="text-emerald-400">
                              {entry.remainingMinutes}m left · {entry.progressPercent}%
                            </span>
                          </div>
                          {/* Emerald Progress Bar */}
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                              style={{ width: `${entry.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                            {media.title}
                          </h3>
                          <p className="mt-0.5 font-mono text-[11px] uppercase text-zinc-400 truncate">
                            {media.quality} · {media.directorOrStudio}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* MOBILE SERIALIZED HORIZONTAL CAROUSEL FOR TRENDING / SECONDARY ITEMS */}
          {items.length > 1 && (
            <section className="md:hidden" aria-label="Trending Series and Films">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold text-white">
                  Trending Series & Cinema
                </h2>
                <span className="font-mono text-xs uppercase text-emerald-400">
                  Swipe
                </span>
              </div>

              <div className="flex gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                {items.slice(1).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenTheater(item)}
                    className="group relative w-[152px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 text-left transition-all active:scale-[0.98] hover:border-emerald-500/50 min-h-[48px]"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden">
                      <ResilientImage
                        src={item.posterUrl}
                        alt={item.title}
                        fallbackTitle={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                      {/* Play circle overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/60 bg-black/70 text-emerald-400 backdrop-blur-md">
                          <Play className="h-4 w-4 fill-current ml-0.5" />
                        </span>
                      </div>

                      <div className="absolute bottom-2 left-2.5 right-2.5 font-mono text-[10px] uppercase text-emerald-400 tabular-nums">
                        {item.durationLabel}
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-semibold text-zinc-100 truncate group-hover:text-emerald-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-zinc-400 tabular-nums">
                        <span>{item.year} ·</span>
                        <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400 shrink-0" />
                        <span>{item.rating.toFixed(1)}</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* RECENTLY ADDED / HIGH-DENSITY COMPACT VERTICAL BENTO POSTERS (Desktop) */}
          {compactRecentItems.length > 0 && (
            <section className="hidden md:block" aria-label="Recently Added Catalog">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold text-white">
                  Recently Added & Deep Catalog
                </h2>
                <span className="font-mono text-xs uppercase text-zinc-400">
                  TMDB & AniList Indexed
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {compactRecentItems.map((item) => {
                  const isSaved = watchlistIds.includes(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      onMouseEnter={() => onHoverBackdrop(item.posterUrl)}
                      onMouseLeave={() => onHoverBackdrop(null)}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 transition-colors duration-150 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/15"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenTheater(item)}
                        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden">
                          <ResilientImage
                            src={item.posterUrl}
                            alt={item.title}
                            fallbackTitle={item.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-black/20" />

                          {/* Play overlay on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/70 bg-black/70 text-emerald-400 backdrop-blur-sm shadow-lg shadow-emerald-500/20 transition-transform duration-150 group-hover:scale-110">
                              <Play className="h-5 w-5 fill-current ml-0.5" />
                            </span>
                          </div>

                          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between font-mono text-[10px] uppercase text-zinc-300 tabular-nums">
                            <span>{item.quality}</span>
                            <span className="text-emerald-400">{item.durationLabel}</span>
                          </div>
                        </div>

                        <div className="p-3.5">
                          <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-emerald-300 transition-colors">
                            {item.title}
                          </h3>
                          <p className="mt-1 flex items-center gap-1 font-mono text-[11px] uppercase text-zinc-400 tabular-nums">
                            <span>{item.year} ·</span>
                            <Star className="h-3 w-3 fill-emerald-400 text-emerald-400 shrink-0" />
                            <span>{item.rating.toFixed(1)} · {item.sourceOrigin}</span>
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatchlist(item.id);
                        }}
                        aria-label={
                          isSaved
                            ? `Remove ${item.title} from Library`
                            : `Save ${item.title} to Library`
                        }
                        className={`absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-md transition-all ${
                          isSaved
                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                            : 'border-white/10 bg-black/60 text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:border-emerald-500/50'
                        }`}
                      >
                        {isSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
