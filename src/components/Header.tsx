import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogIn, LogOut, Search, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NavTab } from '../types/media';

interface HeaderProps {
  onLogoClick: () => void;
  onOpenSearch: () => void;
  onOpenAuth: () => void;
  activeTab: NavTab;
  watchlistCount: number;
}

/**
 * Derives a short display name from Google metadata or email.
 * Falls back to the first letter of the email as an avatar monogram.
 */
function getDisplayName(metadata: Record<string, unknown>, email?: string): string {
  const full = metadata?.full_name as string | undefined;
  if (full) return full.split(' ')[0]; // First name only
  if (email) return email.split('@')[0];
  return 'User';
}

function getAvatarUrl(metadata: Record<string, unknown>): string | null {
  return (metadata?.avatar_url as string) ?? (metadata?.picture as string) ?? null;
}

function getMonogram(metadata: Record<string, unknown>, email?: string): string {
  const full = metadata?.full_name as string | undefined;
  if (full) return full[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return 'U';
}

export const Header: React.FC<HeaderProps> = ({
  onLogoClick,
  onOpenSearch,
  onOpenAuth,
  watchlistCount,
}) => {
  const { user, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const meta = user?.user_metadata ?? {};
  const avatarUrl = !avatarError ? getAvatarUrl(meta) : null;
  const displayName = getDisplayName(meta, user?.email);
  const monogram = getMonogram(meta, user?.email);
  const email = user?.email ?? '';

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 sm:gap-8 border-b border-white/10 bg-[#09090b]/85 px-4 sm:px-8 py-3.5 backdrop-blur-xl h-[60px]">

      {/* ── Zone 1: Brand wordmark ── */}
      <a
        href="#top"
        onClick={(e) => { e.preventDefault(); onLogoClick(); }}
        className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-emerald-300 transition-colors"
      >
        Obsidian Theater
      </a>

      {/* ── Zone 2: Floating Cmd+K search bar (desktop) ── */}
      <div className="hidden sm:flex flex-1 justify-center max-w-md mx-auto">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search movies, series, and anime (Ctrl+K)"
          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2 text-xs text-zinc-400 shadow-lg shadow-black/30 transition-all duration-150 hover:border-emerald-500/50 hover:text-zinc-200 whitespace-nowrap"
        >
          <span className="inline-flex items-center gap-2.5 truncate">
            <Search className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Search titles, anime, studios...</span>
          </span>
          <kbd className="rounded border border-white/10 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-400 shrink-0">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* ── Zone 3: Auth / User profile ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile search icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open Search"
          className="sm:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 text-zinc-200 hover:border-emerald-500/50 transition-colors"
        >
          <Search className="h-4 w-4 text-emerald-400" />
        </button>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="h-9 w-24 animate-pulse rounded-xl bg-zinc-800" />
        )}

        {/* ── Signed-in profile pill ── */}
        {!loading && user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((p) => !p)}
              aria-label="Open user menu"
              aria-expanded={dropdownOpen}
              className="group flex items-center gap-2.5 rounded-xl border border-white/15 bg-zinc-900/90 pl-1 pr-3 py-1 transition-all duration-150 hover:border-emerald-500/50 hover:bg-zinc-800/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {/* Avatar */}
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-emerald-500/40">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    {monogram}
                  </div>
                )}
                {/* Online dot */}
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-zinc-900 bg-emerald-400" />
              </div>

              {/* Name */}
              <span className="hidden sm:block max-w-[96px] truncate text-xs font-semibold text-zinc-100">
                {displayName}
              </span>

              {/* Chevron */}
              <ChevronDown
                className={`hidden sm:block h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <>
                  {/* Click-away overlay */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 z-20 w-64 overflow-hidden rounded-xl border border-white/15 bg-zinc-950 shadow-2xl shadow-black/60"
                  >
                    {/* Ambient hairline */}
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

                    {/* User info block */}
                    <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-emerald-500/40">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-emerald-500/20 text-sm font-bold text-emerald-300">
                            {monogram}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {(meta?.full_name as string) || displayName}
                        </p>
                        <p className="truncate font-mono text-[11px] text-zinc-500">
                          {email}
                        </p>
                      </div>
                    </div>

                    {/* Watchlist count */}
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                      <span className="font-mono text-[11px] uppercase text-zinc-500">Library</span>
                      <span className="font-mono text-xs font-semibold text-emerald-400">
                        {watchlistCount} saved
                      </span>
                    </div>

                    {/* Profile link */}
                    <button
                      type="button"
                      onClick={() => { setDropdownOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white"
                    >
                      <User className="h-4 w-4 text-zinc-500" />
                      My Profile
                    </button>

                    {/* Sign out */}
                    <button
                      type="button"
                      onClick={async () => {
                        setDropdownOpen(false);
                        await signOut();
                      }}
                      className="flex w-full items-center gap-2.5 border-t border-white/10 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Guest: Sign In button ── */}
        {!loading && !user && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 hover:text-emerald-200 whitespace-nowrap"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
