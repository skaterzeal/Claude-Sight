import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Clock, File, Folder, FolderOpen, RefreshCw, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import FileTreeContextMenu from './FileTreeContextMenu.jsx';

export default function FileTree() {
  const projectRoot = useAppStore((s) => s.projectRoot);
  const setProjectRoot = useAppStore((s) => s.setProjectRoot);
  const recentProjects = useAppStore((s) => s.recentProjects);
  const setRecentProjects = useAppStore((s) => s.setRecentProjects);
  const setOpenFile = useAppStore((s) => s.setOpenFile);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, node }

  const load = useCallback(async () => {
    if (!projectRoot) return;
    setLoading(true);
    const { children } = await window.claudeSight.readTree(projectRoot);
    setTree(children);
    setLoading(false);
  }, [projectRoot]);

  useEffect(() => { load(); }, [load]);

  const openFile = async (path) => {
    const res = await window.claudeSight.readFile(path);
    if (res.error) {
      setOpenFile({ path, content: `// ${res.error}`, ext: 'txt' });
      return;
    }
    setOpenFile({ path, content: res.content, ext: res.ext });
  };

  const switchTo = async (p) => {
    const api = window.claudeSight;
    const res = await api.setProjectRoot(p);
    if (res.ok) {
      setProjectRoot(res.root);
    }
    const { recents } = await api.recents.list();
    setRecentProjects(recents || []);
  };

  const removeRecent = async (p, e) => {
    e.stopPropagation();
    const api = window.claudeSight;
    const { recents } = await api.recents.remove(p);
    setRecentProjects(recents || []);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-glow/10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-soft/70">Files</div>
          <div className="text-xs font-mono text-slate-400 truncate">{projectRoot?.split(/[\\/]/).pop() || '—'}</div>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-md hover:bg-ink-700 text-slate-400 hover:text-cyan-soft transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Recent projects (collapsible). Hidden when there are no recents. */}
      {recentProjects && recentProjects.length > 0 && (
        <div className="border-b border-cyan-glow/10">
          <button
            onClick={() => setRecentsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 group hover:bg-ink-800/40"
          >
            <div className="flex items-center gap-1.5">
              <motion.span animate={{ rotate: recentsOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronRight className="w-3 h-3 text-slate-500" />
              </motion.span>
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Recent</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{recentProjects.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {recentsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="px-2 pb-2 space-y-1"
              >
                {recentProjects.map((p) => {
                  const isActive = p === projectRoot;
                  return (
                    <div
                      key={p}
                      onClick={() => !isActive && switchTo(p)}
                      title={p}
                      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                        isActive
                          ? 'bg-cyan-glow/10 border border-cyan-glow/30 cursor-default'
                          : 'border border-transparent hover:bg-ink-800/80 hover:border-cyan-glow/20 cursor-pointer'
                      }`}
                    >
                      <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-soft' : 'text-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-medium truncate ${isActive ? 'text-cyan-soft' : 'text-slate-300'}`}>
                          {p.split(/[\\/]/).pop() || p}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{p}</div>
                      </div>
                      <button
                        onClick={(e) => removeRecent(p, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-ink-700 text-slate-500 hover:text-slate-300 transition-all"
                        title="Remove from recents"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2 text-sm">
        {!projectRoot && <div className="px-3 py-6 text-center text-slate-500 text-xs">Pick a folder to begin.</div>}
        {projectRoot && tree === null && <div className="px-3 py-6 text-center text-slate-500 text-xs">Loading…</div>}
        {projectRoot && tree && tree.length === 0 && <div className="px-3 py-6 text-center text-slate-500 text-xs">Empty directory.</div>}
        {projectRoot && tree && tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onOpenFile={openFile}
            onContextMenu={(e, n) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, node: n }); }}
          />
        ))}
      </div>

      {ctxMenu && (
        <FileTreeContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function TreeNode({ node, depth, onOpenFile, onContextMenu }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState(node.children || null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!node.isDir) {
      onOpenFile(node.path);
      return;
    }
    const next = !open;
    setOpen(next);
    if (next && (!children || children.length === 0)) {
      setLoading(true);
      const res = await window.claudeSight.readTree(node.path);
      setChildren(res.children || []);
      setLoading(false);
    }
  };

  const onDragStart = (e) => {
    // Internal MIME so InputBar's drop handler can recognise file refs.
    e.dataTransfer.setData('text/x-cs-path', node.path);
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'copyLink';
  };

  return (
    <div>
      <button
        onClick={toggle}
        onContextMenu={(e) => onContextMenu?.(e, node)}
        draggable
        onDragStart={onDragStart}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-ink-800/60 text-left group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.isDir ? (
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </motion.span>
        ) : (
          <span className="w-3.5" />
        )}
        {node.isDir ? (
          <Folder className="w-3.5 h-3.5 text-cyan-soft/80" />
        ) : (
          <File className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
        )}
        <span className="truncate text-slate-300 group-hover:text-white">{node.name}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {loading && <div className="px-3 py-1 text-xs text-slate-500" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>…</div>}
            {children && children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} onContextMenu={onContextMenu} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
