import React, { useState } from 'react';
import { Check, X, FileEdit } from 'lucide-react';
import { useAppStore, selectActivePane } from '../store/useAppStore.js';

/**
 * Inline diff for Edit / Write / MultiEdit tool_use blocks.
 * Pure renderer — Claude has already applied the change by the time we
 * render this. "Reject" sends a follow-up "revert that change" prompt;
 * if we have the original text and an absolute path inside the project
 * we also offer a fast-path local revert via fs.
 */
export default function DiffView({ tool, paneId }) {
  const setActivePane = useAppStore((s) => s.setActivePane);
  const addMessage = useAppStore((s) => s.addMessage);
  const markInflight = useAppStore((s) => s.markInflight);
  const panes = useAppStore((s) => s.panes);
  const [verdict, setVerdict] = useState(null); // 'accepted' | 'rejecting' | 'rejected' | 'reverted' | 'failed'

  const { name, input } = tool;
  const isEdit = name === 'Edit';
  const isMulti = name === 'MultiEdit';
  const isWrite = name === 'Write';
  if (!isEdit && !isMulti && !isWrite) return null;

  const filePath = input?.file_path || input?.path;
  const oldS = isWrite ? '' : (input?.old_string || '');
  const newS = isWrite ? (input?.content || '') : (input?.new_string || '');
  const edits = isMulti ? (input?.edits || []) : null;

  const reject = async () => {
    setVerdict('rejecting');
    // 1) Try a local fast-revert if Edit and we have old_string + project-internal path.
    if (isEdit && filePath && oldS) {
      const res = await window.claudeSight.readFile(filePath);
      if (!res.error && typeof res.content === 'string' && res.content.includes(newS)) {
        const reverted = res.content.replace(newS, oldS);
        const w = await window.claudeSight.writeFileIfInside(filePath, reverted);
        if (w.ok) { setVerdict('reverted'); return; }
      }
    }
    // 2) Fallback: ask Claude to revert in the same session.
    const pane = panes.find((p) => p.id === paneId) || panes[0];
    if (!pane) { setVerdict('failed'); return; }
    setActivePane(pane.id);
    const messageId = crypto.randomUUID();
    const prompt = `Revert the last change you made to ${filePath || 'that file'} — restore it to its previous content. If you can't, explain why.`;
    addMessage(pane.id, { role: 'user', text: prompt, kind: 'skill-trigger', skillTitle: 'Revert' });
    markInflight(pane.id, messageId, true);
    const r = await window.claudeSight.sendPrompt({ messageId, prompt, sessionId: pane.sessionId });
    if (!r.ok) { markInflight(pane.id, messageId, false); setVerdict('failed'); return; }
    setVerdict('rejected');
  };

  return (
    <div className="mt-2 rounded-lg border border-cyan-glow/15 bg-ink-900/60 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-950/40 border-b border-cyan-glow/10">
        <FileEdit className="w-3.5 h-3.5 text-cyan-soft" />
        <span className="font-mono text-[11px] text-cyan-soft">{name}</span>
        <span className="font-mono text-[11px] text-slate-400 truncate flex-1">{filePath || '(no path)'}</span>
        {!verdict && (
          <div className="flex items-center gap-1">
            <button onClick={() => setVerdict('accepted')} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-cyan-glow/10 text-cyan-soft hover:bg-cyan-glow/20">
              <Check className="w-3 h-3" /> Accept
            </button>
            <button onClick={reject} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-claude-coral/10 text-claude-coral hover:bg-claude-coral/20">
              <X className="w-3 h-3" /> Reject
            </button>
          </div>
        )}
        {verdict === 'accepted' && <span className="text-[10px] text-cyan-soft px-2">accepted</span>}
        {verdict === 'rejecting' && <span className="text-[10px] text-claude-amber px-2">reverting…</span>}
        {verdict === 'reverted' && <span className="text-[10px] text-cyan-soft px-2">reverted locally</span>}
        {verdict === 'rejected' && <span className="text-[10px] text-claude-coral px-2">revert requested</span>}
        {verdict === 'failed' && <span className="text-[10px] text-claude-coral px-2">revert failed</span>}
      </div>
      <div className="px-3 py-2 font-mono text-[11px] leading-snug">
        {edits ? edits.map((e, i) => (
          <DiffBlock key={i} oldS={e.old_string || ''} newS={e.new_string || ''} index={i} />
        )) : <DiffBlock oldS={oldS} newS={newS} />}
      </div>
    </div>
  );
}

function DiffBlock({ oldS, newS, index }) {
  const [show, setShow] = useState(true);
  const oldLines = (oldS || '').split('\n');
  const newLines = (newS || '').split('\n');
  return (
    <div className="mb-2">
      {typeof index === 'number' && (
        <button onClick={() => setShow(v => !v)} className="text-[10px] text-slate-500 hover:text-slate-300 mb-1">
          edit {index + 1} {show ? '▾' : '▸'}
        </button>
      )}
      {show && (
        <>
          {oldS && (
            <div className="rounded bg-claude-coral/10 border-l-2 border-claude-coral/50 pl-2 py-1 mb-1">
              {oldLines.map((l, i) => (
                <div key={i} className="text-claude-coral/90 whitespace-pre-wrap break-words">- {l}</div>
              ))}
            </div>
          )}
          {newS && (
            <div className="rounded bg-cyan-glow/10 border-l-2 border-cyan-glow/50 pl-2 py-1">
              {newLines.map((l, i) => (
                <div key={i} className="text-cyan-soft/90 whitespace-pre-wrap break-words">+ {l}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
