import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Download,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Tv2,
  Wifi,
} from 'lucide-react';
import { EmbedProviderId, MediaItem, WatchProgress } from '../types/media';
import { resolveEmbedUrl } from '../utils/mediaLogic';
import { ResilientImage } from './ResilientImage';
import { useAuth } from '../context/AuthContext';
import { DownloadModal } from './DownloadModal';

interface TheaterModeProps {
  media: MediaItem;
  initialSeason?: number;
  initialEpisode?: number;
  initialProgressPercent?: number;
  preferredResolver: EmbedProviderId;
  isWatchlisted: boolean;
  onToggleWatchlist: (mediaId: string) => void;
  onUpdateProgress: (update: Omit<WatchProgress, 'updatedAt'>) => void;
  onCloseTheater: () => void;
  onRequestAuth: () => void;
}

// Live streaming resolvers — VidLink primary, two active mirrors
const RESOLVER_OPTIONS: { id: EmbedProviderId; label: string; badge?: string }[] = [
  { id: 'vidlink',  label: 'VidLink',   badge: 'PRIMARY'  },
  { id: 'vidsrc',   label: 'VidSrc Party', badge: 'MIRROR 1' },
  { id: 'twoembed', label: 'EmbedSU',   badge: 'MIRROR 2' },
];

/** Normalize preferredResolver — fall back to vidlink if 'preview' (legacy). */
function getInitialResolver(preferred: EmbedProviderId): EmbedProviderId {
  return preferred === 'preview' ? 'vidlink' : preferred;
}

export const TheaterMode: React.FC<TheaterModeProps> = ({
  media,
  initialSeason = 1,
  initialEpisode = 1,
  initialProgressPercent = 18,
  preferredResolver,
  isWatchlisted,
  onToggleWatchlist,
  onUpdateProgress,
  onCloseTheater,
  onRequestAuth,
}) => {
  const { user } = useAuth();

  const [activeResolver, setActiveResolver] = useState<EmbedProviderId>(
    getInitialResolver(preferredResolver)
  );
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode);
  const [activeMetaTab, setActiveMetaTab] = useState<'episodes' | 'details'>(
    media.seasons && media.seasons.length > 0 ? 'episodes' : 'details'
  );
  const [progressPercent, setProgressPercent] = useState(initialProgressPercent);
  const [iframeKey, setIframeKey] = useState(0); // increment to force reload
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);

  const hasSeasons = Boolean(media.seasons && media.seasons.length > 0);
  const currentSeasonObj =
    media.seasons?.find((s) => s.seasonNumber === selectedSeason) || media.seasons?.[0];
  const currentEpisodeObj =
    currentSeasonObj?.episodes.find((ep) => ep.number === selectedEpisode) ||
    currentSeasonObj?.episodes[0];

  const resolvedIframeUrl = resolveEmbedUrl(
    media,
    activeResolver,
    selectedSeason,
    selectedEpisode
  );

  // Persist progress on mount
  const commitProgress = (
    nextPercent: number,
    seasonNum = selectedSeason,
    epNum = selectedEpisode
  ) => {
    const totalMinutes = currentEpisodeObj?.durationMinutes || 155;
    const remainingMinutes = Math.max(1, Math.round(totalMinutes * (1 - nextPercent / 100)));
    onUpdateProgress({
      mediaId: media.id,
      season: seasonNum,
      episode: epNum,
      progressPercent: nextPercent,
      remainingMinutes,
    });
  };

  useEffect(() => {
    commitProgress(progressPercent, selectedSeason, selectedEpisode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id]);

  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      playerContainerRef.current.requestFullscreen?.().catch(() => {});
    }
  };

  const handleResolverSwitch = (id: EmbedProviderId) => {
    setActiveResolver(id);
    setIframeKey((k) => k + 1); // force fresh iframe load on server switch
  };

  const handleEpisodeSelect = (epNum: number) => {
    setSelectedEpisode(epNum);
    setProgressPercent(12);
    setIframeKey((k) => k + 1);
    commitProgress(12, selectedSeason, epNum);
  };

  const handleSeasonSelect = (seasonNum: number) => {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(1);
    setProgressPercent(8);
    setIframeKey((k) => k + 1);
    commitProgress(8, seasonNum, 1);
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      aria-label={`Theater Mode: ${media.title}`}
      className="relative min-h-screen w-full bg-[#050507] text-zinc-100 pb-24 md:pb-16"
    >
      {/* Ambient Emerald Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-12 mx-auto h-[420px] max-w-5xl rounded-full bg-emerald-500/15 blur-[130px]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8 pt-6">

        {/* ── Top Control Strip ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          {/* Back button */}
          <button
            type="button"
            onClick={() => { commitProgress(progressPercent); onCloseTheater(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all duration-150 hover:border-emerald-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-emerald-400" />
            Back to Browse
          </button>

          {/* Right-side controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Server switcher ── */}
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-xs uppercase text-zinc-400 whitespace-nowrap">
                <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-400" />
                Server
              </span>
              <div
                role="group"
                aria-label="Video stream server"
                className="inline-flex items-center rounded-xl border border-white/10 bg-zinc-900/90 p-1 gap-0.5"
              >
                {RESOLVER_OPTIONS.map((opt) => {
                  const active = activeResolver === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleResolverSwitch(opt.id)}
                      title={opt.badge}
                      className={`relative px-3 py-1.5 rounded-lg font-mono text-xs uppercase transition-all whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-emerald-500 text-zinc-950 font-semibold shadow-sm shadow-emerald-500/30'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      {opt.label}
                      {active && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reload iframe */}
            <button
              type="button"
              onClick={() => setIframeKey((k) => k + 1)}
              aria-label="Reload player"
              title="Reload player"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 text-zinc-400 transition-all hover:border-emerald-500/40 hover:text-emerald-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {/* Watchlist toggle */}
            <button
              type="button"
              onClick={() => onToggleWatchlist(media.id)}
              aria-label={isWatchlisted ? 'Remove from Library' : 'Save to Library'}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
                isWatchlisted
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-emerald-500/40'
              }`}
            >
              {isWatchlisted ? (
                <><Check className="h-3.5 w-3.5 text-emerald-400" />Saved</>
              ) : (
                <><Bookmark className="h-3.5 w-3.5" />Save</>
              )}
            </button>

            {/* Download HD — opens DownloadModal (auth gated) */}
            <button
              type="button"
              onClick={() => {
                if (!user) { onRequestAuth(); return; }
                setShowDownloadModal(true);
              }}
              aria-label={user ? 'Download HD' : 'Sign in to download'}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition-all whitespace-nowrap shrink-0 min-h-[38px] hover:bg-emerald-500/25 hover:text-emerald-200"
            >
              <Download className="h-3.5 w-3.5" />
              {user ? 'Download HD' : 'Sign In to Download'}
            </button>
          </div>
        </div>

        {/* ── 16:9 Live Streaming Player ── */}
        <div
          ref={playerContainerRef}
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl shadow-emerald-500/10"
        >
          {resolvedIframeUrl ? (
            <>
              {/* Live iframe — key changes force a clean reload on server/episode switch */}
              <iframe
                key={`${iframeKey}-${resolvedIframeUrl}`}
                src={resolvedIframeUrl}
                title={`${media.title}${hasSeasons ? ` — S${selectedSeason}E${selectedEpisode}` : ''} · ${activeResolver.toUpperCase()}`}
                className="w-full h-full border-0 rounded-xl bg-black"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
              />

              {/* Status badge — TOP-LEFT so it never covers native video controls */}
              <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 font-mono text-[10px] uppercase text-emerald-400 backdrop-blur-sm">
                  <Wifi className="h-2.5 w-2.5" />
                  {activeResolver === 'vidlink' ? 'VIDLINK' : activeResolver === 'vidsrc' ? 'VIDSRC PARTY' : 'EMBEDSU'} · LIVE
                  {hasSeasons ? ` · S${selectedSeason}:E${selectedEpisode}` : ''}
                </span>
              </div>
            </>
          ) : (
            /* No external ID available — show friendly prompt */
            <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
              <ResilientImage
                src={media.backdropUrl}
                alt={media.title}
                fallbackTitle={media.title}
                className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-zinc-950/40" />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                  <Tv2 className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-white">
                    No TMDB ID available
                  </p>
                  <p className="mt-1.5 max-w-xs text-sm text-zinc-400">
                    This title came from the local seed catalog and doesn't have a TMDB ID yet.
                    Search for it by name to find the live version with streaming support.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {RESOLVER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleResolverSwitch(opt.id)}
                      className={`rounded-xl border px-3 py-1.5 font-mono text-xs uppercase transition-all ${
                        activeResolver === opt.id
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Title + Meta ── */}
        <div className="mt-7 flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-400 tabular-nums">
              <span className="text-emerald-400 font-semibold">{media.quality}</span>
              <span aria-hidden="true">·</span>
              <span>{media.year}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-zinc-200">
                <Star className="h-3 w-3 fill-emerald-400 text-emerald-400" />
                {media.rating.toFixed(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{media.durationLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{media.genres.join(' / ')}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
              {media.title}
            </h1>
            {currentEpisodeObj && hasSeasons && (
              <p className="mt-1 font-mono text-xs uppercase text-emerald-400">
                Now Playing: Season {selectedSeason} · Episode {selectedEpisode} — "{currentEpisodeObj.title}"
              </p>
            )}
          </div>

          {/* Metadata tabs */}
          <div
            role="tablist"
            aria-label="Media information tabs"
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-900/80 p-1 self-start"
          >
            {hasSeasons && (
              <button
                type="button"
                role="tab"
                aria-selected={activeMetaTab === 'episodes'}
                onClick={() => setActiveMetaTab('episodes')}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  activeMetaTab === 'episodes'
                    ? 'bg-zinc-800 text-emerald-300'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Episodes ({currentSeasonObj?.episodes.length || 0})
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={activeMetaTab === 'details'}
              onClick={() => setActiveMetaTab('details')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeMetaTab === 'details'
                  ? 'bg-zinc-800 text-emerald-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Synopsis & Credits
            </button>
          </div>
        </div>

        {/* ── Tab Panels ── */}
        <div className="mt-6">
          {activeMetaTab === 'episodes' && hasSeasons && currentSeasonObj ? (
            <div>
              {/* Season selector */}
              {media.seasons && media.seasons.length > 1 && (
                <div className="mb-5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs uppercase text-zinc-400 mr-2">
                    Season:
                  </span>
                  {media.seasons.map((season) => {
                    const isCurrent = season.seasonNumber === selectedSeason;
                    return (
                      <button
                        key={season.seasonNumber}
                        type="button"
                        onClick={() => handleSeasonSelect(season.seasonNumber)}
                        className={`rounded-lg border px-3.5 py-1.5 font-mono text-xs uppercase transition-all whitespace-nowrap ${
                          isCurrent
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                            : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {season.title}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Episode cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {currentSeasonObj.episodes.map((ep) => {
                  const isActiveEp = ep.number === selectedEpisode;
                  return (
                    <button
                      key={ep.number}
                      type="button"
                      onClick={() => handleEpisodeSelect(ep.number)}
                      className={`group flex items-start justify-between gap-4 rounded-xl border p-4 text-left transition-all duration-150 ${
                        isActiveEp
                          ? 'border-emerald-500/60 bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                          : 'border-white/10 bg-zinc-900/50 hover:border-emerald-500/40 hover:bg-zinc-900/90'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-xs uppercase text-zinc-400 tabular-nums">
                          <span className={isActiveEp ? 'text-emerald-400 font-semibold' : ''}>
                            EPISODE {String(ep.number).padStart(2, '0')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ep.durationMinutes}m</span>
                          <span aria-hidden="true">·</span>
                          <span>{ep.airDate}</span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                          {ep.title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 line-clamp-2">
                          {ep.synopsis}
                        </p>
                      </div>
                      <span
                        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isActiveEp
                            ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                            : 'border-white/10 bg-zinc-950 text-zinc-400 group-hover:border-emerald-500/50 group-hover:text-emerald-300'
                        }`}
                      >
                        <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 rounded-2xl border border-white/10 bg-zinc-900/40 p-6">
              <div className="lg:col-span-2">
                <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                  Storyline
                </h2>
                <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-zinc-200 max-w-2xl">
                  {media.synopsis}
                </p>
              </div>

              <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
                <div>
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    Director / Studio
                  </span>
                  <span className="mt-1 block text-sm font-medium text-zinc-200">
                    {media.directorOrStudio}
                  </span>
                </div>

                {media.cast.length > 0 && (
                  <div>
                    <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      Principal Cast
                    </span>
                    <span className="mt-1 block text-sm text-zinc-300">
                      {media.cast.join(' · ')}
                    </span>
                  </div>
                )}

                <div>
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    Catalog Identifier
                  </span>
                  <span className="mt-1 block font-mono text-xs text-emerald-400 tabular-nums">
                    {media.sourceOrigin} · {media.tmdbId ? `TMDB-${media.tmdbId}` : `AL-${media.anilistId ?? 'N/A'}`}
                  </span>
                </div>

                {/* Active stream info */}
                <div>
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    Active Stream
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {activeResolver === 'vidlink' ? 'VIDLINK' : activeResolver === 'vidsrc' ? 'VIDSRC PARTY' : 'EMBEDSU'} · {resolvedIframeUrl ? 'LIVE' : 'NO ID'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Download Modal ── */}
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title={media.title}
        posterUrl={media.posterUrl}
        mediaId={String(media.tmdbId ?? media.imdbId ?? '')}
        mediaType={media.kind === 'anime' ? 'tv' : media.kind}
        season={selectedSeason}
        episode={selectedEpisode}
        episodeTitle={currentEpisodeObj?.title}
      />
    </motion.section>
  );
};
