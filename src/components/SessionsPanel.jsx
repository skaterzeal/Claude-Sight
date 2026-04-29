import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, History, MessageSquare, RefreshCw, ArrowRight } from 'lucide-react';
import { useAppStore, selectActivePane } from '../store/useAppStore.js';

/**
 * Past sessions browser — lists JSONL transcripts for the current cwd.
 * Clicking "Resume here" rehydrates the active pane with that sessionId
 * and surfaces a few past messages for context.
 */
export default function SessionsPanel() {
  const open = useAppStore((s) => s.panelOpen.sessions);
  const setPanel = useAppStore((s) => s.setPanel);
  const activePane = useAppStore(selectActivePane);
  const loadSessionIntoPane = useAppStore((s) => s.loadSessionIntoPane);
  const projectRoot = useAppStore((s) => s.projectRoot);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await window.claudeSight.sessions.list();
    setItems(res.sessions || []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, projectRoot]);

  if (!open) return null;

  const resume = async (item) => {
    const res = await window.claudeSight.sessions.read(item.file);
    if (res.error) return;
    const messages = (res.events || [])
      .filter((e) => e.type === 'user' || e.type === 'assistant')
      .slice(-30)
      .map((e) => {
        if (e.type === 'user') {
          const c = e.message?.content;
          let text = '';
          if (typeof c === 'string') text = c;
          else if (Array.isArray(c)) text = c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
          return { id: cryptoRandomId(), role: 'user', text, ts: e.timestamp ? new Date(e.timestamp).getTime() : Date.now() };
        }
        const blocks = e.message?.content || [];
        const text = blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('');
        return {
          id: cryptoRandomId(),
          role: 'assistant',
          text,
          status: 'done',
          ts: e.timestamp ? new Date(e.timestamp).getTime() : Date.now()
        };
      });
    loadSessionIntoPane(activePane.id, { sessionId: item.id, messages });
    setPanel('sessions', false);
  };

  return (
    <div onClick={() => setPanel('sessions', false)} className="absolute inset-0 z-30 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-[640px] max-w-[92vw] max-h-[80vh] rounded-2xl border border-cyan-glow/15 bg-ink-900/95 shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-cyan-glow/10">
          <History className="w-4 h-4 text-cyan-soft" />
          <div className="font-display text-base font-semibold text-primary flex-1">Past sessions</div>
          <button onClick={load} className="p-1.5 rounded hover:bg-ink-700 text-slate-400" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setPanel('sessions', false)} className="p-1.5 rounded hover:bg-ink-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && <div className="px-3 py-6 text-center text-slate-500 text-xs">Scanning ~/.claude/projects…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-6 text-center text-slate-500 text-xs">
              No past sessions for this folder yet.
            </div>
          )}
          {items.map((it) => (
            <button
              key={it.file}
              onClick={() => resume(it)}
              className="w-full text-left p-3 rounded-xl border border-cyan-glow/10 bg-ink-800/60 hover:border-cyan-glow/40 hover:bg-ink-800 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-soft/70 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 line-clamp-1">{it.preview}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                    <span>{new Date(it.mtime).toLocaleString()}</span>
                    <span>•</span>
                    <span>{it.turns} turns</span>
                    {it.model && <><span>•</span><span>{it.model}</span></>}
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-soft mt-1" />
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Math.random().toString(36).slice(2, 10)}`;
}
