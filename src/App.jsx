import React, { useEffect } from 'react';
import { FolderOpen, Clock, X } from 'lucide-react';
import TopBar from './components/TopBar.jsx';
import FileTree from './components/FileTree.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import SkillsPanel from './components/SkillsPanel.jsx';
import FilePreview from './components/FilePreview.jsx';
import FloatingCompanion from './components/FloatingCompanion.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import SessionsPanel from './components/SessionsPanel.jsx';
import ClaudeMdPanel from './components/ClaudeMdPanel.jsx';
import McpLogsPanel from './components/McpLogsPanel.jsx';
import ExportPanel from './components/ExportPanel.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Onboarding from './components/Onboarding.jsx';
import { useAppStore } from './store/useAppStore.js';
import { useClaudeStream } from './hooks/useClaudeStream.js';
import { useShortcuts } from './hooks/useShortcuts.js';

export default function App() {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const projectRootLoaded = useAppStore((s) => s.projectRootLoaded);
  const setProjectRoot = useAppStore((s) => s.setProjectRoot);
  const recentProjects = useAppStore((s) => s.recentProjects);
  const setRecentProjects = useAppStore((s) => s.setRecentProjects);
  const openFile = useAppStore((s) => s.openFile);
  const theme = useAppStore((s) => s.theme);
  const panes = useAppStore((s) => s.panes);
  const activePaneId = useAppStore((s) => s.activePaneId);
  const setActivePane = useAppStore((s) => s.setActivePane);
  const removePane = useAppStore((s) => s.removePane);

  useClaudeStream();
  useShortcuts();

  useEffect(() => {
    const el = document.documentElement;
    for (const t of ['jarvis', 'pink', 'macos']) el.classList.remove(`theme-${t}`);
    el.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    (async () => {
      const api = window.claudeSight;
      if (!api) return;
      const [{ root }, { recents }] = await Promise.all([
        api.getProjectRoot(),
        api.recents.list()
      ]);
      setProjectRoot(root || '');
      setRecentProjects(recents || []);
    })();
  }, [setProjectRoot, setRecentProjects]);

  const chooseFolder = async () => {
    const api = window.claudeSight;
    const res = await api.chooseProjectRoot();
    if (res.canceled) return;
    setProjectRoot(res.root);
    const { recents } = await api.recents.list();
    setRecentProjects(recents || []);
  };

  const openRecent = async (p) => {
    const api = window.claudeSight;
    const res = await api.setProjectRoot(p);
    if (res.ok) setProjectRoot(res.root);
    const { recents } = await api.recents.list();
    setRecentProjects(recents || []);
  };

  const removeRecent = async (p, e) => {
    e.stopPropagation();
    const { recents } = await window.claudeSight.recents.remove(p);
    setRecentProjects(recents || []);
  };

  // Build a column-template that gives equal width to each split pane.
  // Always exactly 1 col when single pane; 2…N when split.
  const paneTemplate = panes.map(() => '1fr').join(' ');

  return (
    <div className="relative h-screen w-screen flex flex-col text-slate-100">
      <TopBar />

      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr_320px] gap-3 px-3 pb-3">
        <aside className="min-h-0 rounded-2xl bg-ink-900/60 border border-cyan-glow/10 backdrop-blur-sm overflow-hidden flex flex-col">
          <FileTree />
        </aside>

        <main className="min-h-0 rounded-2xl bg-ink-900/40 border border-cyan-glow/10 backdrop-blur-sm overflow-hidden flex flex-col">
          {openFile ? <FilePreview /> : (
            <div className="flex-1 min-h-0 grid gap-2" style={{ gridTemplateColumns: paneTemplate }}>
              {panes.map((p) => (
                <ChatPanel
                  key={p.id}
                  paneId={p.id}
                  isActive={p.id === activePaneId}
                  showCloseButton={panes.length > 1}
                  onActivate={() => setActivePane(p.id)}
                  onClose={() => removePane(p.id)}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="min-h-0 rounded-2xl bg-ink-900/60 border border-cyan-glow/10 backdrop-blur-sm overflow-hidden flex flex-col">
          <SkillsPanel />
        </aside>
      </div>

      {/* Modal panels */}
      <SettingsPanel />
      <SessionsPanel />
      <ClaudeMdPanel />
      <McpLogsPanel />
      <ExportPanel />
      <CommandPalette />
      <Onboarding />

      {projectRootLoaded && !projectRoot && (
        <LaunchPicker
          recents={recentProjects}
          onChoose={chooseFolder}
          onPick={openRecent}
          onRemove={removeRecent}
        />
      )}

      {!projectRootLoaded && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
          <div className="text-cyan-soft animate-pulse">Initializing…</div>
        </div>
      )}

      <FloatingCompanion />
    </div>
  );
}

function LaunchPicker({ recents, onChoose, onPick, onRemove }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink-950/85 backdrop-blur-sm">
      <div className="w-[420px] max-w-[90vw] rounded-2xl border border-cyan-glow/15 bg-ink-900/90 p-6 shadow-2xl">
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-soft/70">Claude Sight</div>
        <div className="font-display text-lg font-semibold text-primary mt-1">Choose a folder to start</div>
        <div className="text-xs text-slate-400 mt-1">
          Every command runs against the folder you pick. Nothing is opened automatically.
        </div>
        <button
          onClick={onChoose}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-glow/10 border border-cyan-glow/40 hover:bg-cyan-glow/20 hover:border-cyan-glow/70 text-cyan-soft text-sm font-medium transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          Browse for folder…
        </button>
        {recents && recents.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <Clock className="w-3 h-3" /> Recent
            </div>
            <div className="mt-2 space-y-1 max-h-[280px] overflow-y-auto">
              {recents.map((p) => (
                <div
                  key={p}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md bg-ink-800/60 border border-cyan-glow/10 hover:border-cyan-glow/30 hover:bg-ink-800 transition-colors cursor-pointer"
                  onClick={() => onPick(p)}
                  title={p}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-cyan-soft/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {p.split(/[\\/]/).pop() || p}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{p}</div>
                  </div>
                  <button
                    onClick={(e) => onRemove(p, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-ink-700 text-slate-500 hover:text-slate-300 transition-all"
                    title="Remove from recents"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
