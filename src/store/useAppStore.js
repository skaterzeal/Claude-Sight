import { create } from 'zustand';

const THEME_KEY = 'claude-sight:theme';
const VALID_THEMES = ['jarvis', 'pink', 'macos'];

function initialTheme() {
  try {
    const stored = typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY);
    if (stored && VALID_THEMES.includes(stored)) return stored;
  } catch {}
  return 'jarvis';
}

function applyThemeClass(theme) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  for (const t of VALID_THEMES) el.classList.remove(`theme-${t}`);
  el.classList.add(`theme-${theme}`);
}

const newPaneId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `pane-${Math.random().toString(36).slice(2, 10)}`;

function makePane({ title = 'main' } = {}) {
  return {
    id: newPaneId(),
    title,
    messages: [],
    sessionId: null,
    inflight: {},
    planMode: false
  };
}

const PANELS = ['settings', 'claudeMd', 'sessions', 'diagnostic', 'palette', 'onboarding', 'mcpLogs', 'export'];
const initialPanels = () => Object.fromEntries(PANELS.map((k) => [k, false]));

export const useAppStore = create((set, get) => ({
  // ---------------------- Theme ----------------------
  theme: initialTheme(),
  setTheme: (theme) => {
    if (!VALID_THEMES.includes(theme)) return;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    applyThemeClass(theme);
    set({ theme });
  },

  // ---------------------- Project ----------------------
  projectRoot: '',
  projectRootLoaded: false,
  setProjectRoot: (root) => set({ projectRoot: root, projectRootLoaded: true }),

  recentProjects: [],
  setRecentProjects: (list) => set({ recentProjects: Array.isArray(list) ? list : [] }),

  // ---------------------- Panes (split view) ----------------------
  panes: [makePane({ title: 'main' })],
  activePaneId: null, // initialized lazily on first use; we'll set it below
  addPane: (title = 'split') => set((s) => {
    const pane = makePane({ title });
    return { panes: [...s.panes, pane], activePaneId: pane.id };
  }),
  removePane: (paneId) => set((s) => {
    if (s.panes.length <= 1) return {};
    const next = s.panes.filter((p) => p.id !== paneId);
    return {
      panes: next,
      activePaneId: s.activePaneId === paneId ? next[0].id : s.activePaneId
    };
  }),
  setActivePane: (paneId) => set({ activePaneId: paneId }),

  // Per-pane mutators (paneId optional → defaults to active)
  _resolvePane: (paneId) => {
    const s = get();
    return paneId || s.activePaneId || s.panes[0]?.id;
  },
  addMessage: (paneIdOrMsg, maybeMsg) => set((s) => {
    // Backwards-compat: addMessage(msg) targets active pane
    const usingDefault = typeof paneIdOrMsg !== 'string';
    const paneId = usingDefault ? (s.activePaneId || s.panes[0]?.id) : paneIdOrMsg;
    const msg = usingDefault ? paneIdOrMsg : maybeMsg;
    return {
      panes: s.panes.map((p) =>
        p.id === paneId
          ? { ...p, messages: [...p.messages, { id: newPaneId(), ts: Date.now(), ...msg }] }
          : p
      )
    };
  }),
  updateMessage: (idOrPane, patchOrId, maybePatch) => set((s) => {
    // Backwards-compat: updateMessage(msgId, patch) → search across panes.
    // New form: updateMessage(paneId, msgId, patch).
    const explicit = maybePatch !== undefined;
    const paneId = explicit ? idOrPane : null;
    const msgId = explicit ? patchOrId : idOrPane;
    const patch = explicit ? maybePatch : patchOrId;
    return {
      panes: s.panes.map((p) => {
        if (paneId && p.id !== paneId) return p;
        const hit = p.messages.some((m) => m.id === msgId);
        if (!hit) return p;
        return {
          ...p,
          messages: p.messages.map((m) =>
            m.id === msgId
              ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) }
              : m
          )
        };
      })
    };
  }),
  clearChat: (paneId) => set((s) => {
    const target = paneId || s.activePaneId || s.panes[0]?.id;
    return {
      panes: s.panes.map((p) =>
        p.id === target ? { ...p, messages: [], sessionId: null } : p
      )
    };
  }),
  setSessionId: (paneIdOrSid, maybeSid) => set((s) => {
    // Backwards-compat: setSessionId(sid) → active pane.
    // New form: setSessionId(paneId, sid).
    const explicit = maybeSid !== undefined;
    const paneId = explicit ? paneIdOrSid : (s.activePaneId || s.panes[0]?.id);
    const sid = explicit ? maybeSid : paneIdOrSid;
    return {
      panes: s.panes.map((p) => (p.id === paneId ? { ...p, sessionId: sid } : p))
    };
  }),
  setPlanMode: (paneId, on) => set((s) => ({
    panes: s.panes.map((p) => (p.id === paneId ? { ...p, planMode: !!on } : p))
  })),
  loadSessionIntoPane: (paneId, { sessionId, messages }) => set((s) => ({
    panes: s.panes.map((p) =>
      p.id === paneId
        ? { ...p, sessionId, messages: Array.isArray(messages) ? messages : p.messages }
        : p
    )
  })),

  // In-flight tracking per pane
  markInflight: (paneIdOrMsgId, msgIdOrOn, maybeOn) => set((s) => {
    // Backwards-compat: markInflight(msgId, on) → search panes.
    // New form: markInflight(paneId, msgId, on).
    const explicit = maybeOn !== undefined;
    const msgId = explicit ? msgIdOrOn : paneIdOrMsgId;
    const on = explicit ? maybeOn : msgIdOrOn;
    let paneId = explicit ? paneIdOrMsgId : null;
    if (!paneId) {
      // Find pane that already tracks this msgId, else fall back to active.
      const owner = s.panes.find((p) => p.inflight[msgId] || p.messages.some((m) => m.id === msgId || m.assistantFor === msgId));
      paneId = owner?.id || s.activePaneId || s.panes[0]?.id;
    }
    return {
      panes: s.panes.map((p) => {
        if (p.id !== paneId) return p;
        const next = { ...p.inflight };
        if (on) next[msgId] = true;
        else delete next[msgId];
        return { ...p, inflight: next };
      })
    };
  }),

  // Pane lookup by messageId — used by useClaudeStream
  findPaneIdByMessageId: (messageId) => {
    const s = get();
    for (const p of s.panes) {
      if (p.inflight[messageId]) return p.id;
      if (p.messages.some((m) => m.id === messageId || m.assistantFor === messageId)) return p.id;
    }
    return s.activePaneId || s.panes[0]?.id;
  },

  // ---------------------- Bot ----------------------
  typing: false,
  setTyping: (t) => set({ typing: t }),
  botState: () => {
    const { typing, panes } = get();
    const anyInflight = panes.some((p) => Object.keys(p.inflight).length > 0);
    if (anyInflight) return 'processing';
    if (typing) return 'listening';
    return 'idle';
  },

  // ---------------------- File preview ----------------------
  openFile: null,
  setOpenFile: (f) => set({ openFile: f }),

  // ---------------------- Active skill / recents ----------------------
  activeSkill: null,
  setActiveSkill: (info) => set({ activeSkill: info || null }),
  recentSkills: [],
  pushRecentSkill: (info) =>
    set((s) => {
      if (!info?.name) return {};
      const filtered = s.recentSkills.filter((r) => r.name !== info.name);
      return { recentSkills: [{ ...info, ts: Date.now() }, ...filtered].slice(0, 8) };
    }),

  // ---------------------- Panels (settings, claude.md, sessions, etc.) ----------------------
  panelOpen: initialPanels(),
  togglePanel: (key) => set((s) => ({ panelOpen: { ...s.panelOpen, [key]: !s.panelOpen[key] } })),
  setPanel: (key, on) => set((s) => ({ panelOpen: { ...s.panelOpen, [key]: !!on } })),
  closeAllPanels: () => set({ panelOpen: initialPanels() }),

  // ---------------------- Diagnostic log (stderr / raw / mcp) ----------------------
  diagnostics: [], // { ts, kind: 'stderr'|'raw'|'info', source: 'pane'|'mcp', text }
  pushDiagnostic: (entry) =>
    set((s) => ({ diagnostics: [...s.diagnostics.slice(-499), { ts: Date.now(), ...entry }] })),
  clearDiagnostics: () => set({ diagnostics: [] }),

  // ---------------------- Pending images (attachments before send) ----------------------
  pendingImages: [], // [{ path, name }]
  addPendingImage: (img) => set((s) => ({ pendingImages: [...s.pendingImages, img] })),
  removePendingImage: (path) => set((s) => ({ pendingImages: s.pendingImages.filter((i) => i.path !== path) })),
  clearPendingImages: () => set({ pendingImages: [] })
}));

// Set the initial activePaneId after store creation (panes[0] is created above).
{
  const s = useAppStore.getState();
  if (!s.activePaneId) useAppStore.setState({ activePaneId: s.panes[0].id });
}

// ---------------------- Selectors ----------------------
export const selectActivePane = (s) =>
  s.panes.find((p) => p.id === s.activePaneId) || s.panes[0];

export const selectAnyInflight = (s) =>
  s.panes.some((p) => Object.keys(p.inflight).length > 0);

export const selectTotals = (s) => {
  const pane = selectActivePane(s);
  if (!pane) return { cost: 0, tokens: 0, turns: 0 };
  let cost = 0, tokens = 0, turns = 0;
  for (const m of pane.messages) {
    if (m.meta) {
      if (typeof m.meta.cost === 'number') cost += m.meta.cost;
      if (typeof m.meta.numTurns === 'number') turns += m.meta.numTurns;
      if (typeof m.meta.tokens === 'number') tokens += m.meta.tokens;
    }
  }
  return { cost, tokens, turns };
};
