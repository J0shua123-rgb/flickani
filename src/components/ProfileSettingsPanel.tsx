import React, { useState } from 'react';
import { Check, ShieldCheck, Sliders, User } from 'lucide-react';
import { EmbedProviderId, UserProfile } from '../types/media';

interface ProfileSettingsPanelProps {
  profile: UserProfile;
  watchlistCount: number;
  continueWatchingCount: number;
  onSaveProfile: (updated: Partial<UserProfile>) => Promise<boolean>;
}

export const ProfileSettingsPanel: React.FC<ProfileSettingsPanelProps> = ({
  profile,
  watchlistCount,
  continueWatchingCount,
  onSaveProfile,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [preferredResolver, setPreferredResolver] = useState<EmbedProviderId>(
    profile.preferredResolver
  );
  const [autoplayNext, setAutoplayNext] = useState(profile.autoplayNext);
  const [ambientLighting, setAmbientLighting] = useState(profile.ambientLighting);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('Display name is required.');
      return;
    }
    setErrorMsg(null);
    const ok = await onSaveProfile({
      displayName: displayName.trim(),
      preferredResolver,
      autoplayNext,
      ambientLighting,
    });
    if (ok) {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              {profile.displayName}
            </h1>
            <p className="font-mono text-xs text-zinc-400 mt-0.5 tabular-nums">
              {profile.handle} · {watchlistCount} Saved Titles · {continueWatchingCount} Active Streams
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Profile Synced
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="profile-display-name"
              className="block text-xs font-medium text-zinc-300 mb-2"
            >
              Viewer Display Name
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
            {errorMsg && (
              <p role="alert" className="mt-1.5 text-xs text-red-400">
                {errorMsg}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="default-resolver-select"
              className="block text-xs font-medium text-zinc-300 mb-2"
            >
              Default Theater Stream Resolver
            </label>
            <select
              id="default-resolver-select"
              value={preferredResolver}
              onChange={(e) => setPreferredResolver(e.target.value as EmbedProviderId)}
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="vidlink">VidLink (Primary · Cleanest)</option>
              <option value="vidsrc">VidSrc (Mirror 1 · Reliable)</option>
              <option value="twoembed">2Embed (Mirror 2 · Backup)</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
            <Sliders className="h-3.5 w-3.5 text-emerald-400" />
            Playback & Atmosphere Preferences
          </div>

          <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
            <div>
              <span className="block text-sm font-medium text-zinc-200">
                Dynamic Ambient Emerald Lighting
              </span>
              <span className="block text-xs text-zinc-400">
                Illuminate the obsidian backdrop dynamically from hovered Bento posters.
              </span>
            </div>
            <input
              type="checkbox"
              checked={ambientLighting}
              onChange={(e) => setAmbientLighting(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-500"
            />
          </label>

          <div className="border-t border-white/10 pt-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer py-1">
              <div>
                <span className="block text-sm font-medium text-zinc-200">
                  Autoplay Next Episode in Theater
                </span>
                <span className="block text-xs text-zinc-400">
                  Automatically queue the next episode for TV series and anime.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoplayNext}
                onChange={(e) => setAutoplayNext(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            Save Preferences
          </button>

          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <Check className="h-4 w-4" />
              Preferences updated
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
