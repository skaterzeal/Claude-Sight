import React, { useEffect, useState } from 'react';
import { GitBranch, CircleDot, ArrowUp, ArrowDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Compact git rozet for the TopBar. Polls when projectRoot changes.
 * Click → dispatch a "review my staged changes" prompt.
 */
export default function GitStatus() {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const addMessage = useAppStore((s) => s.addMessage);
  const markInflight = useAppStore((s) => s.markInflight);
  const activePaneId = useAppStore((s) => s.activePaneId);
  const panes = useAppStore((s) => s.panes);
  const sessionId = panes.find((p) => p.id === activePaneId)?.sessionId || null;
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!projectRoot) { setInfo(null); return; }
      const res = await window.claudeSight.git.status();
      if (!cancelled) setInfo(res);
    };
    refresh();
    const t = setInterval(refresh, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [projectRoot]);

  if (!info?.ok) return null;

  const reviewDiff = async () => {
    const messageId = crypto.randomUUID();
    const prompt = 'Run `git diff --staged` (or `git diff` if nothing is staged). Review the changes as a code reviewer: flag bugs, regressions, and anything surprising.';
    addMessage(activePaneId, { role: 'user', text: prompt, kind: 'skill-trigger', skillTitle: 'Review diff' });
    markInflight(activePaneId, messageId, true);
    const res = await window.claudeSight.sendPrompt({ messageId, prompt, sessionId });
    if (!res.ok) markInflight(activePaneId, messageId, false);
  };

  return (
    <button
      onClick={reviewDiff}
      title={`${info.branch}${info.dirty ? ` · ${info.dirtyCount} changed` : ''} — click to review diff`}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono bg-ink-800/80 hover:bg-ink-700 border border-cyan-glow/10 hover:border-cyan-glow/30 transition-colors"
    >
      <GitBranch className="w-3 h-3 text-cyan-soft/70" />
      <span className="text-slate-300 max-w-[120px] truncate">{info.branch}</span>
      {info.dirty && <CircleDot className="w-2.5 h-2.5 text-claude-amber" />}
      {info.ahead > 0 && <span className="flex items-center text-cyan-soft/70"><ArrowUp className="w-2.5 h-2.5" />{info.ahead}</span>}
      {info.behind > 0 && <span className="flex items-center text-claude-coral/70"><ArrowDown className="w-2.5 h-2.5" />{info.behind}</span>}
    </button>
  );
}
