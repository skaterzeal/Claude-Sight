import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Mascot from './Mascot.jsx';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Global floating companion — always-visible draggable avatar.
 *
 * - Bottom-right by default (snaps back to corner when released)
 * - Drag to reposition anywhere on screen
 * - Click (not drag) focuses the chat input
 * - Rich ambient effects tied to bot state
 */
export default function FloatingCompanion() {
  const botState = useAppStore((s) => s.botState());
  const ref = useRef(null);
  const [pos, setPos] = useState(null); // {x,y} in px from viewport edges, or null = default corner
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const hasDragged = useRef(false);

  const onPointerDown = (e) => {
    if (!ref.current) return;
    hasDragged.current = false;
    const rect = ref.current.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      px: rect.left,
      py: rect.top,
    };
    setDragging(true);
    // Capture pointer so drag works even if cursor leaves the element
    ref.current.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - 140, dragStart.current.px + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 160, dragStart.current.py + dy)),
    });
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    ref.current?.releasePointerCapture?.(e.pointerId);
    // If it was a click (no real drag), focus the chat input
    if (!hasDragged.current) {
      const ta = document.querySelector('textarea[placeholder*="Claude"]');
      ta?.focus();
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => onPointerMove(e);
    const up = (e) => onPointerUp(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line
  }, [dragging]);

  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 20 };

  return (
    <div
      ref={ref}
      className="fixed z-50 cursor-grab active:cursor-grabbing"
      style={style}
      onPointerDown={onPointerDown}
    >
      {/* Ambient glow behind */}
      <AnimatePresence>
        {botState === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(232,155,74,0.25) 0%, transparent 70%)', transform: 'scale(1.6)' }}
          />
        )}
      </AnimatePresence>

      {/* Sound rings when listening */}
      <AnimatePresence>
        {botState === 'listening' && <SoundRings />}
      </AnimatePresence>

      {/* Particle trail when processing */}
      <AnimatePresence>
        {botState === 'processing' && <ParticleTrail />}
      </AnimatePresence>

      {/* Mascot */}
      <div className={`relative transition-transform duration-200 ${dragging ? 'scale-110' : 'scale-100'}`}>
        <Mascot size={120} mode={botState} disableTilt={dragging} />
      </div>

      {/* Status dot */}
      <div className="absolute -top-1 -right-1">
        <StatusDot state={botState} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sound wave rings (listening)                                       */
/* ------------------------------------------------------------------ */
function SoundRings() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {[0, 0.4, 0.8].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-accent/40"
          initial={{ width: 80, height: 80, opacity: 0.6 }}
          animate={{ width: 180, height: 180, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Particle trail (processing)                                        */
/* ------------------------------------------------------------------ */
function ParticleTrail() {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i / 8) * 360,
    delay: i * 0.15,
    symbol: ['{ }', '</>', ';', '01', '#', '=>', '&&', '||'][i],
  }));

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute text-[10px] font-mono font-bold text-accent-2/50"
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
          animate={{
            x: [0, Math.cos((p.angle * Math.PI) / 180) * 70, 0],
            y: [0, Math.sin((p.angle * Math.PI) / 180) * 70, 0],
            opacity: [0, 0.6, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{ duration: 2.2, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        >
          {p.symbol}
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status dot                                                         */
/* ------------------------------------------------------------------ */
function StatusDot({ state }) {
  const colors = {
    idle: 'bg-slate-500',
    listening: 'bg-accent animate-pulse',
    processing: 'bg-accent-2 animate-pulse',
  };
  return (
    <div className={`w-3.5 h-3.5 rounded-full border-2 border-ink-950 ${colors[state] || colors.idle}`} />
  );
}
