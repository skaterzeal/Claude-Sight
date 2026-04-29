import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { extractText, extractToolUses, extractToolResults } from '../lib/streamEvents.js';

function detectActiveSkill(tools) {
  for (const t of tools) {
    if (!t || !t.name) continue;
    if (t.name === 'Skill' || t.name === 'skill') {
      const n = t.input?.skill || t.input?.name;
      if (n) return { name: String(n), source: 'skill', kind: 'skill' };
    }
    const mcp = t.name.match(/^mcp__([\w-]+)__/);
    if (mcp) return { name: mcp[1], source: 'mcp', kind: 'plugin' };
    const plug = t.name.match(/^plugin[:_-]([\w-]+)/i);
    if (plug) return { name: plug[1], source: 'plugin', kind: 'plugin' };
  }
  return null;
}

export function useClaudeStream() {
  useEffect(() => {
    const api = window.claudeSight;
    if (!api) return;

    const off = api.onStream(({ messageId, event }) => {
      if (!event) return;
      const state = useAppStore.getState();
      const { findPaneIdByMessageId, addMessage, updateMessage, setSessionId,
              markInflight, setActiveSkill, pushRecentSkill, pushDiagnostic } = state;
      const paneId = findPaneIdByMessageId(messageId);
      const pane = state.panes.find((p) => p.id === paneId);
      if (!pane) return;

      let bubble = pane.messages.find((m) => m.assistantFor === messageId);
      const ensureBubble = () => {
        if (bubble) return bubble;
        addMessage(paneId, {
          role: 'assistant',
          assistantFor: messageId,
          text: '',
          tools: [],
          results: [],
          status: 'streaming'
        });
        bubble = useAppStore.getState().panes.find((p) => p.id === paneId)
          ?.messages.find((m) => m.assistantFor === messageId);
        return bubble;
      };

      switch (event.type) {
        case 'system': {
          if (event.session_id) setSessionId(paneId, event.session_id);
          break;
        }
        case 'assistant': {
          const msg = event.message || {};
          const blocks = msg.content || [];
          const text = extractText(blocks);
          const tools = extractToolUses(blocks);
          // Surface token usage if present.
          const usage = msg.usage || event.usage;
          const b = ensureBubble();
          updateMessage(paneId, b.id, (prev) => {
            const tokensSoFar = (prev.meta?.tokens || 0) +
              ((usage?.input_tokens || 0) + (usage?.output_tokens || 0));
            return {
              text: (prev.text || '') + text,
              tools: [...(prev.tools || []), ...tools],
              meta: { ...(prev.meta || {}), tokens: tokensSoFar }
            };
          });
          const active = detectActiveSkill(tools);
          if (active) { setActiveSkill(active); pushRecentSkill(active); }
          break;
        }
        case 'user': {
          const msg = event.message || {};
          const blocks = msg.content || [];
          const results = extractToolResults(blocks);
          if (results.length) {
            const b = ensureBubble();
            updateMessage(paneId, b.id, (prev) => ({
              results: [...(prev.results || []), ...results]
            }));
          }
          break;
        }
        case 'result': {
          const b = ensureBubble();
          const finalText = typeof event.result === 'string' ? event.result : '';
          updateMessage(paneId, b.id, (prev) => ({
            text: prev.text && prev.text.length > 0 ? prev.text : finalText || prev.text,
            status: event.subtype === 'success' ? 'done' : 'error',
            meta: {
              ...(prev.meta || {}),
              cost: event.total_cost_usd,
              duration: event.duration_ms,
              numTurns: event.num_turns
            }
          }));
          if (event.session_id) setSessionId(paneId, event.session_id);
          markInflight(paneId, messageId, false);
          setActiveSkill(null);
          break;
        }
        case 'stdout': {
          const b = ensureBubble();
          updateMessage(paneId, b.id, (prev) => ({
            text: (prev.text || '') + event.text
          }));
          break;
        }
        case 'stderr': {
          // Forward to diagnostic panel (still hidden from chat).
          if (event.text) pushDiagnostic({ kind: 'stderr', source: pane.title || paneId, text: event.text });
          break;
        }
        case 'error': {
          const b = ensureBubble();
          updateMessage(paneId, b.id, { status: 'error', error: event.message });
          if (event.message) pushDiagnostic({ kind: 'stderr', source: pane.title || paneId, text: event.message });
          markInflight(paneId, messageId, false);
          setActiveSkill(null);
          break;
        }
        case 'done': {
          const b = ensureBubble();
          if (b && b.status === 'streaming') {
            updateMessage(paneId, b.id, {
              status: event.code === 0 ? 'done' : 'error',
              error: event.code !== 0 ? (event.stderr || `exit ${event.code}`) : undefined
            });
          }
          if (event.code !== 0 && event.stderr) {
            pushDiagnostic({ kind: 'stderr', source: pane.title || paneId, text: event.stderr });
          }
          markInflight(paneId, messageId, false);
          setActiveSkill(null);
          break;
        }
        case 'raw': {
          if (event.text && /^[{[]/.test(event.text)) return;
          if (event.text) pushDiagnostic({ kind: 'raw', source: pane.title || paneId, text: event.text });
          break;
        }
        default:
          break;
      }
    });

    return () => { if (off) off(); };
  }, []);
}
