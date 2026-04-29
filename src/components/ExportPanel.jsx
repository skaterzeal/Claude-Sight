import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, FileText, FileJson, FileType } from 'lucide-react';
import { useAppStore, selectActivePane } from '../store/useAppStore.js';

export default function ExportPanel() {
  const open = useAppStore((s) => s.panelOpen.export);
  const setPanel = useAppStore((s) => s.setPanel);
  const pane = useAppStore(selectActivePane);
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState(null);

  if (!open) return null;

  const exportAs = async (format) => {
    setBusy(true);
    setSavedTo(null);
    const content = format === 'json' ? toJson(pane) : format === 'txt' ? toText(pane) : toMarkdown(pane);
    const ext = format === 'json' ? 'json' : format === 'txt' ? 'txt' : 'md';
    const defaultName = `claude-${(pane?.title || 'session')}-${Date.now()}.${ext}`;
    const res = await window.claudeSight.exportSave(defaultName, content);
    setBusy(false);
    if (res.ok) setSavedTo(res.file);
  };

  return (
    <div onClick={() => setPanel('export', false)} className="absolute inset-0 z-30 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-[420px] rounded-2xl border border-cyan-glow/15 bg-ink-900/95 shadow-2xl"
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-cyan-glow/10">
          <Download className="w-4 h-4 text-cyan-soft" />
          <div className="font-display text-base font-semibold text-primary flex-1">Export conversation</div>
          <button onClick={() => setPanel('export', false)} className="p-1.5 rounded hover:bg-ink-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <ExportButton icon={<FileText className="w-4 h-4" />} label="Markdown" hint=".md, readable" onClick={() => exportAs('md')} />
          <ExportButton icon={<FileJson className="w-4 h-4" />} label="JSON" hint=".json, structured" onClick={() => exportAs('json')} />
          <ExportButton icon={<FileType className="w-4 h-4" />} label="Plain text" hint=".txt, no formatting" onClick={() => exportAs('txt')} />
          {busy && <div className="text-xs text-slate-400 px-1">Saving…</div>}
          {savedTo && <div className="text-xs text-cyan-soft px-1 break-all">Saved → {savedTo}</div>}
        </div>
      </motion.div>
    </div>
  );
}

function ExportButton({ icon, label, hint, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl border border-cyan-glow/10 bg-ink-800/60 hover:border-cyan-glow/40 hover:bg-ink-800">
      <div className="text-cyan-soft">{icon}</div>
      <div className="flex-1 text-left">
        <div className="text-sm text-slate-200">{label}</div>
        <div className="text-[11px] text-slate-500">{hint}</div>
      </div>
    </button>
  );
}

function toMarkdown(pane) {
  if (!pane) return '';
  const lines = [`# Claude session — ${pane.title || 'main'}`, ''];
  if (pane.sessionId) lines.push(`Session: \`${pane.sessionId}\``, '');
  for (const m of pane.messages) {
    const ts = new Date(m.ts || Date.now()).toLocaleString();
    if (m.role === 'user') {
      lines.push(`## You · ${ts}`, '', m.text || '', '');
    } else if (m.role === 'assistant') {
      lines.push(`## Claude · ${ts}`, '', m.text || '', '');
      for (const t of m.tools || []) {
        lines.push('```json', `// tool: ${t.name}`, JSON.stringify(t.input, null, 2), '```', '');
      }
    } else {
      lines.push(`> ${m.text}`, '');
    }
  }
  return lines.join('\n');
}

function toText(pane) {
  return toMarkdown(pane).replace(/```[a-z]*\n?/g, '').replace(/```/g, '').replace(/^#+\s/gm, '');
}

function toJson(pane) {
  return JSON.stringify(
    { sessionId: pane?.sessionId, title: pane?.title, messages: pane?.messages || [] },
    null,
    2
  );
}
