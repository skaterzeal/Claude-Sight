import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Plus, Trash2, ShieldCheck, Webhook, FolderCog, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * GUI editor for `.claude/settings.json` — covers the two things users
 * actually need: permissions (allow/deny tools) and hooks. Anything we
 * don't recognise is preserved as raw JSON so we never destroy data.
 */
export default function SettingsPanel() {
  const open = useAppStore((s) => s.panelOpen.settings);
  const setPanel = useAppStore((s) => s.setPanel);
  const [scope, setScope] = useState('project');
  const [settings, setSettings] = useState(null);
  const [file, setFile] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await window.claudeSight.settings.get(scope);
      setSettings(res.settings || {});
      setFile(res.file || null);
      setDirty(false);
    })();
  }, [open, scope]);

  const update = (patch) => { setSettings((s) => ({ ...(s || {}), ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    const res = await window.claudeSight.settings.set(scope, settings);
    setSaving(false);
    if (res.ok) setDirty(false);
  };

  if (!open) return null;

  const permissions = settings?.permissions || {};
  const hooks = settings?.hooks || {};

  return (
    <Overlay onClose={() => setPanel('settings', false)}>
      <div className="w-[680px] max-w-[92vw] max-h-[88vh] rounded-2xl border border-cyan-glow/15 bg-ink-900/95 shadow-2xl flex flex-col overflow-hidden">
        <Header title="Settings" subtitle={file || 'unsaved'} onClose={() => setPanel('settings', false)}>
          <ScopeToggle value={scope} onChange={setScope} />
        </Header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          <Section icon={<ShieldCheck className="w-4 h-4" />} title="Permissions" hint="Tool calls allowed/denied without prompting">
            <DefaultModeRow value={permissions.defaultMode || 'default'} onChange={(v) => update({ permissions: { ...permissions, defaultMode: v } })} />
            <ListRow
              label="Allow"
              tone="cyan"
              items={permissions.allow || []}
              placeholder='e.g. Bash(npm test:*) or Edit'
              onAdd={(v) => update({ permissions: { ...permissions, allow: [...(permissions.allow || []), v] } })}
              onRemove={(i) => {
                const next = [...(permissions.allow || [])]; next.splice(i, 1);
                update({ permissions: { ...permissions, allow: next } });
              }}
            />
            <ListRow
              label="Deny"
              tone="coral"
              items={permissions.deny || []}
              placeholder='e.g. Bash(rm -rf:*) or Edit(./.env)'
              onAdd={(v) => update({ permissions: { ...permissions, deny: [...(permissions.deny || []), v] } })}
              onRemove={(i) => {
                const next = [...(permissions.deny || [])]; next.splice(i, 1);
                update({ permissions: { ...permissions, deny: next } });
              }}
            />
            <ListRow
              label="Ask"
              tone="amber"
              items={permissions.ask || []}
              placeholder='e.g. WebFetch'
              onAdd={(v) => update({ permissions: { ...permissions, ask: [...(permissions.ask || []), v] } })}
              onRemove={(i) => {
                const next = [...(permissions.ask || [])]; next.splice(i, 1);
                update({ permissions: { ...permissions, ask: next } });
              }}
            />
          </Section>

          <Section icon={<Webhook className="w-4 h-4" />} title="Hooks" hint="Run scripts before/after tool use, on user prompt, on session events">
            <HooksEditor hooks={hooks} onChange={(h) => update({ hooks: h })} />
          </Section>

          <Section icon={<FolderCog className="w-4 h-4" />} title="Raw JSON" hint="Anything not above. Edit carefully — invalid JSON blocks save.">
            <RawJson value={settings} onChange={setSettings} setDirty={setDirty} />
          </Section>
        </div>

        <Footer dirty={dirty} saving={saving} onSave={save} onClose={() => setPanel('settings', false)} />
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-30 grid place-items-center bg-ink-950/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Header({ title, subtitle, onClose, children }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-cyan-glow/10">
      <div className="flex-1 min-w-0">
        <div className="font-display text-base font-semibold text-primary">{title}</div>
        {subtitle && <div className="text-[11px] font-mono text-slate-500 truncate">{subtitle}</div>}
      </div>
      {children}
      <button onClick={onClose} className="p-1.5 rounded-md hover:bg-ink-700 text-slate-400 hover:text-slate-200">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function Footer({ dirty, saving, onSave, onClose }) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-cyan-glow/10 bg-ink-950/40">
      <div className="text-[11px] text-slate-500">{dirty ? 'Unsaved changes' : 'No changes'}</div>
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs bg-ink-800 hover:bg-ink-700 border border-cyan-glow/10">Close</button>
        <button
          disabled={!dirty || saving}
          onClick={onSave}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
            dirty && !saving
              ? 'bg-cyan-glow text-ink-950 hover:brightness-110'
              : 'bg-ink-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ScopeToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-ink-800 border border-cyan-glow/10 p-0.5">
      <button
        onClick={() => onChange('project')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] ${value === 'project' ? 'bg-cyan-glow/20 text-cyan-soft' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <FolderCog className="w-3 h-3" /> Project
      </button>
      <button
        onClick={() => onChange('user')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] ${value === 'user' ? 'bg-cyan-glow/20 text-cyan-soft' : 'text-slate-400 hover:text-slate-200'}`}
      >
        <User className="w-3 h-3" /> User
      </button>
    </div>
  );
}

function Section({ icon, title, hint, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-cyan-soft">{icon}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-soft/80">{title}</div>
      </div>
      {hint && <div className="text-[11px] text-slate-500 mb-2">{hint}</div>}
      <div className="rounded-xl border border-cyan-glow/10 bg-ink-800/50 p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

function DefaultModeRow({ value, onChange }) {
  const options = [
    { v: 'default', label: 'Default (ask)' },
    { v: 'acceptEdits', label: 'Accept edits' },
    { v: 'bypassPermissions', label: 'Bypass (dangerous)' },
    { v: 'plan', label: 'Plan mode' }
  ];
  return (
    <div>
      <div className="text-[11px] text-slate-400 mb-1">Default mode</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-2 py-1 rounded-md text-[11px] border ${
              value === o.v
                ? 'bg-cyan-glow/15 border-cyan-glow/40 text-cyan-soft'
                : 'bg-ink-900 border-cyan-glow/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListRow({ label, tone, items, placeholder, onAdd, onRemove }) {
  const [v, setV] = useState('');
  const colour = tone === 'coral' ? 'text-claude-coral' : tone === 'amber' ? 'text-claude-amber' : 'text-cyan-soft';
  return (
    <div>
      <div className={`text-[11px] mb-1 ${colour}`}>{label}</div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {items.length === 0 && <span className="text-[11px] text-slate-500">none</span>}
        {items.map((it, i) => (
          <span key={`${it}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-ink-900 border border-cyan-glow/10 text-[11px] font-mono text-slate-300">
            {it}
            <button onClick={() => onRemove(i)} className="text-slate-500 hover:text-claude-coral">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(''); } }}
        className="flex items-center gap-1"
      >
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-2 py-1 rounded bg-ink-900 border border-cyan-glow/10 text-[11px] font-mono outline-none focus:border-cyan-glow/30"
        />
        <button type="submit" className="p-1 rounded bg-cyan-glow/10 hover:bg-cyan-glow/20 text-cyan-soft">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SessionStart', 'SessionEnd', 'Stop'];

function HooksEditor({ hooks, onChange }) {
  const events = useMemo(() => Object.keys(hooks || {}), [hooks]);
  const [newEvent, setNewEvent] = useState(HOOK_EVENTS[0]);

  const addEvent = () => {
    if (!newEvent || hooks[newEvent]) return;
    onChange({ ...hooks, [newEvent]: [{ matcher: '*', hooks: [{ type: 'command', command: '' }] }] });
  };
  const removeEvent = (e) => {
    const next = { ...hooks }; delete next[e]; onChange(next);
  };
  const updateEntry = (event, idx, patch) => {
    const list = [...(hooks[event] || [])];
    list[idx] = { ...list[idx], ...patch };
    onChange({ ...hooks, [event]: list });
  };
  const addEntry = (event) => {
    onChange({ ...hooks, [event]: [...(hooks[event] || []), { matcher: '*', hooks: [{ type: 'command', command: '' }] }] });
  };
  const removeEntry = (event, idx) => {
    const list = [...(hooks[event] || [])]; list.splice(idx, 1);
    onChange({ ...hooks, [event]: list });
  };

  return (
    <div className="space-y-3">
      {events.length === 0 && <div className="text-[11px] text-slate-500">No hooks configured.</div>}
      {events.map((evt) => (
        <div key={evt} className="rounded-lg border border-cyan-glow/10 p-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-cyan-soft">{evt}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => addEntry(evt)} className="p-1 rounded hover:bg-ink-700 text-slate-400">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => removeEvent(evt)} className="p-1 rounded hover:bg-ink-700 text-claude-coral">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          {(hooks[evt] || []).map((entry, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_auto] gap-1 mb-1">
              <input
                value={entry.matcher || ''}
                onChange={(e) => updateEntry(evt, i, { matcher: e.target.value })}
                placeholder="matcher"
                className="px-1.5 py-0.5 rounded bg-ink-900 border border-cyan-glow/10 text-[11px] font-mono outline-none"
              />
              <input
                value={entry.hooks?.[0]?.command || ''}
                onChange={(e) => updateEntry(evt, i, { hooks: [{ type: 'command', command: e.target.value }] })}
                placeholder="command"
                className="px-1.5 py-0.5 rounded bg-ink-900 border border-cyan-glow/10 text-[11px] font-mono outline-none"
              />
              <button onClick={() => removeEntry(evt, i)} className="p-1 rounded hover:bg-ink-700 text-slate-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-1 pt-1">
        <select value={newEvent} onChange={(e) => setNewEvent(e.target.value)} className="px-2 py-1 rounded bg-ink-900 border border-cyan-glow/10 text-[11px]">
          {HOOK_EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={addEvent} className="px-2 py-1 rounded bg-cyan-glow/10 text-cyan-soft text-[11px] hover:bg-cyan-glow/20">
          Add hook event
        </button>
      </div>
    </div>
  );
}

function RawJson({ value, onChange, setDirty }) {
  const [text, setText] = useState(JSON.stringify(value || {}, null, 2));
  const [err, setErr] = useState(null);
  useEffect(() => { setText(JSON.stringify(value || {}, null, 2)); }, [value]);
  const apply = (next) => {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      setErr(null);
      onChange(parsed);
      setDirty(true);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => apply(e.target.value)}
        spellCheck={false}
        className="w-full h-44 px-2 py-1.5 rounded bg-ink-900 border border-cyan-glow/10 text-[11px] font-mono outline-none focus:border-cyan-glow/30 resize-y"
      />
      {err && <div className="text-[10px] text-claude-coral mt-1">{err}</div>}
    </div>
  );
}
