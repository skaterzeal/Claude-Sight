import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useAppStore, selectActivePane } from '../store/useAppStore.js';

/**
 * Plan mode toggle for the active pane.
 * When ON, prompts include an --append-system-prompt that asks Claude to
 * present a plan and wait for approval before making changes.
 */
export default function PlanModeToggle() {
  const pane = useAppStore(selectActivePane);
  const setPlanMode = useAppStore((s) => s.setPlanMode);
  if (!pane) return null;
  const on = !!pane.planMode;
  return (
    <button
      onClick={() => setPlanMode(pane.id, !on)}
      title={on ? 'Plan mode: ON — Claude will plan before doing.' : 'Plan mode: OFF'}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors ${
        on
          ? 'bg-claude-amber/15 border-claude-amber/40 text-claude-amber'
          : 'bg-ink-800/80 border-cyan-glow/10 text-slate-400 hover:text-slate-200 hover:border-cyan-glow/30'
      }`}
    >
      <ClipboardList className="w-3 h-3" />
      <span className="font-mono">Plan {on ? 'ON' : 'off'}</span>
    </button>
  );
}
