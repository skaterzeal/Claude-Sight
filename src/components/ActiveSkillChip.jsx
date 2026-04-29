import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plug } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Small badge that appears in the TopBar while Claude is actively
 * using a skill or plugin. Driven by `activeSkill` in the store.
 */
export default function ActiveSkillChip() {
  const active = useAppStore((s) => s.activeSkill);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.name}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30 shadow-glow-accent"
          title={`Currently using ${active.kind}: ${active.name}`}
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className="text-accent"
          >
            {active.kind === 'plugin' ? <Plug className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          </motion.div>
          <div className="leading-tight">
            <div className="text-[9px] uppercase tracking-[0.2em] text-accent-soft/80">
              Using {active.kind}
            </div>
            <div className="text-xs font-mono text-accent">{active.name}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
