import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Global keyboard shortcuts.
 *
 *   Cmd/Ctrl+K  → Command palette
 *   Cmd/Ctrl+/  → Plan mode toggle (active pane)
 *   Cmd/Ctrl+L  → Clear current chat
 *   Cmd/Ctrl+S  → Open settings
 *   Cmd/Ctrl+M  → Edit CLAUDE.md
 *   Cmd/Ctrl+H  → Past sessions
 *   Cmd/Ctrl+E  → Export
 *   Cmd/Ctrl+T  → New split pane
 *   Cmd/Ctrl+,  → Settings
 *   Esc         → Close any open panel
 */
export function useShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const state = useAppStore.getState();
      const { setPanel, closeAllPanels, panelOpen, addPane, clearChat,
              setPlanMode, panes, activePaneId } = state;

      if (e.key === 'Escape') {
        if (Object.values(panelOpen).some(Boolean)) { closeAllPanels(); }
        return;
      }
      if (!meta) return;

      const trigger = (k) => key === k && !e.shiftKey && !e.altKey;

      if (trigger('k')) { e.preventDefault(); setPanel('palette', !panelOpen.palette); return; }
      if (trigger('/')) {
        e.preventDefault();
        const pane = panes.find((p) => p.id === activePaneId) || panes[0];
        if (pane) setPlanMode(pane.id, !pane.planMode);
        return;
      }
      if (trigger('l')) { e.preventDefault(); clearChat(); return; }
      if (trigger('s') || (key === ',' && meta)) {
        e.preventDefault();
        setPanel('settings', !panelOpen.settings);
        return;
      }
      if (trigger('m')) { e.preventDefault(); setPanel('claudeMd', !panelOpen.claudeMd); return; }
      if (trigger('h')) { e.preventDefault(); setPanel('sessions', !panelOpen.sessions); return; }
      if (trigger('e')) { e.preventDefault(); setPanel('export', !panelOpen.export); return; }
      if (trigger('t')) { e.preventDefault(); addPane('split'); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
