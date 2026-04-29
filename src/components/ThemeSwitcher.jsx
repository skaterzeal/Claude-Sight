import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

const THEMES = [
  { id: 'jarvis', label: 'Jarvis',  swatch: ['#3ee0ff', '#e89b4a'], desc: 'Neon cyan command center' },
  { id: 'pink',   label: 'Blossom', swatch: ['#f472b6', '#fbcfe8'], desc: 'Soft pink + plum' },
  { id: 'macos',  label: 'macOS',   swatch: ['#0a84ff', '#ff9500'], desc: 'Light, Apple-style' }
];

export default function ThemeSwitcher() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-ink-800 hover:bg-ink-700 border border-accent/10 hover:border-accent/30 transition-colors"
        title="Change theme"
      >
        <Palette className="w-3.5 h-3.5 text-accent-soft" />
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: current.swatch[0] }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: current.swatch[1] }} />
        </div>
        <span className="text-primary">{current.label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-1.5 w-56 rounded-xl bg-ink-900 border border-accent/20 shadow-2xl z-[100] p-1.5"
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  t.id === theme ? 'bg-accent/10' : 'hover:bg-ink-800'
                }`}
              >
                <div className="flex shrink-0 items-center gap-0.5">
                  <span className="w-3 h-3 rounded-full ring-1 ring-black/20" style={{ background: t.swatch[0] }} />
                  <span className="w-3 h-3 rounded-full ring-1 ring-black/20 -ml-1" style={{ background: t.swatch[1] }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-primary">{t.label}</div>
                  <div className="text-[10px] text-muted truncate">{t.desc}</div>
                </div>
                {t.id === theme && <Check className="w-3.5 h-3.5 text-accent" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
