'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, ShieldAlert, CheckCircle, Mail, Loader2,
  UserMinus, Users, AlertTriangle, RefreshCw, Crown
} from 'lucide-react';
import { db, Profile } from '../utils/db';

interface AdminManagementProps {
  currentUserId?: string;
}

export const AdminManagement: React.FC<AdminManagementProps> = ({ currentUserId }) => {
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);

  // Promote form
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteStatus, setPromoteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [promoteMessage, setPromoteMessage] = useState('');

  // Remove state
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState('');

  const fetchAdmins = useCallback(async () => {
    setAdminLoading(true);
    try {
      const list = await db.getAdmins();
      setAdmins(list);
    } catch (err) {
      console.error(err);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleMakeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteEmail.trim()) return;

    setPromoteStatus('loading');
    setPromoteMessage('');

    try {
      const success = await db.makeAdmin(promoteEmail.trim());
      if (success) {
        setPromoteStatus('success');
        setPromoteMessage(`Successfully promoted ${promoteEmail} to Admin!`);
        setPromoteEmail('');
        fetchAdmins();
      } else {
        setPromoteStatus('error');
        setPromoteMessage(`Could not find user with email ${promoteEmail}. Make sure they are registered.`);
      }
    } catch (err) {
      console.error(err);
      setPromoteStatus('error');
      setPromoteMessage('An error occurred while processing the request.');
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Remove admin privileges from ${email}? They will become a regular user.`)) return;
    setRemovingEmail(email);
    setRemoveError('');
    try {
      const success = await db.removeAdmin(email);
      if (success) {
        fetchAdmins();
      } else {
        setRemoveError(`Could not remove admin: ${email}`);
      }
    } catch (err: any) {
      setRemoveError(err.message || 'Failed to remove admin.');
    } finally {
      setRemovingEmail(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* === HEADER === */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-surface via-surface to-background p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 flex items-center justify-center border border-accent-cyan/20 shrink-0">
            <Crown className="w-6 h-6 text-accent-cyan" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-white">Admin User Management</h2>
            <p className="text-sm text-nebula-gray mt-1 leading-relaxed max-w-xl">
              View all administrators, promote trusted users to admin, or revoke admin access. You cannot revoke your own admin status.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* === LEFT: Current Admins List === */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-cyan" />
              Current Administrators
              <span className="text-xs font-mono bg-accent-cyan/10 text-accent-cyan px-2 py-0.5 rounded-full border border-accent-cyan/20">
                {admins.length}
              </span>
            </h3>
            <button
              onClick={fetchAdmins}
              disabled={adminLoading}
              className="flex items-center gap-1.5 text-xs text-nebula-gray hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {adminLoading ? (
            <div className="flex items-center justify-center h-32 bg-surface/30 rounded-2xl border border-white/5">
              <Loader2 className="w-6 h-6 text-accent-cyan animate-spin" />
            </div>
          ) : admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 bg-surface/30 rounded-2xl border border-dashed border-white/10 text-nebula-gray">
              <Shield className="w-8 h-8 text-white/10 mb-2" />
              <p className="text-sm">No admins found. (Requires Supabase)</p>
            </div>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => {
                const isSelf = admin.id === currentUserId;
                return (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 bg-surface/40 border border-white/5 rounded-2xl hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan/20 to-accent-cyan/5 border border-accent-cyan/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-accent-cyan" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground flex items-center gap-2">
                          {admin.email || admin.id}
                          {isSelf && (
                            <span className="text-[9px] font-mono bg-accent-gold/10 text-accent-gold border border-accent-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wide">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-nebula-gray uppercase tracking-wider font-mono mt-0.5">
                          Administrator
                        </div>
                      </div>
                    </div>

                    {!isSelf && (
                      <button
                        onClick={() => admin.email && handleRemoveAdmin(admin.email)}
                        disabled={removingEmail === admin.email}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-error border border-error/20 bg-error/5 hover:bg-error/10 hover:border-error/50 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      >
                        {removingEmail === admin.email ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="w-3.5 h-3.5" />
                        )}
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {removeError && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2 text-sm text-error">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {removeError}
            </div>
          )}
        </div>

        {/* === RIGHT: Promote Admin Form === */}
        <div className="lg:col-span-2">
          <div className="bg-surface/40 border border-white/10 rounded-3xl p-6 space-y-5 sticky top-24">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-accent-gold" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-foreground">Promote to Admin</h3>
                <p className="text-xs text-nebula-gray">Grant admin privileges</p>
              </div>
            </div>

            <form onSubmit={handleMakeAdmin} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">
                  User Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={promoteEmail}
                    onChange={(e) => setPromoteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-9 pr-4 py-3 bg-background/50 border border-white/10 rounded-xl focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 outline-none text-sm text-white placeholder-slate-500 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={promoteStatus === 'loading' || !promoteEmail.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-accent-gold hover:bg-yellow-400 text-background rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(250,204,21,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {promoteStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Promote to Admin
                  </>
                )}
              </button>
            </form>

            {promoteStatus === 'success' && (
              <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div className="text-sm text-success">{promoteMessage}</div>
              </div>
            )}

            {promoteStatus === 'error' && (
              <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <div className="text-sm text-error">{promoteMessage}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
