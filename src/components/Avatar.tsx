'use client';

import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  colorHex?: string;
}

const colorPresets = [
  'bg-gradient-to-tr from-amber-600 to-yellow-500',
  'bg-gradient-to-tr from-cyan-600 to-blue-500',
  'bg-gradient-to-tr from-emerald-600 to-teal-500',
  'bg-gradient-to-tr from-rose-600 to-pink-500',
  'bg-gradient-to-tr from-purple-600 to-indigo-500',
  'bg-gradient-to-tr from-orange-600 to-red-500',
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getPresetClass = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPresets.length;
  return colorPresets[index];
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  shape = 'circle',
  colorHex,
}) => {
  const initials = getInitials(name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base font-semibold',
    lg: 'w-16 h-16 text-xl font-bold',
    xl: 'w-24 h-24 text-3xl font-bold',
  };

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  if (src && src.trim() !== '') {
    return (
      <div className={`relative flex-shrink-0 ${sizeClasses[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className={`${sizeClasses[size]} ${shapeClass} object-cover border border-surface bg-surface shadow-md`}
          onError={(e) => {
            // If image fails, fallback to initials by removing src
            (e.currentTarget as HTMLImageElement).style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const fallbackDiv = parent.querySelector('.avatar-fallback');
              if (fallbackDiv) {
                fallbackDiv.classList.remove('hidden');
                fallbackDiv.classList.add('flex');
              }
            }
          }}
        />
        <div
          className={`avatar-fallback hidden absolute inset-0 items-center justify-center text-foreground font-display ${shapeClass} shadow-inner`}
          style={colorHex ? { background: `linear-gradient(135deg, ${colorHex}dd, ${colorHex})` } : {}}
        >
          {initials}
        </div>
      </div>
    );
  }

  // Initials fallback
  const fallbackBgClass = colorHex ? '' : getPresetClass(name);
  const inlineStyle = colorHex
    ? { background: `linear-gradient(135deg, ${colorHex}dd, ${colorHex})` }
    : {};

  return (
    <div
      className={`flex items-center justify-center text-foreground font-display ${sizeClasses[size]} ${shapeClass} ${fallbackBgClass} shadow-md border border-white/10`}
      style={inlineStyle}
    >
      {initials}
    </div>
  );
};
