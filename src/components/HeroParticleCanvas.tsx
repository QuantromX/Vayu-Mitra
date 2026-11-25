import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { UI_LIMITS } from '../lib/config.ts';
import type { ThemeTokens } from '../types/index.ts';
import {
  createParticleSet,
  drawParticleFrame,
  type ParticleState,
} from './hero/particleEngine.ts';

interface HeroParticleCanvasProps {
  theme: ThemeTokens;
  pm25: number;
  sunXPercent: number;
  sunYPercent: number;
}

/**
 * Lightweight atmospheric <canvas> overlay rendered inside the Hero scene.
 * Caps particle count (<= 120 on mobile), pauses when tab is hidden, cleans up RAF on unmount,
 * and disables completely under prefers-reduced-motion.
 */
const HeroParticleCanvas: React.FC<HeroParticleCanvasProps> = ({
  theme,
  pm25,
  sunXPercent,
  sunYPercent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const stateRef = useRef({ theme, pm25, sunXPercent, sunYPercent });

  useEffect(() => {
    stateRef.current = { theme, pm25, sunXPercent, sunYPercent };
  }, [theme, pm25, sunXPercent, sunYPercent]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let rafId = 0;
    let timerId = 0;
    let width = 0;
    let height = 0;
    let isMobile = false;
    let particles: ParticleState = { haze: [], rain: [], stars: [] };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(300, Math.round(rect.width));
      height = Math.max(240, Math.round(rect.height));
      isMobile = width < UI_LIMITS.mobileBreakpointPx;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticleSet(width, height, isMobile, stateRef.current);
    };

    const drawFrame = () => {
      if (document.hidden) return;
      drawParticleFrame(ctx, { width, height, isMobile }, stateRef.current, particles);
      timerId = window.setTimeout(() => {
        if (!document.hidden) rafId = window.requestAnimationFrame(drawFrame);
      }, UI_LIMITS.particleFrameIntervalMs);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timerId);
        window.cancelAnimationFrame(rafId);
        rafId = 0;
        timerId = 0;
      } else if (!rafId && !timerId) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener('visibilitychange', handleVisibility);
    if (!document.hidden) rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibility);
      ro.disconnect();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      data-testid="hero-particle-canvas"
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
};

export default React.memo(HeroParticleCanvas);
