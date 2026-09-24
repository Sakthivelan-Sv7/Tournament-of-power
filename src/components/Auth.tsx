import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Trophy, Mail, Lock, LogIn, UserPlus, WifiOff, CheckCircle } from 'lucide-react';

export function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [supabaseDown, setSupabaseDown] = useState(false);

  // Detect if Supabase is reachable on mount
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || url === 'your-supabase-project-url') {
      setSupabaseDown(true);
      return;
    }
    // Quick health check — Supabase always returns something at /rest/v1/
    fetch(`${url}/rest/v1/`, { method: 'HEAD' })
      .then(() => setSupabaseDown(false))
      .catch(() => setSupabaseDown(true));
  }, []);

  const friendlyError = (err: any): string => {
    const msg: string = err?.message || '';
    if (!msg || msg === 'Failed to fetch' || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('fetch')) {
      return '⚠️ Cannot reach Supabase. Your project may be paused. Go to supabase.com/dashboard and restore it, then try again.';
    }
    if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid email or password')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (msg.toLowerCase().includes('email not confirmed')) {
      return 'Please confirm your email address before signing in.';
    }
    if (msg.toLowerCase().includes('user already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (msg.toLowerCase().includes('password should be at least')) {
      return 'Password must be at least 6 characters.';
    }
    return msg || 'An error occurred during authentication.';
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is required, data.session will be null
        if (!data.session) {
          setSuccessMsg('Account created! Check your email to confirm your address, then sign in.');
          setIsLogin(true);
        } else {
          onAuthSuccess();
        }
      }
    } catch (err: any) {
      setErrorMsg(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-500/20 rounded-full border border-amber-500/30">
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {isLogin ? 'Sign in to access the tournament.' : 'Sign up to join the competition.'}
          </p>
        </div>

        {supabaseDown && (
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm flex items-start gap-3">
            <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-orange-400" />
            <div>
              <p className="font-bold text-orange-400 mb-1">Supabase Project Unreachable</p>
              <p>Your project is likely <strong>paused</strong> (free-tier projects auto-pause after 1 week of inactivity).</p>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block underline text-amber-400 hover:text-amber-300 font-semibold"
              >
                → Open Supabase Dashboard to restore it
              </a>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white placeholder-slate-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></span>
            ) : isLogin ? (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Sign Up
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
