import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ScrollText, Plug, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { parseMcpList } from '../lib/skillRegistry.js';

export default function McpLogsPanel() {
  const open = useAppStore((s) => s.panelOpen.mcpLogs);
  const setPanel = useAppStore((s) => s.setPanel);
  const [servers, setServers] = useState([]);
  const [active, setActive] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const loadServers = async () => {
    const res = await window.claudeSight.listSkills();
    const parsed = parseMcpList(res.raw || '');
    setServers(parsed);
    if (parsed[0] && !active) setActive(parsed[0].title);
  };
  useEffect(() => { if (open) loadServers(); }, [open]);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    window.claudeSight.mcpLogs(active).then((res) => {
      setContent(res.content || '(no content)');
      setLoading(false);
    });
  }, [active]);

  if (!open) return null;

  return (
    <div onClick={() => setPanel('mcpLogs', false)} className="absolute inset-0 z-30 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-[820px] max-w-[94vw] h-[78vh] rounded-2xl border border-cyan-glow/15 bg-ink-900/95 shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-cyan-glow/10">
          <ScrollText className="w-4 h-4 text-cyan-soft" />
          <div className="font-display text-base font-semibold text-primary flex-1">MCP server logs</div>
          <button onClick={loadServers} className="p-1.5 rounded hover:bg-ink-700 text-slate-400">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setPanel('mcpLogs', false)} className="p-1.5 rounded hover:bg-ink-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr]">
          <div className="border-r border-cyan-glow/10 overflow-y-auto p-2 space-y-1">
            {servers.length === 0 && <div className="text-xs text-slate-500 px-2 py-3">No MCP servers.</div>}
            {servers.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.title)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs ${
                  active === s.title ? 'bg-cyan-glow/15 text-cyan-soft' : 'text-slate-300 hover:bg-ink-800'
                }`}
              >
                <Plug className="w-3 h-3" />
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap text-slate-300">
            {loading ? 'Loading…' : content}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
