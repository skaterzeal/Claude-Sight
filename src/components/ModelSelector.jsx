import React, { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';

const MODELS = [
  { id: 'opus-4-20250514', label: 'Claude Opus 4.7' },
  { id: 'opus-4-20250429', label: 'Claude Opus 4.6' },
  { id: 'sonnet-4-20250514', label: 'Claude Sonnet 4.6' }
];

export default function ModelSelector() {
  const [currentModel, setCurrentModel] = useState('opus-4-20250514');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = window.claudeSight;
    if (!api) return;
    api.getConfig()
      .then(({ config }) => {
        const model = config?.model;
        if (model && MODELS.some((m) => m.id === model)) {
          setCurrentModel(model);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = async (e) => {
    const modelId = e.target.value;
    setCurrentModel(modelId);
    try {
      await window.claudeSight.setConfig({ key: 'model', value: modelId });
    } catch (err) {
      console.error('Failed to set model:', err);
    }
  };

  const currentLabel = MODELS.find((m) => m.id === currentModel)?.label || currentModel;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-cyan-glow/10 bg-ink-950/40">
      <Cpu className="w-3.5 h-3.5 text-accent-soft shrink-0" />
      <span className="text-[10px] uppercase tracking-[0.2em] text-accent-soft/70 shrink-0">Model</span>
      <select
        value={currentModel}
        onChange={handleChange}
        disabled={loading}
        className="flex-1 min-w-0 bg-ink-800/80 border border-accent/10 rounded-md px-2 py-1 text-xs text-primary outline-none focus:border-accent/40 hover:border-accent/30 transition-colors cursor-pointer appearance-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2362e0ff' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
          paddingRight: '22px'
        }}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {!loading && (
        <span className="text-[10px] text-muted font-mono truncate hidden sm:inline">
          {currentLabel}
        </span>
      )}
    </div>
  );
}
