import React from 'react';
import { X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppStore } from '../store/useAppStore.js';

const EXT_TO_LANG = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp',
  cs: 'csharp', php: 'php', swift: 'swift', kt: 'kotlin',
  html: 'markup', xml: 'markup', css: 'css', scss: 'scss',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  md: 'markdown', sql: 'sql', dockerfile: 'docker'
};

export default function FilePreview() {
  const openFile = useAppStore((s) => s.openFile);
  const setOpenFile = useAppStore((s) => s.setOpenFile);
  if (!openFile) return null;

  const lang = EXT_TO_LANG[(openFile.ext || '').toLowerCase()] || 'text';
  const name = openFile.path.split(/[\\/]/).pop();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-glow/10">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-soft/70">Preview</div>
          <div className="text-sm font-mono text-slate-200 truncate">{name}</div>
          <div className="text-[10px] font-mono text-slate-500 truncate">{openFile.path}</div>
        </div>
        <button
          onClick={() => setOpenFile(null)}
          className="p-2 rounded-md hover:bg-ink-700 text-slate-400 hover:text-white transition-colors"
          title="Close preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          showLineNumbers
          customStyle={{ margin: 0, background: 'transparent', fontSize: 13, padding: '1rem' }}
          lineNumberStyle={{ color: '#334155', minWidth: '2.5em' }}
        >
          {openFile.content || ''}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
