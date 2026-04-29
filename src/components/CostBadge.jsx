import React, { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { useAppStore, selectActivePane } from '../store/useAppStore.js';

/**
 * Cumulative session cost / token / turn rozeti.
 * Reads only from the active pane.
 */
export default function CostBadge() {
  const pane = useAppStore(selectActivePane);

  const totals = useMemo(() => {
    if (!pane) return { cost: 0, tokens: 0, turns: 0 };
    let cost = 0, tokens = 0, turns = 0;
    for (const m of pane.messages) {
      if (m.meta) {
        if (typeof m.meta.cost === 'number') cost += m.meta.cost;
        if (typeof m.meta.numTurns === 'number') turns += m.meta.numTurns;
        if (typeof m.meta.tokens === 'number') tokens += m.meta.tokens;
      }
    }
    return { cost, tokens, turns };
  }, [pane?.messages]);

  if (totals.cost === 0 && totals.tokens === 0 && totals.turns === 0) return null;

  return (
    <div
      title={`This session: $${totals.cost.toFixed(4)} · ${totals.tokens.toLocaleString()} tokens · ${totals.turns} turns`}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono bg-ink-800/80 border border-cyan-glow/10"
    >
      <Coins className="w-3 h-3 text-claude-amber" />
      <span className="text-slate-300">${totals.cost.toFixed(3)}</span>
      <span className="text-slate-500">·</span>
      <span className="text-slate-400">{(totals.tokens / 1000).toFixed(1)}k</span>
    </div>
  );
}
