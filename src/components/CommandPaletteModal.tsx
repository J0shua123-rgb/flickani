import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, CornerDownLeft, Search, Star, X } from 'lucide-react';
import { MediaItem } from '../types/media';
import { searchMediaCatalog } from '../utils/mediaLogic';
import { ResilientImage } from './ResilientImage';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onSelectMedia,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(searchMediaCatalog(catalog, ''));
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen, catalog]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    const instantLocal = searchMediaCatalog(catalog, trimmed);
    setResults(instantLocal);
    setSelectedIndex(0);

    if (trimmed.length < 2) {
      setIsLoadingRemote(false);
      return;
    }

    let cancelled = false;
    setIsLoadingRemote(true);

    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) throw new Error('Search request failed');
        const data = await res.json();
        if (!cancelled && Array.isArray(data.results)) {
          setResults(data.results);
          setSelectedIndex(0);
        }
      } catch {
        // Keep instant local matches on network error
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [query, catalog, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
      return;
    }
    if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectMedia(results[selectedIndex]);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 md:pt-20 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Spotlight Media Search"
          onKeyDown={handleKeyDown}
        >
          {/* Dimmed Obsidian Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Floating Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 shadow-2xl shadow-emerald-500/10"
          >
            {/* Ambient Emerald Top Hairline */}
            <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

            {/* Search Input Header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <Search className="h-5 w-5 text-emerald-400 shrink-0" />
              <label htmlFor="spotlight-search-input" className="sr-only">
                Search movies, series, and anime
              </label>
              <input
                ref={inputRef}
                id="spotlight-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies, series, or anime (TMDB & AniList)..."
                autoComplete="off"
                className="w-full bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              {isLoadingRemote && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400/80 whitespace-nowrap shrink-0">
                  Syncing
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-emerald-500/40 hover:text-zinc-100 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results Area: Minimal Vertical Cards Grid */}
            <div className="max-h-[65vh] overflow-y-auto p-5">
              <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono uppercase tracking-wider">
                  {query.trim() ? `Matches (${results.length})` : 'Trending Spotlight'}
                </span>
                <span className="hidden sm:inline font-mono text-[11px] text-zinc-500">
                  Use Arrow Keys to navigate · Enter to open Theater
                </span>
              </div>

              {results.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    No titles matched “{query}”
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Try searching for Avatar, Severance, Blade Runner, or anime titles like Cowboy Bebop.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {results.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => {
                          onSelectMedia(item);
                          onClose();
                        }}
                        className={`group relative flex flex-col text-left rounded-xl overflow-hidden border transition-all duration-150 focus:outline-none ${
                          isSelected
                            ? 'border-emerald-400/70 bg-zinc-900 shadow-lg shadow-emerald-500/20 scale-[1.015]'
                            : 'border-white/10 bg-zinc-900/50 hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
                          <ResilientImage
                            src={item.posterUrl}
                            alt={`${item.title} poster`}
                            fallbackTitle={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

                          {/* Unboxed Monospace Technical Metadata */}
                          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-300 tabular-nums">
                            <span>{item.quality}</span>
                            <span className="text-emerald-400">{item.durationLabel}</span>
                          </div>
                        </div>

                        <div className="p-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-100 truncate">
                              {item.title}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] uppercase text-zinc-400 tabular-nums truncate">
                              <span>{item.year} ·</span>
                              <Star className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400 shrink-0" />
                              <span>{item.rating.toFixed(1)} · {item.sourceOrigin}</span>
                            </p>
                          </div>
                          <ArrowUpRight
                            className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                              isSelected ? 'text-emerald-400' : 'text-zinc-600'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Keyboard Hints */}
            <div className="flex items-center justify-between border-t border-white/10 bg-zinc-950 px-5 py-2.5 text-[11px] font-mono text-zinc-500">
              <span>TMDB + ANILIST LIVE INDEX</span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <CornerDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                OPEN IN THEATER
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
