import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, TerminalSquare, Image as ImageIcon, X, Wind } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { isSlashCommand, matchSlashCommands } from '../lib/slashCommands.js';

export default function InputBar({ paneId }) {
  const [value, setValue] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const taRef = useRef(null);
  const setTyping = useAppStore((s) => s.setTyping);
  const addMessage = useAppStore((s) => s.addMessage);
  const markInflight = useAppStore((s) => s.markInflight);
  const pane = useAppStore((s) => s.panes.find((p) => p.id === paneId));
  const pendingImages = useAppStore((s) => s.pendingImages);
  const addPendingImage = useAppStore((s) => s.addPendingImage);
  const removePendingImage = useAppStore((s) => s.removePendingImage);
  const clearPendingImages = useAppStore((s) => s.clearPendingImages);

  const inflight = pane?.inflight || {};
  const inflightIds = Object.keys(inflight);
  const isWorking = inflightIds.length > 0;
  const planMode = !!pane?.planMode;
  const sessionId = pane?.sessionId || null;

  const isCommand = isSlashCommand(value);
  const suggestions = useMemo(() => matchSlashCommands(value), [value]);

  const autoSize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const onChange = (e) => {
    setValue(e.target.value);
    setTyping(e.target.value.length > 0);
    autoSize();
  };

  const dispatchPrompt = async ({ prompt, isRedirect }) => {
    const messageId = crypto.randomUUID();
    const kind = isSlashCommand(prompt) ? 'command' : (isRedirect ? 'redirect' : undefined);
    addMessage(paneId, { role: 'user', text: prompt, kind });
    markInflight(paneId, messageId, true);
    setValue('');
    setTyping(false);
    autoSize();

    const images = pendingImages.map((i) => i.path);
    clearPendingImages();

    const res = await window.claudeSight.sendPrompt({
      messageId,
      prompt,
      sessionId,
      planMode,
      images,
      redirectFromMessageId: isRedirect ? inflightIds[0] : undefined,
      paneCwd: undefined // future: per-pane cwd override
    });
    if (!res.ok) {
      markInflight(paneId, messageId, false);
      addMessage(paneId, { role: 'system', text: `Failed to start: ${res.error || 'unknown error'}` });
    }
  };

  const send = async () => {
    const prompt = value.trim();
    if (!prompt) return;

    // "claude ..." direct CLI command — only when not working
    if (!isWorking && prompt.toLowerCase().startsWith('claude ')) {
      const command = prompt.slice(7);
      const messageId = crypto.randomUUID();
      addMessage(paneId, { role: 'user', text: `$ ${prompt}`, kind: 'command' });
      markInflight(paneId, messageId, true);
      setValue('');
      setTyping(false);
      autoSize();
      const res = await window.claudeSight.execCommand({ messageId, command });
      if (!res.ok) {
        markInflight(paneId, messageId, false);
        addMessage(paneId, { role: 'system', text: `Failed: ${res.error || 'unknown error'}` });
      }
      return;
    }

    dispatchPrompt({ prompt, isRedirect: false });
  };

  const redirect = async () => {
    const prompt = value.trim();
    if (!prompt) return;
    dispatchPrompt({ prompt, isRedirect: true });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isWorking) redirect(); else send();
    }
    if (e.key === 'Tab' && isCommand && suggestions[0]) {
      e.preventDefault();
      const first = suggestions[0];
      setValue(first.args ? `${first.cmd} ` : first.cmd);
      setTyping(true);
      requestAnimationFrame(autoSize);
    }
  };

  const onPaste = async (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type && it.type.startsWith('image/')) {
        e.preventDefault();
        const res = await window.claudeSight.image.fromClipboard();
        if (res.ok) addPendingImage({ path: res.file, name: 'clipboard.png' });
        return;
      }
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    // 1) Internal drag from FileTree (text/x-cs-path)
    const internal = e.dataTransfer.getData('text/x-cs-path');
    if (internal) {
      const next = (value ? value + ' ' : '') + `@${internal}`;
      setValue(next);
      setTyping(true);
      requestAnimationFrame(autoSize);
      taRef.current?.focus();
      return;
    }
    // 2) Files dropped from OS
    const files = Array.from(e.dataTransfer.files || []);
    for (const f of files) {
      if (f.type && f.type.startsWith('image/')) {
        const reader = new FileReader();
        const data = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(f);
        });
        const base64 = String(data).split(',')[1] || '';
        const res = await window.claudeSight.image.saveDropped(f.name, base64);
        if (res.ok) addPendingImage({ path: res.file, name: f.name });
      } else if (f.path) {
        const next = (value ? value + ' ' : '') + `@${f.path}`;
        setValue(next);
        setTyping(true);
        requestAnimationFrame(autoSize);
      }
    }
  };

  const pickSuggestion = (s) => {
    setValue(s.args ? `${s.cmd} ` : s.cmd);
    setTyping(true);
    taRef.current?.focus();
    requestAnimationFrame(autoSize);
  };

  return (
    <div
      className="p-3 border-t border-cyan-glow/10 bg-ink-950/40 relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-cyan-glow/10 border-2 border-dashed border-cyan-glow/40 rounded-xl m-2 pointer-events-none">
          <div className="text-cyan-soft text-xs">Drop image or file</div>
        </div>
      )}

      <AnimatePresence>
        {isCommand && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-3 right-3 bottom-full mb-2 rounded-xl bg-ink-900/95 border border-accent/20 backdrop-blur shadow-lg overflow-hidden"
          >
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-accent-soft/70 border-b border-accent/10 flex items-center gap-2">
              <TerminalSquare className="w-3 h-3" /> Slash commands
              <span className="ml-auto text-muted normal-case tracking-normal">Tab to fill</span>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((s) => (
                <li key={s.cmd}>
                  <button
                    onClick={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-1.5 hover:bg-ink-800 flex items-baseline gap-2"
                  >
                    <span className="font-mono text-xs text-accent">{s.cmd}</span>
                    {s.args && <span className="font-mono text-[11px] text-muted">{s.args}</span>}
                    <span className="ml-auto text-[11px] text-muted truncate">{s.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {pendingImages.map((img) => (
            <span key={img.path} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-ink-800 border border-cyan-glow/15 text-[11px] font-mono">
              <ImageIcon className="w-3 h-3 text-cyan-soft" />
              <span className="text-slate-300 truncate max-w-[140px]">{img.name}</span>
              <button onClick={() => removePendingImage(img.path)} className="text-slate-500 hover:text-claude-coral">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <motion.div
        animate={{
          boxShadow: value
            ? isCommand
              ? '0 0 0 1px rgba(232,155,74,0.45)'
              : '0 0 0 1px rgba(62,224,255,0.25)'
            : '0 0 0 1px rgba(62,224,255,0.08)'
        }}
        className={`flex items-end gap-2 rounded-xl bg-ink-800/70 border px-3 py-2 ${
          isCommand ? 'border-accent-2/40' : 'border-cyan-glow/10'
        }`}
      >
        {isCommand && (
          <div className="shrink-0 mt-1.5 text-accent-2" title="Slash command">
            <TerminalSquare className="w-4 h-4" />
          </div>
        )}
        <textarea
          ref={taRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => {
            setTyping(false);
            document.body.classList.remove('mascot-focus');
          }}
          onFocus={() => document.body.classList.add('mascot-focus')}
          rows={1}
          placeholder={
            isWorking
              ? 'Claude is working — type to redirect, then Enter.'
              : 'Ask Claude · paste image · drop a file · type / for commands · "claude …" for CLI'
          }
          className={`flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-slate-500 py-1 ${
            isCommand ? 'font-mono text-accent-2' : 'text-slate-100'
          }`}
        />
        {isWorking ? (
          <button
            onClick={redirect}
            disabled={!value.trim()}
            title="Stop current task and redirect with this message"
            className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center transition-colors ${
              value.trim()
                ? 'bg-claude-amber text-ink-950 hover:brightness-110 shadow-glow-amber'
                : 'bg-ink-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Wind className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!value.trim()}
            className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center transition-colors ${
              value.trim()
                ? isCommand
                  ? 'bg-accent-2 text-ink-950 hover:brightness-110 shadow-glow-amber'
                  : 'bg-cyan-glow text-ink-950 hover:brightness-110 shadow-glow-cyan'
                : 'bg-ink-700 text-slate-500 cursor-not-allowed'
            }`}
            title={isCommand ? 'Run command' : 'Send'}
          >
            <Send className="w-4 h-4" />
          </button>
        )}
        {isWorking && (
          <Loader2 className="w-4 h-4 animate-spin text-cyan-soft/60" />
        )}
      </motion.div>
    </div>
  );
}
