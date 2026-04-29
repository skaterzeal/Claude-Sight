import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Square, Trash2, Minus, Maximize2, X,
  ShieldCheck, FileText, History, ScrollText, Download, Columns2, Command, BookOpen
} from 'lucide-react';
import { useAppStore, selectAnyInflight, selectActivePane } from '../store/useAppStore.js';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import ActiveSkillChip from './ActiveSkillChip.jsx';
import GitStatus from './GitStatus.jsx';
import CostBadge from './CostBadge.jsx';
import PlanModeToggle from './PlanModeToggle.jsx';

export default function TopBar() {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const setProjectRoot = useAppStore((s) => s.setProjectRoot);
  const setRecentProjects = useAppStore((s) => s.setRecentProjects);
  const clearChat = useAppStore((s) => s.clearChat);
  const anyInflight = useAppStore(selectAnyInflight);
  const activePane = useAppStore(selectActivePane);
  const panes = useAppStore((s) => s.panes);
  const addPane = useAppStore((s) => s.addPane);
  const setPanel = useAppStore((s) => s.setPanel);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const markInflight = useAppStore((s) => s.markInflight);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = window.claudeSight;
    if (!api) return;
    const offMax = api.onMaximized(() => setIsMaximized(true));
    const offUnmax = api.onUnmaximized(() => setIsMaximized(false));
    return () => { offMax(); offUnmax(); };
  }, []);

  const chooseFolder = async () => {
    const api = window.claudeSight;
    const res = await api.chooseProjectRoot();
    if (res.canceled) return;
    setProjectRoot(res.root);
    const { recents } = await api.recents.list();
    setRecentProjects(recents || []);
  };

  const stopAll = async () => {
    await window.claudeSight.stopPrompt(null);
    for (const p of panes) {
      for (const m of p.messages) {
        if (m.status === 'streaming') updateMessage(p.id, m.id, { status: 'stopped', error: 'Stopped by user' });
      }
      for (const id of Object.keys(p.inflight)) markInflight(p.id, id, false);
    }
  };

  return (
    <header className="app-drag relative z-50 flex items-center gap-2 px-4 py-3 border-b border-cyan-glow/10 bg-ink-950/60 backdrop-blur">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2.5 mr-1"
      >
        <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-ink-800 border border-accent/20 grid place-items-center shadow-glow-accent">
          <img src="./claudelogo.png" alt="Claude Sight" className="w-full h-full object-cover" draggable={false} />
        </div>
        <div>
          <div className="font-display text-sm font-semibold leading-none text-primary">Claude Sight</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-accent-soft/70">Command Center</div>
        </div>
      </motion.div>

      <GitStatus />
      <PlanModeToggle />
      <CostBadge />

      <div className="flex-1" />

      <ActiveSkillChip />

      {/* Panel quick-buttons */}
      <PanelButton icon={Command} title="Command palette (Ctrl+K)" onClick={() => setPanel('palette', true)} />
      <PanelButton icon={ShieldCheck} title="Settings · permissions, hooks (Ctrl+S)" onClick={() => setPanel('settings', true)} />
      <PanelButton icon={FileText} title="CLAUDE.md (Ctrl+M)" onClick={() => setPanel('claudeMd', true)} />
      <PanelButton icon={History} title="Past sessions (Ctrl+H)" onClick={() => setPanel('sessions', true)} />
      <PanelButton icon={ScrollText} title="MCP logs" onClick={() => setPanel('mcpLogs', true)} />
      <PanelButton icon={Download} title="Export (Ctrl+E)" onClick={() => setPanel('export', true)} />
      <PanelButton icon={BookOpen} title="Help / onboarding" onClick={() => setPanel('onboarding', true)} />
      <PanelButton icon={Columns2} title="New split pane (Ctrl+T)" onClick={() => addPane('split')} />

      <button
        onClick={chooseFolder}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-ink-800 hover:bg-ink-700 border border-accent/10 hover:border-accent/30 transition-colors"
        title={projectRoot}
      >
        <FolderOpen className="w-3.5 h-3.5 text-accent-soft" />
        <span className="max-w-[260px] truncate font-mono text-slate-300">
          {projectRoot ? projectRoot.split(/[\\/]/).pop() : 'Choose folder…'}
        </span>
      </button>

      <ThemeSwitcher />

      <button
        onClick={() => clearChat(activePane?.id)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-ink-800 hover:bg-ink-700 border border-accent/10 hover:border-accent/30 transition-colors"
        title="Clear current chat (Ctrl+L)"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <motion.button
        onClick={stopAll}
        disabled={!anyInflight}
        animate={anyInflight ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 1.2, repeat: anyInflight ? Infinity : 0 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          anyInflight
            ? 'bg-claude-coral/90 text-white border-claude-coral hover:bg-claude-coral shadow-glow-amber'
            : 'bg-ink-800 text-slate-500 border-ink-700 cursor-not-allowed'
        }`}
      >
        <Square className="w-3.5 h-3.5" />
        <span>{anyInflight ? 'Abort' : 'Idle'}</span>
      </motion.button>

      <div className="flex items-center gap-0.5 ml-1 border-l border-cyan-glow/10 pl-2">
        <button onClick={() => window.claudeSight.minimizeWindow()} className="p-1.5 rounded-md hover:bg-ink-700 text-slate-400 hover:text-white" title="Minimize">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => window.claudeSight.maximizeWindow()} className="p-1.5 rounded-md hover:bg-ink-700 text-slate-400 hover:text-white" title={isMaximized ? 'Restore' : 'Maximize'}>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => window.claudeSight.closeWindow()} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400" title="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}

function PanelButton({ icon: Icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md hover:bg-ink-800 text-slate-400 hover:text-cyan-soft transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
