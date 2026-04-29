import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Wrench, FlaskConical, MessageSquarePlus, Eye, RefreshCw, Copy } from 'lucide-react';
import { useAppStore, selectActivePane } from '../store/useAppStore.js';

/**
 * Right-click menu for file tree nodes. Each action dispatches a prompt
 * to the active pane referencing the chosen path.
 */
export default function FileTreeContextMenu({ x, y, node, onClose }) {
  const ref = useRef(null);
  const addMessage = useAppStore((s) => s.addMessage);
  const markInflight = useAppStore((s) => s.markInflight);
  const pane = useAppStore(selectActivePane);
  const setOpenFile = useAppStore((s) => s.setOpenFile);

  useEffect(() => {
    const onClick = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  if (!node) return null;

  const label = node.isDir ? `\`${node.path}\` directory` : `\`${node.path}\``;

  const dispatch = async (title, prompt) => {
    onClose();
    if (!pane) return;
    const messageId = crypto.randomUUID();
    addMessage(pane.id, { role: 'user', text: prompt, kind: 'skill-trigger', skillTitle: title });
    markInflight(pane.id, messageId, true);
    const res = await window.claudeSight.sendPrompt({ messageId, prompt, sessionId: pane.sessionId });
    if (!res.ok) markInflight(pane.id, messageId, false);
  };

  const items = node.isDir ? [
    { icon: BookOpen, label: 'Explain this directory', run: () => dispatch('Explain dir', `Explain what ${label} contains and how its parts fit together.`) },
    { icon: Wrench, label: 'Suggest refactors', run: () => dispatch('Refactor dir', `Look at ${label} and suggest concrete refactors. Prioritise readability and reducing duplication. Don't make changes yet.`) },
    { icon: FlaskConical, label: 'Plan tests', run: () => dispatch('Plan tests', `Plan a test suite for ${label}. List the most important cases first. Don't write tests yet.`) },
    { icon: MessageSquarePlus, label: 'Use as chat context', run: () => dispatch('Context', `Use ${label} as primary context for the next questions in this session.`) }
  ] : [
    { icon: Eye, label: 'Preview', run: () => { onClose(); openPreview(node, setOpenFile); } },
    { icon: BookOpen, label: 'Explain', run: () => dispatch('Explain', `Read ${label} and explain what it does at a high level, then walk through the important details.`) },
    { icon: Wrench, label: 'Refactor', run: () => dispatch('Refactor', `Read ${label} and propose specific refactors. Show diffs before making any change.`) },
    { icon: FlaskConical, label: 'Add tests', run: () => dispatch('Add tests', `Read ${label} and add tests covering the main cases. Detect the test runner first.`) },
    { icon: MessageSquarePlus, label: 'Use as chat context', run: () => dispatch('Context', `Use ${label} as primary context for the next questions in this session.`) },
    { icon: Copy, label: 'Copy path', run: () => { try { navigator.clipboard?.writeText(node.path); } catch {} onClose(); } }
  ];

  // Clamp into viewport
  const VW = window.innerWidth, VH = window.innerHeight;
  const W = 220, H = items.length * 32 + 12;
  const left = Math.min(x, VW - W - 8);
  const top = Math.min(y, VH - H - 8);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ left, top }}
      className="fixed z-50 w-[220px] rounded-xl border border-cyan-glow/20 bg-ink-900/98 backdrop-blur shadow-2xl overflow-hidden"
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-soft/70 border-b border-cyan-glow/10 truncate">
        {node.name}
      </div>
      <ul className="py-1">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <li key={i}>
              <button
                onClick={it.run}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:bg-cyan-glow/10"
              >
                <Icon className="w-3.5 h-3.5 text-cyan-soft/80" />
                <span>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

async function openPreview(node, setOpenFile) {
  const res = await window.claudeSight.readFile(node.path);
  if (res.error) return;
  setOpenFile({ path: node.path, content: res.content, ext: res.ext });
}
