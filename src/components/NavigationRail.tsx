import React from 'react';
import {
  Bookmark,
  Clapperboard,
  Home,
  Search,
  Tv,
  User,
} from 'lucide-react';
import { NavTab } from '../types/media';

interface NavigationRailProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  watchlistCount: number;
}

const DESKTOP_NAV_ITEMS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tv', label: 'Series & Anime', icon: Tv },
  { id: 'movies', label: 'Movies', icon: Clapperboard },
  { id: 'library', label: 'Library', icon: Bookmark },
  { id: 'profile', label: 'Profile', icon: User },
];

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  onSelectTab,
  onOpenSearch,
  watchlistCount,
}) => {
  return (
    <>
      {/* Desktop Left Vertical Icon Rail */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-20 flex-col items-center justify-between py-6 bg-[#09090b]/90 backdrop-blur-xl border-r border-white/10"
      >
        {/* Brand Monogram */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-label="Obsidian Theater Home"
          className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/90 text-emerald-400 transition-all duration-150 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span className="font-display text-lg font-bold tracking-tight">O</span>
        </button>

        {/* Core Navigation Icons */}
        <nav className="flex flex-col items-center gap-3">
          {DESKTOP_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                title={label}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/20'
                    : 'border-transparent text-zinc-400 hover:border-white/10 hover:bg-zinc-900/70 hover:text-zinc-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {id === 'library' && watchlistCount > 0 && (
                  <span className="sr-only">({watchlistCount} saved)</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Search Trigger */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open Spotlight Search"
          title="Search Catalog (Cmd+K)"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/60 text-zinc-400 transition-all duration-150 hover:border-emerald-500/50 hover:text-emerald-300 hover:shadow-lg hover:shadow-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Search className="h-4 w-4" />
        </button>
      </aside>

      {/* Mobile Compact Bottom Tab Bar (<= 15% viewport height cap: 60px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-[#09090b]/95 backdrop-blur-xl border-t border-white/10 grid grid-cols-4 items-center px-2"
      >
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
            activeTab === 'home' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Home
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Search
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('library')}
          aria-current={activeTab === 'library' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
            activeTab === 'library' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Bookmark className="h-5 w-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Library
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
            activeTab === 'profile' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Profile
          </span>
        </button>
      </nav>
    </>
  );
};
