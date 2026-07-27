'use client';

import React, { useState } from 'react';
import { db, SportProfile, Tournament } from '../utils/db';
import { Avatar } from './Avatar';
import { Award, Calendar, ChevronRight, Cpu, Layers, Trophy, Upload, User } from 'lucide-react';

interface TournamentWizardProps {
  onComplete: (tournament: Tournament) => void;
  sportProfiles: SportProfile[];
}

export const TournamentWizard: React.FC<TournamentWizardProps> = ({ onComplete, sportProfiles }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [sportType, setSportType] = useState('football');
  const [format, setFormat] = useState('league'); // 'league', 'knockout'
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (step === 1 && (!name || !organizer)) {
      setError('Please fill in the tournament and organizer names.');
      return;
    }
    setError('');
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let finalLogoUrl = '';
      if (logoFile) {
        finalLogoUrl = await db.uploadFile('logos', logoFile);
      }

      const tournament = await db.createTournament({
        name,
        organizer_id: undefined, // Will be set by Supabase auth if logged in
        logo_url: finalLogoUrl || undefined,
        sport_type: sportType,
        format,
        start_date: startDate,
        end_date: endDate
      });

      onComplete(tournament);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create tournament. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Core Details', icon: Trophy },
    { num: 2, label: 'Sport Profile', icon: Cpu },
    { num: 3, label: 'Format & Rules', icon: Layers },
    { num: 4, label: 'Scheduling', icon: Calendar },
  ];

  return (
    <div className="w-full max-w-4xl bg-surface/50 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col md:flex-row">
      
      {/* Sidebar: Ignition Sequence Progress Indicator */}
      <div className="w-full md:w-80 bg-surface border-r border-white/5 p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-accent-gold/10 rounded-xl border border-accent-gold/20">
              <Trophy className="w-6 h-6 text-accent-gold" />
            </div>
            <div>
              <h2 className="font-display font-semibold tracking-wider text-sm text-accent-gold">THE OMNIVERSE</h2>
              <p className="text-xs text-nebula-gray">TOURNAMENT ENGINE</p>
            </div>
          </div>

          <div className="space-y-6 relative">
            {/* Continuous vertical connector line */}
            <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-white/10 hidden md:block">
              <div 
                className="w-full bg-accent-gold transition-all duration-300"
                style={{ height: `${((step - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>

            {steps.map((s) => {
              const Icon = s.icon;
              const isCurrent = step === s.num;
              const isCompleted = step > s.num;
              return (
                <div key={s.num} className="flex items-center gap-4 group relative z-10">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    isCurrent 
                      ? 'bg-accent-gold text-background border-accent-gold scale-105 shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                      : isCompleted 
                        ? 'bg-accent-gold/10 text-accent-gold border-accent-gold/20' 
                        : 'bg-background text-nebula-gray border-white/5 group-hover:border-white/20'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-xs uppercase tracking-widest ${isCurrent ? 'text-accent-gold font-semibold' : 'text-nebula-gray'}`}>
                      Step {s.num}
                    </p>
                    <p className={`font-display text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-nebula-gray/80'}`}>
                      {s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 text-xs text-nebula-gray flex items-center gap-2">
          <Award className="w-4 h-4 text-accent-cyan" />
          <span>Multiverse Tournament System</span>
        </div>
      </div>

      {/* Main wizard forms */}
      <form onSubmit={handleSubmit} className="flex-1 p-8 flex flex-col justify-between min-h-[500px]">
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {step === 1 && "Forge Your Tournament"}
              {step === 2 && "Configure the Battlefield"}
              {step === 3 && "Select Competitive Format"}
              {step === 4 && "Set the Timeline"}
            </h1>
            <p className="text-sm text-nebula-gray mt-1">
              {step === 1 && "Provide the foundational registry details of your arena."}
              {step === 2 && "Choose the sport type profile. Rules and event entry conform to this profile."}
              {step === 3 && "Select the rules that govern point calculations and brackets."}
              {step === 4 && "Set the boundaries of the tournament schedule."}
            </p>
          </div>

          {error && (
            <div className="p-4 mb-6 bg-error/10 border border-error/20 text-error text-sm rounded-xl font-mono">
              [SYSTEM ERROR] {error}
            </div>
          )}

          {/* STEP 1: Core Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-widest text-nebula-gray mb-2 font-semibold">Tournament Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., The Interdimensional Championship"
                    className="w-full bg-background border border-white/5 focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-nebula-gray mb-2 font-semibold">Organizer Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-nebula-gray">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value)}
                    placeholder="e.g., Grand Priest"
                    className="w-full bg-background border border-white/5 focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/40 rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-nebula-gray mb-2 font-semibold">Tournament Logo (Optional)</label>
                <div className="flex items-center gap-6">
                  {logoPreview ? (
                    <Avatar src={logoPreview} name={name || 'T'} size="xl" shape="square" colorHex="#FACC15" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center text-xs text-nebula-gray">
                      <Trophy className="w-6 h-6 text-white/20 mb-1" />
                      No logo
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold text-foreground transition-all">
                    <Upload className="w-4 h-4 text-accent-gold" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Sport Profile */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sportProfiles.map((p) => {
                const isSelected = sportType === p.sport_type;
                return (
                  <button
                    key={p.sport_type}
                    type="button"
                    onClick={() => setSportType(p.sport_type)}
                    className={`p-6 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-accent-gold/5 border-accent-gold shadow-[0_0_15px_rgba(250,204,21,0.05)]'
                        : 'bg-background border-white/5 hover:border-white/10 hover:bg-surface/30'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest ${
                        isSelected ? 'bg-accent-gold text-background' : 'bg-surface text-nebula-gray'
                      }`}>
                        {p.sport_type}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground">{p.event_type_config_jsonb.display_name}</h3>
                    <p className="text-xs text-nebula-gray mt-2 leading-relaxed">
                      Custom event tracker: {Object.keys(p.event_type_config_jsonb.events).slice(0, 4).join(', ')}...
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3: Format */}
          {step === 3 && (
            <div className="space-y-4">
              <div 
                onClick={() => setFormat('league')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  format === 'league'
                    ? 'bg-accent-gold/5 border-accent-gold'
                    : 'bg-background border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-accent-gold border border-white/5">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">League (Round-Robin)</h3>
                    <p className="text-xs text-nebula-gray mt-0.5">Every team plays every other team. Cumulative score decides standings.</p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => setFormat('knockout')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  format === 'knockout'
                    ? 'bg-accent-gold/5 border-accent-gold'
                    : 'bg-background border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-accent-cyan border border-white/5">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">Single Elimination (Knockout)</h3>
                    <p className="text-xs text-nebula-gray mt-0.5">Teams compete in brackets. Losing team is instantly eliminated.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Scheduling */}
          {step === 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-widest text-nebula-gray mb-2 font-semibold">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-background border border-white/5 focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-nebula-gray mb-2 font-semibold">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-background border border-white/5 focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="px-6 py-3 border border-white/5 hover:border-white/10 bg-surface rounded-xl text-xs font-semibold text-foreground hover:bg-surface-hover transition-all"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < steps.length ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-accent-gold hover:bg-yellow-400 text-background rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-accent-gold hover:bg-yellow-400 text-background rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Initializing Arena...' : 'Forge Tournament'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
