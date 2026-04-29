import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, FileText, FolderCog, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * CLAUDE.md editor — project memory or user-global memory.
 * Plain textarea: nothing fancy, just edit & save.
 */
export default function ClaudeMdPanel() {
  const open = useAppStore((s) => s.panelOpen.claudeMd);
  const setPanel = useAppStore((s) => s.setPanel);
  const [scope, setScope] = useState('project');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [original, setOriginal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await window.claudeSight.claudeMd.get(scope);
      setContent(res.content || '');
      setOriginal(res.content || '');
      setFile(res.file || null);
    })();
  }, [open, scope]);

  if (!open) return null;

  const dirty = content !== original;

  const save = async () => {
    setSaving(true);
    const res = await window.claudeSight.claudeMd.set(scope, content);
    setSaving(false);
    if (res.ok) setOriginal(content);
  };

  return (
    <div onClick={() => setPanel('claudeMd', false)} className="absolute inset-0 z-30 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-[820px] max-w-[94vw] h-[80vh] rounded-2xl border border-cyan-glow/15 bg-ink-900/95 shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-cyan-glow/10">
          <FileText className="w-4 h-4 text-cyan-soft" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-semibold text-primary">CLAUDE.md</div>
            <div className="text-[11px] font-mono text-slate-500 truncate">{file || 'unsaved'}</div>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-ink-800 border border-cyan-glow/10 p-0.5">
            <button onClick={() => setScope('project')} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] ${scope === 'project' ? 'bg-cyan-glow/20 text-cyan-soft' : 'text-slate-400'}`}>
              <FolderCog className="w-3 h-3" /> Project
            </button>
            <button onClick={() => setScope('user')} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] ${scope === 'user' ? 'bg-cyan-glow/20 text-cyan-soft' : 'text-slate-400'}`}>
              <User className="w-3 h-3" /> User
            </button>
          </div>
          <button onClick={() => setPanel('claudeMd', false)} className="p-1.5 rounded hover:bg-ink-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          placeholder="# Project memory&#10;Anything written here is read by Claude on every session.&#10;Use it to set conventions, paths, do/don't lists, important context."
          className="flex-1 px-5 py-4 bg-ink-950/40 outline-none font-mono text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 resize-none"
        />

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-cyan-glow/10 bg-ink-950/40">
          <div className="text-[11px] text-slate-500">
            {dirty ? `${content.length} chars (unsaved)` : `${content.length} chars`}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel('claudeMd', false)} className="px-3 py-1.5 rounded-lg text-xs bg-ink-800 hover:bg-ink-700 border border-cyan-glow/10">Close</button>
            <button
              disabled={!dirty || saving}
              onClick={save}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                dirty && !saving ? 'bg-cyan-glow text-ink-950 hover:brightness-110' : 'bg-ink-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
