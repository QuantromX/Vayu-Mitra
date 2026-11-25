import { APP_CONFIG, UI_LIMITS } from '../../lib/config.ts';
import type { ThemeTokens } from '../../types/index.ts';

export interface HazeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

export interface RainParticle {
  x: number;
  y: number;
  len: number;
  vy: number;
  alpha: number;
}

export interface StarParticle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

export interface ParticleState {
  haze: HazeParticle[];
  rain: RainParticle[];
  stars: StarParticle[];
}

export interface CanvasSceneSnapshot {
  theme: ThemeTokens;
  pm25: number;
  sunXPercent: number;
  sunYPercent: number;
}

function getStarCount(isNightClear: boolean, lowEnd: boolean, isMobile: boolean): number {
  if (!isNightClear) return 0;
  if (lowEnd) return 16;
  return isMobile ? 28 : 42;
}

function getRainCount(isRain: boolean, lowEnd: boolean, isMobile: boolean): number {
  if (!isRain) return 0;
  if (lowEnd) return 24;
  return isMobile ? 42 : 70;
}

function getParticleTint(
  pm25: number,
  weatherScene: ThemeTokens['weatherScene']
): string {
  if (pm25 >= 121) return '251, 146, 60';
  if (pm25 >= 61) return '253, 224, 71';
  if (weatherScene === 'fog') return '226, 232, 240';
  return '167, 243, 208';
}

export function createParticleSet(
  width: number,
  height: number,
  isMobile: boolean,
  snapshot: CanvasSceneSnapshot
): ParticleState {
  const lowEnd =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= APP_CONFIG.lowEndCoreThreshold;
  let particleCap: number = UI_LIMITS.particleDesktopCap;
  if (lowEnd) particleCap = UI_LIMITS.particleLowEndCap;
  else if (isMobile) particleCap = UI_LIMITS.particleMobileCap;

  const pmNorm = Math.max(0.15, Math.min(1, snapshot.pm25 / 260));
  const isRain =
    snapshot.theme.weatherScene === 'rain' || snapshot.theme.weatherScene === 'thunder';
  const isFog = snapshot.theme.weatherScene === 'fog';
  const rainCount = getRainCount(isRain, lowEnd, isMobile);
  const starCount = getStarCount(!snapshot.theme.isDay && !isFog, lowEnd, isMobile);
  const maxHazeBudget = Math.max(18, particleCap - rainCount - starCount);
  const hazeCount = Math.min(
    maxHazeBudget,
    Math.round((isFog ? 0.9 : pmNorm) * maxHazeBudget)
  );
  const speedScale = 0.25 + pmNorm * 0.55;

  return {
    haze: Array.from({ length: hazeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.35) * speedScale,
      vy: (Math.random() - 0.5) * 0.16,
      r: isFog ? 2.6 + Math.random() * 4.2 : 1.1 + Math.random() * 2.2,
      alpha: 0.14 + Math.random() * (isFog ? 0.32 : 0.28),
    })),
    rain: Array.from({ length: rainCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: 14 + Math.random() * 14,
      vy: 5.5 + Math.random() * 3.5,
      alpha: 0.2 + Math.random() * 0.25,
    })),
    stars: Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.58,
      r: Math.random() > 0.78 ? 1.5 : 0.95,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.02,
    })),
  };
}

function drawSunHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isMobile: boolean,
  snapshot: CanvasSceneSnapshot
): void {
  const cx = (snapshot.sunXPercent / 100) * width;
  const cy = (snapshot.sunYPercent / 100) * height;
  const bloomR = isMobile ? 74 : 106;
  ctx.fillStyle = snapshot.theme.sunGlow;
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(cx, cy, bloomR * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawStarParticles(ctx: CanvasRenderingContext2D, stars: StarParticle[]): void {
  for (const s of stars) {
    s.phase += s.speed;
    const a = 0.25 + (Math.sin(s.phase) + 1) * 0.3;
    ctx.fillStyle = `rgba(248, 250, 252, ${a.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHazeParticles(
  ctx: CanvasRenderingContext2D,
  haze: HazeParticle[],
  width: number,
  height: number,
  tint: string
): void {
  for (const p of haze) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x > width + 8) p.x = -8;
    if (p.x < -8) p.x = width + 8;
    if (p.y > height + 8) p.y = -8;
    if (p.y < -8) p.y = height + 8;
    ctx.fillStyle = `rgba(${tint}, ${p.alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRainParticles(
  ctx: CanvasRenderingContext2D,
  rain: RainParticle[],
  width: number,
  height: number
): void {
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.38)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (const r of rain) {
    r.y += r.vy;
    r.x -= 0.9;
    if (r.y > height + 20) {
      r.y = -20;
      r.x = Math.random() * width;
    }
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - 2.2, r.y + r.len);
  }
  ctx.stroke();
}

export function drawParticleFrame(
  ctx: CanvasRenderingContext2D,
  viewport: { width: number; height: number; isMobile: boolean },
  snapshot: CanvasSceneSnapshot,
  particles: ParticleState
): void {
  const { width, height, isMobile } = viewport;
  ctx.clearRect(0, 0, width, height);
  drawSunHalo(ctx, width, height, isMobile, snapshot);

  if (!snapshot.theme.isDay && snapshot.theme.weatherScene !== 'fog') {
    drawStarParticles(ctx, particles.stars);
  }

  const tint = getParticleTint(snapshot.pm25, snapshot.theme.weatherScene);
  drawHazeParticles(ctx, particles.haze, width, height, tint);

  if (
    snapshot.theme.weatherScene === 'rain' ||
    snapshot.theme.weatherScene === 'thunder'
  ) {
    drawRainParticles(ctx, particles.rain, width, height);
  }
}
