import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { StudioTheme } from '../../types/maker';
import { MakerIcon } from './IconMap';

export const MakerCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: string;
}> = ({ children, className = '', padding = 'p-4.5' }) => (
  <div
    className={`bg-white dark:bg-[#171A23] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.28)] ${padding} ${className}`}
  >
    {children}
  </div>
);

export const FieldLabel: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => (
  <div
    className={`text-[11px] font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-[#8E96AB] ${className}`}
  >
    {text}
  </div>
);

export const IconBadge: React.FC<{
  symbol: string;
  tint?: string;
  size?: number;
}> = ({ symbol, tint = '#7C5CFF', size = 44 }) => (
  <div
    className="flex items-center justify-center shrink-0 border border-black/[0.04] dark:border-white/[0.06]"
    style={{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.28),
      backgroundColor: `${tint}20`,
      color: tint,
    }}
  >
    <MakerIcon symbol={symbol} size={Math.round(size * 0.45)} color={tint} />
  </div>
);

export const Pill: React.FC<{
  text: string;
  symbol?: string;
  tint?: string;
}> = ({ text, symbol, tint = '#8E96AB' }) => (
  <span
    className="inline-flex items-center gap-1.5 text-[11px] font-semibold leading-none"
    style={{ color: tint }}
  >
    {symbol && <MakerIcon symbol={symbol} size={11} color={tint} />}
    <span>{text}</span>
  </span>
);

export const ThemeToggle: React.FC<{
  theme: StudioTheme;
  onChange: (next: StudioTheme) => void;
  compact?: boolean;
}> = ({ theme, onChange, compact = false }) => (
  <div
    role="group"
    aria-label="Theme mode"
    className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 dark:bg-[#1F2430] border border-slate-300/60 dark:border-white/[0.08]"
  >
    <button
      type="button"
      onClick={() => onChange('dark')}
      title="Dark studio mode"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-colors ${
        theme === 'dark'
          ? 'bg-[#7C5CFF] text-white shadow-xs'
          : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Moon size={13} />
      {!compact && <span>Dark</span>}
    </button>
    <button
      type="button"
      onClick={() => onChange('light')}
      title="Light mode"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-colors ${
        theme === 'light'
          ? 'bg-white text-slate-900 shadow-xs'
          : 'text-slate-600 dark:text-[#949BB0] hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Sun size={13} />
      {!compact && <span>Light</span>}
    </button>
  </div>
);

export const EmptyHint: React.FC<{
  symbol: string;
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}> = ({ symbol, title, message, actionTitle, onAction }) => (
  <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-3">
    <IconBadge symbol={symbol} tint="#7C5CFF" size={56} />
    <div className="space-y-1 max-w-sm">
      <h3 className="text-base font-bold text-slate-900 dark:text-[#F3F5FA]">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-[#949BB0] leading-relaxed">{message}</p>
    </div>
    {actionTitle && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-1 px-4 py-2 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold hover:bg-[#6A48F5] transition-colors"
      >
        {actionTitle}
      </button>
    )}
  </div>
);

export const CountTile: React.FC<{
  value: string;
  label: string;
  tint: string;
}> = ({ value, label, tint }) => (
  <div className="rounded-xl bg-slate-100 dark:bg-[#1F2430] border border-slate-200/70 dark:border-white/[0.06] p-3 text-left">
    <div className="text-xl font-black tabular-nums" style={{ color: tint }}>
      {value}
    </div>
    <div className="text-[11px] font-semibold text-slate-500 dark:text-[#949BB0]">{label}</div>
  </div>
);

export function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
