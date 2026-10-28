import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mail, X, Zap } from 'lucide-react';
import { supabase } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'oauth' | 'magic'>('oauth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('oauth');
      setEmail('');
      setSent(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus email input when switching to magic link mode
  useEffect(() => {
    if (mode === 'magic') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setLoading(false);
    }
    // On success, browser redirects — no need to close modal manually
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error: mlErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (mlErr) {
      setError(mlErr.message);
    } else {
      setSent(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in to Obsidian Theater"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl shadow-emerald-500/15"
          >
            {/* Ambient emerald hairline */}
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
            {/* Soft glow blob */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-64 rounded-full bg-emerald-500/12 blur-[80px]" />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-400">
                  Obsidian Theater
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold text-white">
                  Sign in to unlock downloads
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sign-in modal"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative px-6 py-7 space-y-5">
              {/* Benefits blurb */}
              <p className="text-sm leading-relaxed text-zinc-400">
                Free accounts get access to{' '}
                <span className="text-emerald-400 font-medium">HD downloads</span>, synced watchlists, and cross-device watch history.
              </p>

              {mode === 'oauth' && !sent && (
                <>
                  {/* Google OAuth button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:border-emerald-500/50 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {/* Google G icon */}
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {loading ? 'Redirecting…' : 'Continue with Google'}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="font-mono text-[11px] uppercase text-zinc-500">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  {/* Magic link option */}
                  <button
                    type="button"
                    onClick={() => setMode('magic')}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-zinc-900/60 px-5 py-3 text-sm font-medium text-zinc-300 transition-all hover:border-emerald-500/40 hover:text-white"
                  >
                    <Mail className="h-4 w-4 text-emerald-400" />
                    Continue with Email Magic Link
                  </button>
                </>
              )}

              {mode === 'magic' && !sent && (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label htmlFor="auth-email" className="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-2">
                      Email address
                    </label>
                    <input
                      ref={inputRef}
                      id="auth-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition-all hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Zap className="h-4 w-4" />
                    {loading ? 'Sending…' : 'Send Magic Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('oauth')}
                    className="w-full text-center font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    ← Back to sign-in options
                  </button>
                </form>
              )}

              {sent && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-center">
                  <p className="text-sm font-medium text-emerald-300">
                    Magic link sent to <span className="font-semibold">{email}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">Check your inbox and click the link to sign in.</p>
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  {error}
                </p>
              )}

              <p className="text-center font-mono text-[11px] text-zinc-600">
                By signing in you agree to stream responsibly.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
