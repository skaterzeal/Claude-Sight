import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Trash2, ChevronUp, ChevronDown, Copy } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Bottom drawer that shows stderr / raw / mcp diagnostics.
 * Pinned to the bottom of the chat area; collapsed by default.
 */
export default function DiagnosticPanel() {
  const diagnostics = useAppStore((s) => s.diagnostics);
  const clear = useAppStore((s) => s.clearDiagnostics);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return diagnostics;
    return diagnostics.filter((d) => d.kind === filter);
  }, [diagnostics, filter]);

  const copyAll = async () => {
    const text = diagnostics.map((d) => `[${new Date(d.ts).toLocaleTimeString()}] [${d.kind}] [${d.source}] ${d.text}`).join('\n');
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div className="border-t border-cyan-glow/10 bg-ink-950/60 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-ink-900/60 transition-colors"
      >
        <Bug className="w-3.5 h-3.5 text-claude-amber" />
        <span className="text-slate-300 font-mono">Diagnostics</span>
        {diagnostics.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-claude-amber/20 text-claude-amber">
            {diagnostics.length}
          </span>
        )}
        <span className="flex-1" />
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 220, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-1 border-y border-cyan-glow/5 bg-ink-900/50">
              {['all', 'stderr', 'raw', 'info'].map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                    filter === k ? 'bg-cyan-glow/15 text-cyan-soft' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >{k}</button>
              ))}
              <span className="flex-1" />
              <button onClick={copyAll} className="p-1 rounded hover:bg-ink-700 text-slate-400" title="Copy all">
                <Copy className="w-3 h-3" />
              </button>
              <button onClick={clear} className="p-1 rounded hover:bg-ink-700 text-claude-coral" title="Clear">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="h-[180px] overflow-y-auto px-3 py-2 font-mono text-[11px] leading-snug text-slate-400 space-y-0.5">
              {filtered.length === 0 && <div className="text-slate-600">No diagnostics.</div>}
              {filtered.map((d, i) => (
                <div key={i} className="break-words">
                  <span className="text-slate-600">{new Date(d.ts).toLocaleTimeString()}</span>
                  <span className={`mx-1.5 px-1 rounded text-[9px] ${
                    d.kind === 'stderr' ? 'bg-claude-coral/20 text-claude-coral'
                      : d.kind === 'raw' ? 'bg-claude-amber/20 text-claude-amber'
                      : 'bg-cyan-glow/15 text-cyan-soft'
                  }`}>{d.kind}</span>
                  <span className="text-slate-500">{d.source}</span>
                  <span className="text-slate-300 ml-1.5 whitespace-pre-wrap">{d.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
