import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { ResilientImage } from './ResilientImage';
import { supabase } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Quality = '1080p' | '720p' | '480p';

interface QualityOption {
  id: Quality;
  label: string;
  badge: string;
  size: string;
  bitrate: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  { id: '1080p', label: '1080p', badge: 'FULL HD', size: '~1.5 GB', bitrate: '8 Mbps' },
  { id: '720p',  label: '720p',  badge: 'HD',      size: '~700 MB', bitrate: '4 Mbps' },
  { id: '480p',  label: '480p',  badge: 'SD',      size: '~350 MB', bitrate: '2 Mbps' },
];

// Pipeline phases:
// idle -> saving (Supabase) -> resolving (extract mp4 URL) -> downloading (blob) -> done | fallback | error
type Phase = 'idle' | 'saving' | 'resolving' | 'downloading' | 'done' | 'fallback' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Filename sanitiser
// ─────────────────────────────────────────────────────────────────────────────

function buildFilename(
  title: string,
  quality: Quality,
  mediaType: 'movie' | 'tv',
  season: number,
  episode: number,
): string {
  const safe = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
  if (mediaType === 'tv') {
    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    return `${safe}_S${s}E${e}_${quality}.mp4`;
  }
  return `${safe}_${quality}.mp4`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blob download helper
// Fetches via our /api/download-proxy (server-side CORS bypass) then triggers
// the native browser Save dialog using a temporary blob URL.
// ─────────────────────────────────────────────────────────────────────────────

async function triggerBlobDownload(
  videoUrl: string,
  safeFilename: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const proxyUrl =
    `/api/download-proxy?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(safeFilename)}`;

  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`Proxy returned HTTP ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable body from proxy');

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (contentLength > 0) onProgress(Math.round((received / contentLength) * 100));
    }
  }

  const blob = new Blob(chunks, { type: 'video/mp4' });
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = safeFilename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(blobUrl);
  }, 200);
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  posterUrl: string;
  mediaId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  title,
  posterUrl,
  mediaId,
  mediaType,
  season = 1,
  episode = 1,
  episodeTitle,
}) => {
  const { user } = useAuth();
  const [selectedQuality, setSelectedQuality] = useState<Quality>('1080p');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState<number>(0);

  // Reset whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedQuality('1080p');
      setPhase('idle');
      setErrorMsg(null);
      setFallbackUrl(null);
      setResolvedSource(null);
      setDownloadPct(0);
    }
  }, [isOpen]);

  // Escape key — only close when not mid-download
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (phase === 'idle' || phase === 'error' || phase === 'done' || phase === 'fallback')) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, phase]);

  // Derived embed fallback URL used when blob download is not possible
  const embedFallback =
    mediaType === 'tv'
      ? `https://vidsrc.to/embed/tv/${mediaId}/${season}/${episode}`
      : `https://vidsrc.to/embed/movie/${mediaId}`;

  const handleDownload = async () => {
    if (!user) {
      alert('Please sign in to download content.');
      return;
    }

    setPhase('saving');
    setErrorMsg(null);
    setFallbackUrl(null);
    setResolvedSource(null);
    setDownloadPct(0);

    // ── 1. Save record to Cloud Vault ─────────────────────────────────────────
    const { error: dbErr } = await supabase.from('user_downloads').insert({
      user_id:    user.id,
      tmdb_id:    String(mediaId),
      title,
      poster_url: posterUrl,
      media_type: mediaType,
      quality:    selectedQuality,
      season:     season || 1,
      episode:    episode || 1,
    });

    if (dbErr) {
      setErrorMsg(`Cloud Vault save failed: ${dbErr.message}`);
      setPhase('error');
      return;
    }

    // ── 2. Ask server to extract a direct video URL from embed HTML ───────────
    setPhase('resolving');

    let videoUrl: string | null = null;
    let isHls = false;

    try {
      const params = new URLSearchParams({
        id:      mediaId,
        type:    mediaType,
        season:  String(season),
        episode: String(episode),
        quality: selectedQuality,
      });
      const resp = await fetch(`/api/resolve-download?${params}`, {
        signal: AbortSignal.timeout(30_000),
      });
      const data = await resp.json() as {
        success: boolean;
        videoUrl?: string;
        source?: string;
        isHls?: boolean;
        error?: string;
      };

      if (data.success && data.videoUrl) {
        videoUrl  = data.videoUrl;
        isHls     = data.isHls ?? false;
        setResolvedSource(data.source ?? null);
      } else {
        // Resolver could not extract a direct link — go to fallback
        setFallbackUrl(embedFallback);
        setPhase('fallback');
        return;
      }
    } catch {
      setFallbackUrl(embedFallback);
      setPhase('fallback');
      return;
    }

    // ── 3. HLS stream — browser cannot blob-download a playlist ──────────────
    if (isHls) {
      setFallbackUrl(videoUrl!);
      setPhase('fallback');
      return;
    }

    // ── 4. Blob download via server-side streaming proxy ─────────────────────
    setPhase('downloading');
    const filename = buildFilename(title, selectedQuality, mediaType, season, episode);

    try {
      await triggerBlobDownload(videoUrl!, filename, (pct) => setDownloadPct(pct));
      setPhase('done');
      setTimeout(onClose, 2500);
    } catch {
      // Proxy download failed — show the raw URL for manual save
      setFallbackUrl(videoUrl!);
      setPhase('fallback');
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const selectedOption = QUALITY_OPTIONS.find((q) => q.id === selectedQuality)!;
  const isActive = phase !== 'idle' && phase !== 'error' && phase !== 'done' && phase !== 'fallback';

  const ButtonContent = () => {
    switch (phase) {
      case 'saving':      return <><Loader2 className="h-4 w-4 animate-spin" /><span>Saving to Cloud Vault…</span></>;
      case 'resolving':   return <><Loader2 className="h-4 w-4 animate-spin" /><span>Resolving video source…</span></>;
      case 'downloading': return <><Loader2 className="h-4 w-4 animate-spin" /><span>Downloading {downloadPct > 0 ? `${downloadPct}%` : '…'}</span></>;
      case 'done':        return <><Check className="h-4 w-4" /><span>Download complete!</span></>;
      case 'fallback':    return <><AlertTriangle className="h-4 w-4" /><span>Manual save required</span></>;
      default:            return <><Zap className="h-4 w-4" /><span>Download · {selectedQuality}</span></>;
    }
  };

  const btnClass = [
    'w-full rounded-xl py-3.5 text-sm font-bold transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
    phase === 'done'     ? 'bg-emerald-600 text-white cursor-default' :
    phase === 'fallback' ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 cursor-default' :
    phase === 'error'    ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30' :
    isActive             ? 'bg-emerald-500/60 text-zinc-950 cursor-not-allowed' :
                           'bg-emerald-500 text-zinc-950 hover:bg-emerald-400',
  ].join(' ');

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Download ${title}`}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !isActive && onClose()}
            className="fixed inset-0 bg-black/88 backdrop-blur-md"
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/12 bg-zinc-950 shadow-2xl shadow-emerald-500/20"
          >
            {/* Hairline + glow */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
            <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-56 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10">
                  <Download className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                    Obsidian Theater
                  </p>
                  <h2 className="font-display text-base font-bold text-white leading-tight">
                    Download Options
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close download modal"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="relative px-6 py-6 space-y-5">

              {/* Media info row */}
              <div className="flex gap-4 items-center rounded-xl border border-white/8 bg-zinc-900/60 p-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
                  <ResilientImage
                    src={posterUrl}
                    alt={title}
                    fallbackTitle={title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2">{title}</h3>
                  <p className="mt-1 font-mono text-[11px] uppercase text-emerald-400">
                    {mediaType === 'tv'
                      ? `Season ${season} · Episode ${episode}${episodeTitle ? ` — "${episodeTitle}"` : ''}`
                      : 'Feature Film'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-zinc-500" />
                    <span className="font-mono text-[10px] text-zinc-500 uppercase">
                      Stream-extracted · No malware
                    </span>
                  </div>
                </div>
              </div>

              {/* Quality selector */}
              <div>
                <label className="mb-2.5 block font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  Select Quality
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {QUALITY_OPTIONS.map((opt) => {
                    const active = selectedQuality === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => !isActive && setSelectedQuality(opt.id)}
                        disabled={isActive}
                        className={`relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${
                          active
                            ? 'border-emerald-500/70 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                            : 'border-white/10 bg-zinc-900/60 hover:border-white/20 hover:bg-zinc-900'
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                            <Check className="h-2.5 w-2.5 text-zinc-950" strokeWidth={3} />
                          </span>
                        )}
                        <span className={`font-mono text-[10px] uppercase tracking-wider ${active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {opt.badge}
                        </span>
                        <span className={`font-display text-lg font-bold leading-none ${active ? 'text-emerald-300' : 'text-zinc-200'}`}>
                          {opt.label}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          <span className="block font-mono text-[10px] text-zinc-500">{opt.size}</span>
                          <span className="block font-mono text-[10px] text-zinc-600">{opt.bitrate}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary bar */}
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-zinc-900/40 px-4 py-2.5">
                <HardDrive className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="font-mono text-[11px] text-zinc-400">
                  Est. size:&nbsp;
                  <span className="text-emerald-400 font-semibold">{selectedOption.size}</span>
                  &nbsp;·&nbsp;{selectedOption.bitrate}&nbsp;·&nbsp;{selectedOption.label}
                  {resolvedSource && (
                    <span className="text-zinc-600"> · via {resolvedSource}</span>
                  )}
                </span>
              </div>

              {/* Download progress bar */}
              {phase === 'downloading' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                    <span>Downloading to your device…</span>
                    <span>{downloadPct > 0 ? `${downloadPct}%` : 'Buffering…'}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: downloadPct > 0 ? `${downloadPct}%` : '8%' }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}

              {/* Error banner */}
              {phase === 'error' && errorMsg && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  <span className="font-semibold">Error:&nbsp;</span>{errorMsg}
                  <button
                    type="button"
                    onClick={() => { setPhase('idle'); setErrorMsg(null); }}
                    className="ml-3 underline hover:text-red-300"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Done banner */}
              {phase === 'done' && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <Cloud className="h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Download complete ✓</p>
                    <p className="text-xs text-zinc-400">
                      Check your browser's downloads bar for{' '}
                      <span className="text-emerald-400 break-all">
                        {buildFilename(title, selectedQuality, mediaType, season, episode)}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Fallback banner */}
              {phase === 'fallback' && fallbackUrl && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-300">Direct download unavailable</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        The video source uses a protected CDN that blocks automated downloads.
                        Open the player below, then{' '}
                        <span className="text-amber-300 font-semibold">right-click → "Save video as…"</span>{' '}
                        to save it to your machine.
                      </p>
                    </div>
                  </div>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open video — right-click to save
                  </a>
                </div>
              )}

              {/* CTA button */}
              <button
                type="button"
                onClick={isActive ? undefined : handleDownload}
                disabled={isActive}
                className={btnClass}
              >
                <span className="flex items-center justify-center gap-2">
                  <ButtonContent />
                </span>
              </button>

              <p className="text-center font-mono text-[10px] text-zinc-600">
                Saved to your Cloud Vault and downloaded directly to your device.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
