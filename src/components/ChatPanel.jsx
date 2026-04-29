import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Columns2 } from 'lucide-react';
import Mascot from './Mascot.jsx';
import ChatBubble from './ChatBubble.jsx';
import InputBar from './InputBar.jsx';
import ModelSelector from './ModelSelector.jsx';
import DiagnosticPanel from './DiagnosticPanel.jsx';
import { useAppStore } from '../store/useAppStore.js';

/**
 * One chat surface. When the user creates split panes, App.jsx mounts
 * multiple instances of this component side by side.
 */
export default function ChatPanel({ paneId, isActive, showCloseButton, onActivate, onClose }) {
  const pane = useAppStore((s) => s.panes.find((p) => p.id === paneId));
  const scrollerRef = useRef(null);
  const messages = pane?.messages || [];

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!pane) return null;

  return (
    <div
      onMouseDown={onActivate}
      className={`flex flex-col h-full min-h-0 rounded-xl overflow-hidden ${
        isActive ? 'ring-1 ring-cyan-glow/30' : 'opacity-95'
      }`}
    >
      {showCloseButton && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-cyan-glow/10 bg-ink-950/40">
          <Columns2 className="w-3 h-3 text-cyan-soft/70" />
          <span className="text-[11px] font-mono text-slate-400 flex-1 truncate">
            {pane.title || pane.id.slice(0, 6)}
            {pane.sessionId && <span className="text-slate-600 ml-1">· {pane.sessionId.slice(0, 8)}</span>}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-0.5 rounded hover:bg-ink-700 text-slate-500 hover:text-claude-coral"
            title="Close pane"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          <WelcomeView />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => <ChatBubble key={m.id} message={m} paneId={pane.id} />)}
          </AnimatePresence>
        )}
      </div>
      <ModelSelector />
      <InputBar paneId={pane.id} />
      <DiagnosticPanel />
    </div>
  );
}

function WelcomeView() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full grid place-items-center">
      <div className="text-center max-w-md">
        <Mascot size={260} />
        <div className="mt-4 font-display text-2xl font-semibold">
          <span className="bg-gradient-to-r from-cyan-glow via-cyan-soft to-claude-amber bg-clip-text text-transparent">
            Hello — I'm Claude.
          </span>
        </div>
        <div className="text-slate-400 mt-2 text-sm leading-relaxed">
          Ask anything, drop an image, or pick a skill on the right.<br />
          <span className="text-slate-500 text-xs">Press Ctrl+K for the command palette.</span>
        </div>
      </div>
    </motion.div>
  );
}
