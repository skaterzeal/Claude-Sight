import React from 'react';
import { motion } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Wrench, AlertTriangle, CheckCircle2, StopCircle, User, Sparkles, TerminalSquare, Wind } from 'lucide-react';
import DiffView from './DiffView.jsx';

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

/**
 * A single chat bubble. Handles three roles: user, assistant, system.
 * Assistant bubbles may include tool_use calls and tool_result replies.
 */
export default function ChatBubble({ message, paneId }) {
  if (message.role === 'user') return <UserBubble m={message} />;
  if (message.role === 'system') return <SystemBubble m={message} />;
  return <AssistantBubble m={message} paneId={paneId} />;
}

function UserBubble({ m }) {
  const isCommand = m.kind === 'command';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[75%] flex items-start gap-2">
        <div
          className={
            isCommand
              ? 'rounded-2xl rounded-tr-sm px-4 py-2.5 bg-gradient-to-br from-claude-amber/20 to-claude-amber/5 border border-claude-amber/40 text-slate-100'
              : 'rounded-2xl rounded-tr-sm px-4 py-2.5 bg-gradient-to-br from-cyan-glow/20 to-cyan-glow/5 border border-cyan-glow/30 text-slate-100'
          }
        >
          {m.kind === 'skill-trigger' && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-soft/70 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {m.skillTitle || 'Skill'}
            </div>
          )}
          {isCommand && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-claude-amber mb-1 flex items-center gap-1">
              <TerminalSquare className="w-3 h-3" /> Slash command
            </div>
          )}
          {m.kind === 'redirect' && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-claude-amber mb-1 flex items-center gap-1">
              <Wind className="w-3 h-3" /> Redirect
            </div>
          )}
          {isCommand ? (
            <pre className="font-mono text-[13px] text-claude-amber whitespace-pre-wrap break-words">{m.text}</pre>
          ) : (
            <MarkdownText text={m.text} />
          )}
        </div>
        <div className="shrink-0 w-8 h-8 rounded-full bg-ink-800 border border-cyan-glow/20 grid place-items-center mt-0.5">
          {isCommand
            ? <TerminalSquare className="w-4 h-4 text-claude-amber" />
            : <User className="w-4 h-4 text-cyan-soft" />}
        </div>
      </div>
    </motion.div>
  );
}

function SystemBubble({ m }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
      <div className="px-3 py-1.5 rounded-full bg-ink-800/80 border border-cyan-glow/10 text-xs text-slate-400">
        {m.text}
      </div>
    </motion.div>
  );
}

function AssistantBubble({ m, paneId }) {
  const isStreaming = m.status === 'streaming';
  const isError = m.status === 'error';
  const isStopped = m.status === 'stopped';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="max-w-[85%] flex items-start gap-2">
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-glow to-claude-amber grid place-items-center mt-0.5 shadow-glow-cyan">
          <div className="w-2 h-2 rounded-full bg-ink-950" />
        </div>
        <div className="min-w-0 rounded-2xl rounded-tl-sm px-4 py-2.5 bg-ink-800/70 border border-cyan-glow/10 text-slate-100">
          {m.text && <MarkdownText text={m.text} />}
          {m.tools?.map((t) =>
            EDIT_TOOLS.has(t.name)
              ? <DiffView key={t.id} tool={t} paneId={paneId} />
              : <ToolCallRow key={t.id} tool={t} />
          )}
          {m.results?.map((r, i) => <ToolResultRow key={`${r.id}-${i}`} result={r} />)}

          {isStreaming && (
            <div className="mt-2 flex items-center gap-2 text-xs text-cyan-soft/80">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-cyan-glow"
              />
              Thinking…
            </div>
          )}
          {isError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-claude-coral">
              <AlertTriangle className="w-3.5 h-3.5" /> {m.error || 'Error'}
            </div>
          )}
          {isStopped && (
            <div className="mt-2 flex items-center gap-2 text-xs text-claude-amber">
              <StopCircle className="w-3.5 h-3.5" /> Stopped
            </div>
          )}
          {m.status === 'done' && m.meta && (
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-cyan-glow/70" /> done</span>
              {typeof m.meta.duration === 'number' && <span>{(m.meta.duration / 1000).toFixed(1)}s</span>}
              {typeof m.meta.cost === 'number' && <span>${m.meta.cost.toFixed(4)}</span>}
              {typeof m.meta.numTurns === 'number' && <span>{m.meta.numTurns} turns</span>}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ToolCallRow({ tool }) {
  return (
    <div className="mt-2 rounded-lg border border-claude-amber/30 bg-claude-amber/5 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-claude-amber">
        <Wrench className="w-3.5 h-3.5" />
        <span className="font-mono">{tool.name}</span>
      </div>
      {tool.input && Object.keys(tool.input).length > 0 && (
        <pre className="mt-1.5 text-[11px] font-mono text-slate-300/80 whitespace-pre-wrap break-words">
{JSON.stringify(tool.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultRow({ result }) {
  const short = (result.content || '').length > 600;
  const [expanded, setExpanded] = React.useState(false);
  const text = short && !expanded ? result.content.slice(0, 600) + '…' : result.content;
  return (
    <div className="mt-1.5 rounded-lg border border-cyan-glow/15 bg-cyan-glow/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-soft/70 mb-1">Tool result</div>
      <pre className="text-[11px] font-mono text-slate-300/90 whitespace-pre-wrap break-words">{text}</pre>
      {short && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-[11px] text-cyan-soft hover:text-cyan-glow">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

/**
 * Tiny markdown renderer — enough for headings, inline code, and fenced code blocks.
 * Avoids pulling in a heavy markdown dep just to render CLI output.
 */
function MarkdownText({ text }) {
  if (!text) return null;
  const parts = [];
  const re = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<InlineText key={`t-${i++}`} text={text.slice(last, m.index)} />);
    }
    parts.push(
      <div key={`c-${i++}`} className="chat-code my-2">
        <SyntaxHighlighter
          language={m[1] || 'text'}
          style={oneDark}
          customStyle={{ margin: 0, background: 'transparent', fontSize: 12.5, padding: '0.75rem 1rem' }}
        >
          {m[2]}
        </SyntaxHighlighter>
      </div>
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(<InlineText key={`t-end`} text={text.slice(last)} />);
  return <div className="leading-relaxed whitespace-pre-wrap break-words">{parts}</div>;
}

function InlineText({ text }) {
  // Highlight `inline code` and basic bold **x**.
  const nodes = [];
  let i = 0, idx = 0;
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > idx) nodes.push(<span key={`s-${i++}`}>{text.slice(idx, m.index)}</span>);
    if (m[1]) nodes.push(<code key={`c-${i++}`} className="px-1.5 py-0.5 rounded bg-ink-950/70 border border-cyan-glow/10 font-mono text-[12px] text-cyan-soft">{m[1]}</code>);
    else if (m[2]) nodes.push(<strong key={`b-${i++}`} className="font-semibold">{m[2]}</strong>);
    idx = pattern.lastIndex;
  }
  if (idx < text.length) nodes.push(<span key={`s-end`}>{text.slice(idx)}</span>);
  return <>{nodes}</>;
}
