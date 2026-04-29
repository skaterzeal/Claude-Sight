import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Loader2, Terminal, FolderOpen, Sparkles, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

const ONBOARD_KEY = 'claude-sight:onboarded';

/**
 * First-run helper. Walks the user through:
 *   1. Is the `claude` CLI on PATH? (and which version)
 *   2. Pick a folder
 *   3. (Optional) try a skill
 *
 * Auto-shown the first time, then dismissible.
 */
export default function Onboarding() {
  const open = useAppStore((s) => s.panelOpen.onboarding);
  const setPanel = useAppStore((s) => s.setPanel);
  const projectRoot = useAppStore((s) => s.projectRoot);
  const projectRootLoaded = useAppStore((s) => s.projectRootLoaded);
  const setProjectRoot = useAppStore((s) => s.setProjectRoot);
  const setRecentProjects = useAppStore((s) => s.setRecentProjects);

  const [detect, setDetect] = useState(null); // null = loading

  // Auto-show on first run.
  useEffect(() => {
    if (!projectRootLoaded) return;
    let seen = false;
    try { seen = localStorage.getItem(ONBOARD_KEY) === '1'; } catch {}
    if (!seen) setPanel('onboarding', true);
  }, [projectRootLoaded, setPanel]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setDetect(null);
      const res = await window.claudeSight.detectClaude();
      setDetect(res);
    })();
  }, [open]);

  if (!open) return null;

  const dismiss = () => {
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch {}
    setPanel('onboarding', false);
  };

  const chooseFolder = async () => {
    const api = window.claudeSight;
    const res = await api.chooseProjectRoot();
    if (res.canceled) return;
    setProjectRoot(res.root);
    const { recents } = await api.recents.list();
    setRecentProjects(recents || []);
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-[480px] max-w-[92vw] rounded-2xl border border-cyan-glow/15 bg-ink-900/95 shadow-2xl"
      >
        <div className="flex items-center gap-2 px-5 py-3 border-b border-cyan-glow/10">
          <Sparkles className="w-4 h-4 text-cyan-soft" />
          <div className="font-display text-base font-semibold text-primary flex-1">Welcome to Claude Sight</div>
          <button onClick={dismiss} className="p-1.5 rounded hover:bg-ink-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Step
            icon={<Terminal className="w-4 h-4" />}
            title="Claude CLI"
            status={detect === null ? 'loading' : (detect.ok ? 'ok' : 'fail')}
            detail={detect === null ? 'Looking for `claude` on PATH…' :
              detect.ok ? `Found ${detect.version}` : (
                <>
                  Could not run <code className="font-mono text-claude-coral">{detect?.bin}</code>.
                  Install Claude Code, then restart this app.
                  <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noreferrer" className="ml-1 text-cyan-soft underline">Install guide</a>
                </>
              )
            }
          />
          <Step
            icon={<FolderOpen className="w-4 h-4" />}
            title="Project folder"
            status={projectRoot ? 'ok' : 'pending'}
            detail={projectRoot
              ? <span className="font-mono text-[11px]">{projectRoot}</span>
              : <button onClick={chooseFolder} className="text-cyan-soft underline">Pick one now</button>}
          />
          <Step
            icon={<Sparkles className="w-4 h-4" />}
            title="Try a skill or slash command"
            status="info"
            detail={<>Type <code className="font-mono text-cyan-soft">/help</code> in chat, or click any item in the right panel.</>}
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-cyan-glow/10 bg-ink-950/40">
          <button onClick={dismiss} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-glow text-ink-950 hover:brightness-110">
            Got it <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Step({ icon, title, status, detail }) {
  const Icon = status === 'ok' ? CheckCircle2 : status === 'fail' ? AlertCircle : status === 'loading' ? Loader2 : null;
  const colour = status === 'ok' ? 'text-cyan-soft' : status === 'fail' ? 'text-claude-coral' : status === 'loading' ? 'text-claude-amber' : 'text-slate-400';
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-800/60 border border-cyan-glow/10">
      <div className={`mt-0.5 ${colour}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          {title}
          {Icon && <Icon className={`w-3.5 h-3.5 ${colour} ${status === 'loading' ? 'animate-spin' : ''}`} />}
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">{detail}</div>
      </div>
    </div>
  );
}
