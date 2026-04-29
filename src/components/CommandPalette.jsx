import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Cmd+K palette. Surfaces panels, slash commands, and pane actions
 * in one searchable list — gives power users a single hotkey to anything.
 */
export default function CommandPalette() {
  const open = useAppStore((s) => s.panelOpen.palette);
  const setPanel = useAppStore((s) => s.setPanel);
  const closeAllPanels = useAppStore((s) => s.closeAllPanels);
  const addPane = useAppStore((s) => s.addPane);
  const clearChat = useAppStore((s) => s.clearChat);
  const inputRef = useRef(null);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo(() => buildItems({ closeAllPanels, setPanel, addPane, clearChat }), []);
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const Q = q.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(Q) || (i.hint || '').toLowerCase().includes(Q));
  }, [q, items]);

  if (!open) return null;

  const onKey = (e) => {
    if (e.key === 'Escape') { setPanel('palette', false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((v) => Math.min(filtered.length - 1, v + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((v) => Math.max(0, v - 1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[idx];
      if (it) { it.run(); setPanel('palette', false); }
    }
  };

  return (
    <div onClick={() => setPanel('palette', false)} className="absolute inset-0 z-40 grid place-items-start pt-[15vh] bg-ink-950/70 backdrop-blur-sm">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-[560px] max-w-[92vw] rounded-2xl border border-cyan-glow/20 bg-ink-900/95 shadow-2xl overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-cyan-glow/10">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onKey}
            placeholder="Type a command…"
            className="w-full bg-transparent outline-none text-sm placeholder:text-slate-500"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && <div className="px-3 py-6 text-center text-slate-500 text-xs">No matches</div>}
          {filtered.map((it, i) => {
            const Icon = Icons[it.icon] || Icons.ChevronRight;
            return (
              <button
                key={it.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { it.run(); setPanel('palette', false); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 ${
                  i === idx ? 'bg-cyan-glow/10' : 'hover:bg-ink-800'
                }`}
              >
                <Icon className="w-4 h-4 text-cyan-soft" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200">{it.label}</div>
                  {it.hint && <div className="text-[11px] text-slate-500">{it.hint}</div>}
                </div>
                {it.shortcut && <div className="text-[10px] font-mono text-slate-500">{it.shortcut}</div>}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function buildItems({ closeAllPanels, setPanel, addPane, clearChat }) {
  const open = (key) => () => { closeAllPanels(); setPanel(key, true); };
  return [
    { id: 'settings', icon: 'ShieldCheck', label: 'Settings (permissions, hooks)', hint: '.claude/settings.json', run: open('settings'), shortcut: '⌘,' },
    { id: 'claude-md', icon: 'FileText', label: 'Edit CLAUDE.md', hint: 'Project memory', run: open('claudeMd') },
    { id: 'sessions', icon: 'History', label: 'Past sessions', hint: 'Resume a transcript', run: open('sessions'), shortcut: '⌘H' },
    { id: 'mcp-logs', icon: 'ScrollText', label: 'MCP logs / diagnostic', run: open('mcpLogs') },
    { id: 'export', icon: 'Download', label: 'Export current conversation', run: open('export') },
    { id: 'split', icon: 'Columns2', label: 'New split pane', hint: 'Open a parallel session', run: () => addPane('split') },
    { id: 'clear', icon: 'Eraser', label: 'Clear current chat', run: () => clearChat() },
    { id: 'help', icon: 'BookOpen', label: 'Onboarding / help', run: open('onboarding') }
  ];
}
