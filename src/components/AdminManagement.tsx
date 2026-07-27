import React, { useState } from 'react';
import { Shield, ShieldAlert, CheckCircle, Mail, Loader2 } from 'lucide-react';
import { db } from '../utils/db';

export const AdminManagement: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleMakeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setMessage('');

    try {
      const success = await db.makeAdmin(email.trim());
      
      if (success) {
        setStatus('success');
        setMessage(`Successfully promoted ${email} to Admin!`);
        setEmail(''); // Reset form
      } else {
        setStatus('error');
        setMessage(`Could not find user with email ${email}. Make sure they are registered.`);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('An error occurred while processing the request.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center border border-accent-cyan/20">
              <Shield className="w-5 h-5 text-accent-cyan" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Admin Management</h2>
              <p className="text-sm text-nebula-gray">Promote users to organizers</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-4 leading-relaxed">
            As an existing administrator, you can grant admin privileges to other registered users. 
            They must already have an account. Enter their exact registered email address below.
          </p>
        </div>
      </div>

      {/* Action section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <form onSubmit={handleMakeAdmin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-nebula-gray uppercase tracking-wider mb-2">
              User Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. kakarot@multiverse.com"
                className="w-full pl-10 pr-4 py-3 bg-background/50 border border-white/10 rounded-xl focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 outline-none text-white placeholder-slate-500 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === 'loading' || !email.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent-cyan hover:bg-cyan-400 text-background rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5" />
                Promote to Admin
              </>
            )}
          </button>
        </form>

        {/* Status Messages */}
        {status === 'success' && (
          <div className="mt-4 p-4 rounded-xl bg-success/10 border border-success/20 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div className="text-sm text-success-light">
              {message}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div className="text-sm text-error">
              {message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
