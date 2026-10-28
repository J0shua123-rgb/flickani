/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SEED_MEDIA_CATALOG } from './data/seedCatalog';
import {
  GenreFilter,
  MediaItem,
  NavTab,
  SortMode,
  UserProfile,
  WatchProgress,
} from './types/media';
import { filterAndSortMedia, upsertWatchProgress } from './utils/mediaLogic';
import { fetchTrending } from './services/tmdb';
import { NavigationRail } from './components/NavigationRail';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { BentoDashboard } from './components/BentoDashboard';
import { TheaterMode } from './components/TheaterMode';
import { ProfileSettingsPanel } from './components/ProfileSettingsPanel';
import { AuthModal } from './components/AuthModal';
import { Header } from './components/Header';
import { AuthProvider, useAuth } from './context/AuthContext';

interface ActiveTheaterState {
  media: MediaItem;
  season?: number;
  episode?: number;
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'usr-obsidian-01',
  displayName: 'Kaelen Vance',
  handle: '@kaelen',
  email: 'kaelen.vance@obsidian.cinema',
  preferredResolver: 'vidlink',
  autoplayNext: true,
  ambientLighting: true,
};

const INITIAL_PROGRESS: WatchProgress[] = [
  { mediaId: 'tmdb-76600', season: 1, episode: 1, progressPercent: 68, remainingMinutes: 58, updatedAt: '2026-10-24T17:45:00Z' },
  { mediaId: 'tmdb-95396', season: 2, episode: 1, progressPercent: 42, remainingMinutes: 31, updatedAt: '2026-10-24T09:20:00Z' },
  { mediaId: 'anilist-105398', season: 1, episode: 2, progressPercent: 81, remainingMinutes: 5, updatedAt: '2026-10-23T22:10:00Z' },
];

// --------------------------------------------------------------------------
// Inner App — accesses AuthContext
// --------------------------------------------------------------------------
function AppInner() {
  const { signOut } = useAuth();

  const [catalog, setCatalog] = useState<MediaItem[]>(SEED_MEDIA_CATALOG);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(['tmdb-76600', 'tmdb-95396', 'anilist-105398', 'tmdb-335984']);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>(INITIAL_PROGRESS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedGenre, setSelectedGenre] = useState<GenreFilter>('All');
  const [sortBy, setSortBy] = useState<SortMode>('trending');
  const [showGenreBar, setShowGenreBar] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [hoveredBackdrop, setHoveredBackdrop] = useState<string | null>(null);
  const [theaterState, setTheaterState] = useState<ActiveTheaterState | null>(null);

  // ── Hydrate from backend + live TMDB ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // 1) Hydrate persisted user state from Express/Supabase
    fetch('/api/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        if (Array.isArray(data.items) && data.items.length > 0) setCatalog(data.items);
        if (Array.isArray(data.watchlistIds)) setWatchlistIds(data.watchlistIds);
        if (Array.isArray(data.progress)) setContinueWatching(data.progress);
        if (data.profile) setProfile(data.profile);
      })
      .catch(() => {});

    // 2) Merge live TMDB trending into catalog (de-duplicated by tmdbId)
    fetchTrending().then((liveItems) => {
      if (!mounted || liveItems.length === 0) return;
      setCatalog((prev) => {
        const existingTmdbIds = new Set(prev.map((m) => m.tmdbId).filter(Boolean));
        const fresh = liveItems.filter((m) => m.tmdbId && !existingTmdbIds.has(m.tmdbId));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    });

    return () => { mounted = false; };
  }, []);

  // ── Global Cmd+K shortcut ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredItems = useMemo(
    () => filterAndSortMedia(catalog, { tab: activeTab, genre: selectedGenre, sortBy, watchlistIds }),
    [catalog, activeTab, selectedGenre, sortBy, watchlistIds]
  );

  const handleOpenTheater = useCallback((item: MediaItem, season?: number, episode?: number) => {
    setCatalog((prev) => prev.some((m) => m.id === item.id) ? prev : [item, ...prev]);
    const saved = continueWatching.find((p) => p.mediaId === item.id);
    setTheaterState({ media: item, season: season ?? saved?.season ?? 1, episode: episode ?? saved?.episode ?? 1 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [continueWatching]);

  const handleToggleWatchlist = useCallback(async (mediaId: string) => {
    setWatchlistIds((prev) =>
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [mediaId, ...prev]
    );
    try {
      const res = await fetch('/api/watchlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.watchlistIds)) setWatchlistIds(data.watchlistIds);
      }
    } catch { /* optimistic state kept */ }
  }, []);

  const handleUpdateProgress = useCallback(async (update: Omit<WatchProgress, 'updatedAt'>) => {
    setContinueWatching((prev) => upsertWatchProgress(prev, update));
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.progress)) setContinueWatching(data.progress);
      }
    } catch { /* optimistic */ }
  }, []);

  const handleSaveProfile = useCallback(async (updated: Partial<UserProfile>): Promise<boolean> => {
    setProfile((prev) => ({ ...prev, ...updated }));
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) setProfile(data.profile);
        return true;
      }
    } catch { /* optimistic */ }
    return true;
  }, []);

  const activeTheaterProgress = theaterState
    ? continueWatching.find((p) => p.mediaId === theaterState.media.id)?.progressPercent ?? 18
    : 18;

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-100">
      {/* Ambient emerald glow */}
      {profile.ambientLighting && !theaterState && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -top-32 left-1/4 h-[460px] w-[620px] rounded-full bg-emerald-500/12 blur-[140px]" />
          <div className="absolute top-[40%] right-10 h-[380px] w-[440px] rounded-full bg-emerald-400/8 blur-[130px]" />
          <AnimatePresence>
            {hoveredBackdrop && (
              <motion.img
                key={hoveredBackdrop}
                src={hoveredBackdrop}
                alt=""
                referrerPolicy="no-referrer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.16 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 h-full w-full object-cover blur-3xl scale-110"
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {!theaterState && (
        <NavigationRail
          activeTab={activeTab}
          onSelectTab={(tab) => { setActiveTab(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onOpenSearch={() => setIsSearchOpen(true)}
          watchlistCount={watchlistIds.length}
        />
      )}

      <AnimatePresence mode="wait">
        {theaterState ? (
          <TheaterMode
            key={`theater-${theaterState.media.id}`}
            media={theaterState.media}
            initialSeason={theaterState.season}
            initialEpisode={theaterState.episode}
            initialProgressPercent={activeTheaterProgress}
            preferredResolver={profile.preferredResolver}
            isWatchlisted={watchlistIds.includes(theaterState.media.id)}
            onToggleWatchlist={handleToggleWatchlist}
            onUpdateProgress={handleUpdateProgress}
            onCloseTheater={() => setTheaterState(null)}
            onRequestAuth={() => setIsAuthOpen(true)}
          />
        ) : (
          <motion.div
            key="bento-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 md:pl-20"
          >
            {/* Top Bar */}
            <Header
              onLogoClick={() => setActiveTab('home')}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenAuth={() => setIsAuthOpen(true)}
              activeTab={activeTab}
              watchlistCount={watchlistIds.length}
            />

            <main className="mx-auto max-w-[1360px] px-4 sm:px-8 pt-6">
              {activeTab === 'profile' ? (
                <ProfileSettingsPanel
                  profile={profile}
                  watchlistCount={watchlistIds.length}
                  continueWatchingCount={continueWatching.length}
                  onSaveProfile={handleSaveProfile}
                />
              ) : (
                <BentoDashboard
                  activeTab={activeTab}
                  items={filteredItems}
                  allCatalog={catalog}
                  continueWatching={continueWatching}
                  watchlistIds={watchlistIds}
                  selectedGenre={selectedGenre}
                  sortBy={sortBy}
                  showGenreBar={showGenreBar}
                  onToggleGenreBar={() => setShowGenreBar((p) => !p)}
                  onSelectGenre={(g) => setSelectedGenre(g)}
                  onChangeSort={(s) => setSortBy(s)}
                  onHoverBackdrop={(url) => setHoveredBackdrop(url)}
                  onOpenTheater={handleOpenTheater}
                  onToggleWatchlist={handleToggleWatchlist}
                  onResetFilters={() => {
                    if (activeTab === 'library') setActiveTab('home');
                    setSelectedGenre('All');
                    setSortBy('trending');
                  }}
                />
              )}
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Spotlight Search */}
      <CommandPaletteModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        catalog={catalog}
        onSelectMedia={(item) => { handleOpenTheater(item); setIsSearchOpen(false); }}
      />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Root export — wraps everything in AuthProvider
// --------------------------------------------------------------------------
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
