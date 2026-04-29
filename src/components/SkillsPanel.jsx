import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { BUILTIN_SKILLS, parseMcpList } from '../lib/skillRegistry.js';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Right sidebar.
 *
 * Three sections:
 *   1. Skills   — real Claude Code skills discovered from SKILL.md files
 *                 (project/.claude/skills, user ~/.claude/skills, plugin dirs)
 *   2. Quick    — a handful of hardcoded one-click prompts (shortcuts)
 *   3. MCP      — servers reported by `claude mcp list`
 *
 * Clicking a skill dispatches `Use the "<name>" skill.` and its description,
 * which activates the skill in the spawned claude session.
 */
export default function SkillsPanel() {
  const addMessage = useAppStore((s) => s.addMessage);
  const markInflight = useAppStore((s) => s.markInflight);
  const sessionId = useAppStore((s) => s.sessionId);
  const projectRoot = useAppStore((s) => s.projectRoot);

  const activeSkill = useAppStore((s) => s.activeSkill);
  const recentSkills = useAppStore((s) => s.recentSkills);

  const [skills, setSkills] = useState([]);
  const [skillRoots, setSkillRoots] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [openSection, setOpenSection] = useState({ skills: true, quick: false, mcp: true });

  const refresh = async () => {
    setSkillsLoading(true);
    setMcpLoading(true);
    try {
      const [sk, mc] = await Promise.all([
        window.claudeSight.discoverSkills(),
        window.claudeSight.listSkills()
      ]);
      setSkills(sk.skills || []);
      setSkillRoots(sk.roots || []);
      setMcpServers(parseMcpList(mc.raw || ''));
    } finally {
      setSkillsLoading(false);
      setMcpLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [projectRoot]);

  useEffect(() => {
    const api = window.claudeSight;
    if (!api || !api.onMcpRefresh) return;
    const off = api.onMcpRefresh(() => refresh());
    return () => { if (off) off(); };
    // eslint-disable-next-line
  }, []);

  const filteredSkills = useMemo(() => {
    if (!query) return skills;
    const q = query.toLowerCase();
    return skills.filter((s) =>
      s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
    );
  }, [skills, query]);

  const filteredMcp = useMemo(() => {
    if (!query) return mcpServers;
    const q = query.toLowerCase();
    return mcpServers.filter((m) =>
      m.title.toLowerCase().includes(q) || (m.subtitle || '').toLowerCase().includes(q)
    );
  }, [mcpServers, query]);

  const runSkill = async (skill) => {
    const desc = skill.description ? ` (${skill.description.slice(0, 160)})` : '';
    const prompt = `Use the "${skill.name}" skill${desc}. Help me apply it to this project.`;
    dispatchPrompt({ prompt, label: skill.name });
  };

  const runBuiltin = async (b) => dispatchPrompt({ prompt: b.prompt, label: b.title });

  const runMcp = async (m) => dispatchPrompt({ prompt: m.prompt, label: m.title });

  const dispatchPrompt = async ({ prompt, label }) => {
    const messageId = crypto.randomUUID();
    addMessage({ role: 'user', text: prompt, kind: 'skill-trigger', skillTitle: label });
    markInflight(messageId, true);
    const res = await window.claudeSight.sendPrompt({ messageId, prompt, sessionId });
    if (!res.ok) {
      markInflight(messageId, false);
      addMessage({ role: 'system', text: `Failed to start: ${res.error || 'unknown error'}` });
    }
  };

  const toggleSection = (key) => setOpenSection((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-accent/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-accent-soft/70">Skills &amp; MCPs</div>
            <div className="text-xs text-muted">Click to dispatch</div>
          </div>
          <button
            onClick={refresh}
            className="p-1.5 rounded-md hover:bg-ink-700 text-muted hover:text-accent-soft transition-colors"
            title="Refresh"
          >
            <Icons.RefreshCw className={`w-3.5 h-3.5 ${skillsLoading || mcpLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="mt-2 relative">
          <Icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md bg-ink-800/80 border border-accent/10 focus:border-accent/40 outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* --- Real skills --- */}
        <Section
          title="Claude Skills"
          subtitle={`${filteredSkills.length} found`}
          open={openSection.skills}
          onToggle={() => toggleSection('skills')}
        >
          {skillsLoading && <Empty text="Scanning skill folders…" />}
          {!skillsLoading && filteredSkills.length === 0 && (
            <Empty
              text={
                skills.length === 0
                  ? "No SKILL.md files found. Install a skills plugin or add .claude/skills/<name>/SKILL.md."
                  : 'No matches for your search.'
              }
            />
          )}
          {filteredSkills.map((skill, i) => {
            const isActive = activeSkill?.name?.toLowerCase() === skill.name.toLowerCase();
            const wasRecent = recentSkills.some((r) => r.name.toLowerCase() === skill.name.toLowerCase());
            return (
              <SkillCard
                key={skill.id}
                skill={skill}
                delay={i * 0.02}
                onRun={runSkill}
                isActive={isActive}
                wasRecent={wasRecent && !isActive}
              />
            );
          })}
          {skillRoots.length > 0 && filteredSkills.length > 0 && (
            <div className="text-[10px] text-muted/70 pt-1 px-1 font-mono leading-4">
              Scanned: {skillRoots.length} location{skillRoots.length === 1 ? '' : 's'}
            </div>
          )}
        </Section>

        {/* --- Quick actions (built-ins) --- */}
        <Section
          title="Quick actions"
          subtitle={`${BUILTIN_SKILLS.length}`}
          open={openSection.quick}
          onToggle={() => toggleSection('quick')}
        >
          {BUILTIN_SKILLS.map((b, i) => (
            <QuickCard key={b.id} item={b} delay={i * 0.02} onRun={runBuiltin} />
          ))}
        </Section>

        {/* --- MCP servers --- */}
        <Section
          title="MCP Servers"
          subtitle={filteredMcp.length ? `${filteredMcp.length}` : ''}
          open={openSection.mcp}
          onToggle={() => toggleSection('mcp')}
        >
          {mcpLoading && <Empty text="Checking…" />}
          {!mcpLoading && filteredMcp.length === 0 && (
            <Empty text={mcpServers.length === 0 ? "None registered. Add with `claude mcp add`." : 'No matches for your search.'} />
          )}
          {filteredMcp.map((m, i) => (
            <QuickCard key={m.id} item={m} delay={i * 0.02} onRun={runMcp} />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, subtitle, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 py-1 group"
      >
        <div className="flex items-center gap-2">
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <Icons.ChevronRight className="w-3 h-3 text-muted" />
          </motion.span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-accent-soft/80">{title}</span>
        </div>
        {subtitle && <span className="text-[10px] text-muted font-mono">{subtitle}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2 mt-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Empty({ text }) {
  return <div className="text-xs text-muted px-1 py-2 leading-5">{text}</div>;
}

function SkillCard({ skill, delay, onRun, isActive = false, wasRecent = false }) {
  const badge = skill.source === 'project' ? 'project'
              : skill.source === 'user'    ? 'user'
              : skill.source === 'plugin'  ? 'plugin'
              : skill.source;
  const stateBorder = isActive
    ? 'border-accent bg-accent/10 shadow-glow-accent'
    : wasRecent
      ? 'border-accent/30 bg-ink-800/80'
      : 'border-accent/10 bg-ink-800/60 hover:border-accent/50 hover:shadow-glow-accent';
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      onClick={() => onRun(skill)}
      className={`w-full text-left p-3 rounded-xl border transition-all group ${stateBorder}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-accent/10 border border-accent/20 grid place-items-center">
          {isActive ? (
            <motion.span
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            >
              <Icons.Sparkles className="w-3.5 h-3.5 text-accent" />
            </motion.span>
          ) : (
            <Icons.Sparkles className="w-3.5 h-3.5 text-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-primary truncate">{skill.name}</div>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink-700/80 text-muted">
              {badge}
            </span>
            {isActive && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/40">
                active
              </span>
            )}
            {wasRecent && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/10 text-accent-soft">
                recent
              </span>
            )}
          </div>
          {skill.description && (
            <div className="text-xs text-muted mt-0.5 line-clamp-2">{skill.description}</div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function QuickCard({ item, delay, onRun }) {
  const Icon = Icons[item.icon] || Icons.Zap;
  const accent = item.tone === 'amber' ? 'text-accent-2' :
                 item.tone === 'coral' ? 'text-coral' :
                 'text-accent';
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      onClick={() => onRun(item)}
      className="w-full text-left p-2.5 rounded-lg bg-ink-800/60 border border-accent/10 hover:border-accent/40 transition-all"
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 ${accent}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-primary truncate">{item.title}</div>
          <div className="text-[11px] text-muted truncate">{item.subtitle}</div>
        </div>
      </div>
    </motion.button>
  );
}
