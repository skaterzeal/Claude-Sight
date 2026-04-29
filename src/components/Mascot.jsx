import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore.js';

/**
 * Claude — a vivid 2.5D SVG bot mascot with three expressive states:
 *   idle        : calm floating + slow blink + code-rain chest screen
 *   listening   : eyes track input, ears brighten, antenna wiggles, sound rings
 *   processing  : star spins, orbital particles, typing arms, shockwaves, glow burst
 *
 * The figure subtly tilts toward the mouse via CSS perspective for a
 * living, dimensional feel.
 */
export default function Mascot({ size = 200, mode, disableTilt = false }) {
  const botState = useAppStore((s) => s.botState());
  const state = mode || botState;
  const activeSkill = useAppStore((s) => s.activeSkill);

  const accent = state === 'processing' ? '#e89b4a' : '#3ee0ff';
  const theme = useAppStore((s) => s.theme);
  const isDark = theme !== 'macos';

  const { tiltX, tiltY } = useMouseTilt(state, disableTilt);
  const blink = useBlink(state);

  return (
    <div
      className="relative grid place-items-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer energy field */}
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            key={state}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full"
          >
            <motion.div
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: accent }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.1, 0.4] }}
              transition={{ duration: state === 'processing' ? 1.1 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border"
              style={{ borderColor: accent }}
              animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.06, 0.25] }}
              transition={{ duration: state === 'processing' ? 0.85 : 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speech bubble */}
      <SpeechBubble state={state} activeSkill={activeSkill} />

      {/* Main figure with float + tilt */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
        style={{
          width: size * 0.88,
          height: size * 0.88,
          transform: `perspective(900px) rotateY(${tiltX}deg) rotateX(${-tiltY}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.12s ease-out',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 260 300"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Rich body gradient */}
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDark ? '#1e3a5f' : '#f1f5f9'} />
              <stop offset="30%" stopColor={isDark ? '#162d4d' : '#e2e8f0'} />
              <stop offset="100%" stopColor={isDark ? '#0a1420' : '#cbd5e1'} />
            </linearGradient>

            {/* Helmet — multi-stop chrome */}
            <radialGradient id="helmetGrad" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor={isDark ? '#f0f9ff' : '#ffffff'} />
              <stop offset="25%" stopColor={isDark ? '#bae6fd' : '#e0f2fe'} />
              <stop offset="55%" stopColor={isDark ? '#7dd3fc' : '#cbd5e1'} />
              <stop offset="85%" stopColor={isDark ? '#38bdf8' : '#94a3b8'} />
              <stop offset="100%" stopColor={isDark ? '#0ea5e9' : '#64748b'} />
            </radialGradient>

            {/* Helmet rim chrome */}
            <linearGradient id="rimGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            {/* Ear chrome */}
            <radialGradient id="earGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </radialGradient>

            {/* Star face — warm radial */}
            <radialGradient id="starGrad" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="35%" stopColor="#fbbf24" />
              <stop offset="75%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </radialGradient>

            {/* Star center highlight */}
            <radialGradient id="starCenter" cx="45%" cy="40%" r="45%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>

            {/* Eye glow */}
            <radialGradient id="eyeGrad" cx="35%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="45%" stopColor={accent} />
              <stop offset="100%" stopColor={state === 'processing' ? '#c2410c' : '#0369a1'} />
            </radialGradient>

            {/* Body shadow */}
            <radialGradient id="bodyShadow" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            {/* Soft glow filter */}
            <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Strong glow */}
            <filter id="strongGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Visor inner shadow */}
            <filter id="visorInset">
              <feOffset dx="0" dy="2" />
              <feGaussianBlur stdDeviation="2" result="offset-blur" />
              <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
              <feFlood floodColor="black" floodOpacity="0.4" result="color" />
              <feComposite operator="in" in="color" in2="inverse" result="shadow" />
              <feComposite operator="over" in="shadow" in2="SourceGraphic" />
            </filter>
          </defs>

          {/* ========== BODY SHADOW ========== */}
          <ellipse cx="130" cy="268" rx="58" ry="14" fill="rgba(0,0,0,0.25)" filter="url(#softGlow)" />

          {/* ========== ARMS (behind body) ========== */}
          <g
            style={{
              transformOrigin: '130px 245px',
              animation: state === 'processing'
                ? 'mascot-typing-left 0.55s ease-in-out infinite alternate'
                : 'none',
              opacity: state === 'processing' ? 1 : 0.25,
              transition: 'opacity 0.4s',
            }}
          >
            {/* Left arm segments */}
            <path d="M 72 228 Q 48 218 42 196 Q 38 182 46 176 Q 54 170 60 184 Q 66 202 76 222 Z" fill={isDark ? '#1a2d42' : '#94a3b8'} />
            <circle cx="44" cy="178" r="11" fill="url(#earGrad)" stroke={isDark ? 'rgba(62,224,255,0.2)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" />
            {/* Finger hints */}
            <line x1="40" y1="172" x2="36" y2="166" stroke={isDark ? '#475569' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
            <line x1="44" y1="170" x2="42" y2="163" stroke={isDark ? '#475569' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
            <line x1="48" y1="172" x2="48" y2="165" stroke={isDark ? '#475569' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
          </g>
          <g
            style={{
              transformOrigin: '130px 245px',
              animation: state === 'processing'
                ? 'mascot-typing-right 0.55s ease-in-out infinite alternate 0.275s'
                : 'none',
              opacity: state === 'processing' ? 1 : 0.25,
              transition: 'opacity 0.4s',
            }}
          >
            {/* Right arm segments */}
            <path d="M 188 228 Q 212 218 218 196 Q 222 182 214 176 Q 206 170 200 184 Q 194 202 184 222 Z" fill={isDark ? '#1a2d42' : '#94a3b8'} />
            <circle cx="216" cy="178" r="11" fill="url(#earGrad)" stroke={isDark ? 'rgba(62,224,255,0.2)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" />
            <line x1="212" y1="172" x2="216" y2="166" stroke={isDark ? '#475569' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
            <line x1="216" y1="170" x2="220" y2="163" stroke={isDark ? '#475569' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
            <line x1="220" y1="172" x2="224" y2="165" stroke={isDark ? '#475569' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* ========== BODY ========== */}
          {/* Main body egg shape */}
          <path
            d="M 72 195 Q 130 175 188 195 Q 210 235 188 265 Q 130 285 72 265 Q 50 235 72 195 Z"
            fill="url(#bodyGrad)"
          />
          {/* Body rim light */}
          <path
            d="M 76 198 Q 130 180 184 198"
            fill="none"
            stroke={isDark ? 'rgba(62,224,255,0.15)' : 'rgba(255,255,255,0.4)'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Neck connector shadow */}
          <ellipse cx="130" cy="192" rx="26" ry="8" fill="url(#bodyShadow)" />

          {/* ========== CHEST SCREEN ========== */}
          <rect x="92" y="215" width="76" height="46" rx="10" fill={isDark ? '#02040a' : '#0f172a'} stroke={accent} strokeOpacity="0.3" strokeWidth="1.5" />
          {/* Screen bezel */}
          <rect x="94" y="217" width="72" height="42" rx="8" fill="none" stroke={isDark ? 'rgba(62,224,255,0.08)' : 'rgba(255,255,255,0.05)'} strokeWidth="1" />
          <ChestScreenContent state={state} accent={accent} />

          {/* ========== NECK ========== */}
          <rect x="108" y="180" width="44" height="18" rx="7" fill={isDark ? '#0f1f35' : '#e2e8f0'} stroke={isDark ? 'rgba(62,224,255,0.18)' : 'rgba(0,0,0,0.08)'} strokeWidth="1" />
          {/* Neck detail lines */}
          <line x1="114" y1="186" x2="146" y2="186" stroke={accent} strokeOpacity="0.2" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="116" y1="190" x2="144" y2="190" stroke={accent} strokeOpacity="0.15" strokeWidth="1" strokeLinecap="round" />

          {/* ========== EARS ========== */}
          <g className="mascot-ear-glow">
            {/* Left ear housing */}
            <circle cx="54" cy="125" r="22" fill="url(#earGrad)" stroke={isDark ? 'rgba(62,224,255,0.2)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" />
            <circle cx="54" cy="125" r="16" fill="none" stroke={accent} strokeOpacity={state === 'listening' ? 0.9 : 0.25} strokeWidth="2.5">
              {state === 'listening' && (
                <animate attributeName="r" values="16;18;16" dur="1.3s" repeatCount="indefinite" />
              )}
            </circle>
            <circle cx="54" cy="125" r="8" fill={accent} fillOpacity={state === 'listening' ? 0.35 : 0.12} />

            {/* Right ear housing */}
            <circle cx="206" cy="125" r="22" fill="url(#earGrad)" stroke={isDark ? 'rgba(62,224,255,0.2)' : 'rgba(0,0,0,0.1)'} strokeWidth="1" />
            <circle cx="206" cy="125" r="16" fill="none" stroke={accent} strokeOpacity={state === 'listening' ? 0.9 : 0.25} strokeWidth="2.5">
              {state === 'listening' && (
                <animate attributeName="r" values="16;18;16" dur="1.3s" repeatCount="indefinite" />
              )}
            </circle>
            <circle cx="206" cy="125" r="8" fill={accent} fillOpacity={state === 'listening' ? 0.35 : 0.12} />
          </g>

          {/* ========== HELMET ========== */}
          {/* Main helmet sphere */}
          <circle cx="130" cy="125" r="72" fill="url(#helmetGrad)" filter="url(#softGlow)" />
          {/* Outer rim */}
          <circle cx="130" cy="125" r="72" fill="none" stroke="url(#rimGrad)" strokeWidth="2.5" />
          {/* Inner rim shadow */}
          <circle cx="130" cy="125" r="69" fill="none" stroke={isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.06)'} strokeWidth="1" />

          {/* Visor area (dark glass where face sits) */}
          <ellipse cx="130" cy="128" rx="62" ry="58" fill={isDark ? '#020617' : '#0f172a'} fillOpacity="0.85" />
          <ellipse cx="130" cy="128" rx="62" ry="58" fill="none" stroke={isDark ? 'rgba(62,224,255,0.12)' : 'rgba(255,255,255,0.1)'} strokeWidth="1" />

          {/* Helmet highlight (glass reflection) */}
          <ellipse cx="112" cy="92" rx="28" ry="20" fill="rgba(255,255,255,0.12)" transform="rotate(-18 112 92)" />
          <ellipse cx="118" cy="88" rx="14" ry="8" fill="rgba(255,255,255,0.2)" transform="rotate(-18 118 88)" />
          {/* Bottom helmet reflection */}
          <path d="M 90 165 Q 130 175 170 165" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" strokeLinecap="round" />

          {/* ========== STAR FACE ========== */}
          <g
            style={{
              transformOrigin: '130px 128px',
              animation: state === 'processing' ? 'spin 1.4s linear infinite' : 'none',
            }}
          >
            {/* 8 star beams */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <rect
                key={angle}
                x="126"
                y="78"
                width="8"
                height="50"
                rx="4"
                fill="url(#starGrad)"
                filter={state === 'processing' ? 'url(#strongGlow)' : 'url(#softGlow)'}
                opacity={state === 'idle' ? 0.7 + Math.sin(i * 0.9) * 0.12 : 0.95}
                transform={`rotate(${angle} 130 128)`}
              >
                {state === 'idle' && (
                  <animate
                    attributeName="opacity"
                    values={`${0.6 + (i % 3) * 0.08};${0.9 - (i % 3) * 0.08};${0.6 + (i % 3) * 0.08}`}
                    dur={`${2.2 + (i % 5) * 0.35}s`}
                    repeatCount="indefinite"
                  />
                )}
                {state === 'processing' && (
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="0.6s" repeatCount="indefinite" />
                )}
              </rect>
            ))}
            {/* Star center core */}
            <circle cx="130" cy="128" r="38" fill="url(#starGrad)" filter="url(#softGlow)" />
            <circle cx="130" cy="128" r="30" fill="url(#starCenter)" fillOpacity="0.6" />
            <circle cx="130" cy="128" r="18" fill="#fbbf24" fillOpacity="0.3" />
          </g>

          {/* ========== EYES ========== */}
          <g style={{ transformOrigin: '130px 128px', animation: blink ? 'mascot-blink 0.18s ease-in-out' : 'none' }}>
            {/* Eye sockets (dark backing) */}
            <ellipse cx="112" cy="124" rx="14" ry="15" fill="#020617" />
            <ellipse cx="148" cy="124" rx="14" ry="15" fill="#020617" />

            {/* Eye glow backing */}
            <ellipse cx="112" cy="124" rx="12" ry="13" fill="url(#eyeGrad)" filter="url(#softGlow)" />
            <ellipse cx="148" cy="124" rx="12" ry="13" fill="url(#eyeGrad)" filter="url(#softGlow)" />

            {/* Pupils */}
            <motion.ellipse
              cx={112}
              cy={124}
              rx={state === 'listening' ? 5.5 : 4}
              ry={state === 'listening' ? 6 : 4.5}
              fill="#0c4a6e"
              animate={state === 'processing' ? { rx: [4, 2.5, 4], ry: [4.5, 2.5, 4.5] } : {}}
              transition={{ duration: 0.45, repeat: Infinity }}
            />
            <motion.ellipse
              cx={148}
              cy={124}
              rx={state === 'listening' ? 5.5 : 4}
              ry={state === 'listening' ? 6 : 4.5}
              fill="#0c4a6e"
              animate={state === 'processing' ? { rx: [4, 2.5, 4], ry: [4.5, 2.5, 4.5] } : {}}
              transition={{ duration: 0.45, repeat: Infinity, delay: 0.08 }}
            />

            {/* Specular highlights — fixed for glass curvature */}
            <circle cx="108" cy="120" r="3.5" fill="white" fillOpacity="0.95" />
            <circle cx="144" cy="120" r="3.5" fill="white" fillOpacity="0.95" />
            <circle cx="115" cy="128" r="2" fill="white" fillOpacity="0.5" />
            <circle cx="151" cy="128" r="2" fill="white" fillOpacity="0.5" />
            <circle cx="110" cy="126" r="1.2" fill="white" fillOpacity="0.7" />
            <circle cx="146" cy="126" r="1.2" fill="white" fillOpacity="0.7" />
          </g>

          {/* ========== MOUTH ========== */}
          <motion.path
            d={state === 'listening' ? 'M 122 148 Q 130 154 138 148' : 'M 124 149 Q 130 152 136 149'}
            fill="none"
            stroke={isDark ? '#f97316' : '#ea580c'}
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={state === 'processing' ? { d: ['M 124 149 Q 130 152 136 149', 'M 122 148 Q 130 156 138 148', 'M 124 149 Q 130 152 136 149'] } : {}}
            transition={{ duration: 0.7, repeat: Infinity }}
          />

          {/* ========== ANTENNA ========== */}
          <motion.g
            animate={state === 'listening' ? { rotate: [-6, 6, -6] } : { rotate: 0 }}
            transition={{ duration: 1.1, repeat: state === 'listening' ? Infinity : 0, ease: 'easeInOut' }}
            style={{ transformOrigin: '130px 58px' }}
          >
            <line x1="130" y1="58" x2="130" y2="32" stroke={accent} strokeWidth="2.5" />
            {/* Antenna base */}
            <circle cx="130" cy="58" r="5" fill={isDark ? '#1e3a5f' : '#cbd5e1'} stroke={accent} strokeWidth="1" />
            {/* Antenna tip */}
            <motion.circle
              cx="130" cy="26" r="6"
              fill={accent}
              animate={{ opacity: [0.55, 1, 0.55], r: state === 'processing' ? [6, 8.5, 6] : 6 }}
              transition={{ duration: state === 'processing' ? 0.65 : 1.8, repeat: Infinity }}
              filter="url(#softGlow)"
            />
            {/* Tiny secondary tip */}
            <circle cx="130" cy="22" r="2.5" fill="white" fillOpacity="0.5" />
          </motion.g>

          {/* ========== BODY CORE LIGHT ========== */}
          <motion.circle
            cx="130" cy="252" r="5"
            fill={accent}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: state === 'processing' ? 0.6 : 2.2, repeat: Infinity }}
            filter="url(#softGlow)"
          />
        </svg>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chest screen — shows different content per state                   */
/* ------------------------------------------------------------------ */
function ChestScreenContent({ state, accent }) {
  if (state === 'listening') {
    return (
      <text x="130" y="238" textAnchor="middle" fill={accent} fontSize="9" fontFamily="monospace" fontWeight="600" letterSpacing="1">
        LISTENING
        <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
      </text>
    );
  }
  if (state === 'processing') {
    return (
      <g>
        {/* Bar 1 */}
        <rect x="104" y="228" width="52" height="5" rx="2.5" fill={accent} fillOpacity="0.18" />
        <motion.rect
          x="104" y="228" height="5" rx="2.5" fill={accent}
          animate={{ width: ['12%', '72%', '28%', '60%'] }}
          transition={{ duration: 1.3, repeat: Infinity }}
        />
        {/* Bar 2 */}
        <rect x="104" y="237" width="52" height="5" rx="2.5" fill={accent} fillOpacity="0.14" />
        <motion.rect
          x="104" y="237" height="5" rx="2.5" fill={accent}
          animate={{ width: ['42%', '18%', '82%', '36%'] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.18 }}
        />
        {/* Bar 3 */}
        <rect x="104" y="246" width="52" height="5" rx="2.5" fill={accent} fillOpacity="0.14" />
        <motion.rect
          x="104" y="246" height="5" rx="2.5" fill={accent}
          animate={{ width: ['26%', '55%', '22%', '68%'] }}
          transition={{ duration: 1.7, repeat: Infinity, delay: 0.36 }}
        />
      </g>
    );
  }
  // idle — code rain
  return (
    <g clipPath={`url(#screenClip-${useId()})`}>
      <defs>
        <clipPath id={`screenClip-${useId()}`}>
          <rect x="96" y="220" width="68" height="40" rx="8" />
        </clipPath>
      </defs>
      <text x="130" y="234" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.45">
        {'{ }  < >  01'}
      </text>
      <text x="130" y="244" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.3">
        {'01  { }  </>'}
      </text>
      <text x="130" y="254" textAnchor="middle" fill={accent} fontSize="8" fontFamily="monospace" opacity="0.2">
        {'</>  01  { }'}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Speech bubble above mascot                                          */
/* ------------------------------------------------------------------ */
function SpeechBubble({ state, activeSkill }) {
  const text = useMemo(() => {
    if (state === 'processing') {
      if (activeSkill?.name) return `Using ${activeSkill.name}…`;
      return 'Thinking…';
    }
    if (state === 'listening') return "I'm listening…";
    return null;
  }, [state, activeSkill]);

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ duration: 0.22 }}
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="relative px-3.5 py-1.5 rounded-xl bg-ink-900/95 border border-accent/30 backdrop-blur-md shadow-xl whitespace-nowrap">
            <span className="text-[11px] text-accent-soft font-semibold tracking-wide">{text}</span>
            {/* Bubble tail */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-3 h-3 bg-ink-900/95 border-r border-b border-accent/30 rotate-45" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useMouseTilt(state, disabled) {
  const [tilt, setTilt] = useState({ tiltX: 0, tiltY: 0 });
  const rafRef = useRef(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (disabled) {
      setTilt({ tiltX: 0, tiltY: 0 });
      return;
    }
    const onMove = (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetRef.current = {
        x: ((e.clientX - cx) / cx) * 12,
        y: ((e.clientY - cy) / cy) * 7,
      };
    };

    const loop = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * 0.07;
      c.y += (t.y - c.y) * 0.07;
      setTilt({ tiltX: c.x, tiltY: c.y });
      rafRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove);
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [disabled]);

  return tilt;
}

function useBlink(state) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (state === 'processing') { setBlink(false); return; }
    let timeout;
    const schedule = () => {
      const delay = 2200 + Math.random() * 4000;
      timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 180);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [state]);

  return blink;
}
