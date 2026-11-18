// effects.js — the cheap juice: skid marks that fade, collision sparks,
// engine smoke, muzzle flashes, shell-of-a-second impact puffs and the
// floating "+$900" texts that make rewards feel real.
//
// Everything lives in flat arrays on G with a hard cap, updated and drawn
// by two functions main.js calls each frame. Nothing here allocates in a
// hot loop beyond the particles themselves, and the caps keep a long
// session from slowing down.

import { G } from './state.js';

const MAX_PARTICLES = 420;
const MAX_SKIDS = 700;

export function addSkid(x, y) {
  G.skids.push({ x, y, life: 1 });
  if (G.skids.length > MAX_SKIDS) G.skids.splice(0, G.skids.length - MAX_SKIDS);
}

export function spawnSparks(x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 130;
    push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.28 + Math.random() * 0.2, maxLife: 0.45, size: 2, color: '#ffd94d', gravity: 0, drag: 2 });
  }
}

export function spawnSmoke(x, y, dark) {
  push({
    x: x + (Math.random() * 6 - 3),
    y: y + (Math.random() * 6 - 3),
    vx: Math.random() * 10 - 5,
    vy: -22 - Math.random() * 14,
    life: 0.8 + Math.random() * 0.5,
    maxLife: 1.3,
    size: 5 + Math.random() * 5,
    color: dark ? 'rgba(40,40,44,0.5)' : 'rgba(200,200,205,0.45)',
    gravity: -12,
    drag: 0.4,
    grow: 9,
  });
}

export function spawnMuzzle(x, y, angle) {
  push({
    x: x + Math.cos(angle) * 16,
    y: y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * 30,
    vy: Math.sin(angle) * 30,
    life: 0.07,
    maxLife: 0.07,
    size: 7,
    color: '#ffcf5c',
    gravity: 0,
    drag: 0,
  });
}

export function spawnPuff(x, y, color = 'rgba(255,255,255,0.7)') {
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    push({
      x, y,
      vx: Math.cos(a) * 34,
      vy: Math.sin(a) * 34,
      life: 0.3,
      maxLife: 0.3,
      size: 3.5,
      color,
      gravity: 0,
      drag: 3,
    });
  }
}

export function addFloater(x, y, text, color = '#7ee787') {
  G.floaters.push({ x, y, text, color, t: 0 });
}

function push(p) {
  if (G.particles.length >= MAX_PARTICLES) G.particles.shift();
  G.particles.push(p);
}

export function updateEffects(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      G.particles.splice(i, 1);
      continue;
    }
    p.vy += (p.gravity || 0) * dt;
    const dragF = Math.max(0, 1 - (p.drag || 0) * dt);
    p.vx *= dragF;
    p.vy *= dragF;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.grow) p.size += p.grow * dt;
  }
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].life -= dt * 0.03; // skid marks linger, then quietly go
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.t += dt;
    f.y -= 34 * dt;
    if (f.t > 1.5) G.floaters.splice(i, 1);
  }
}

export function drawSkids(g) {
  g.fillStyle = '#2c2c30';
  for (const s of G.skids) {
    g.globalAlpha = Math.min(0.5, s.life * 0.5);
    g.beginPath();
    g.arc(s.x, s.y, 3.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawParticles(g) {
  for (const p of G.particles) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function drawFloaters(g) {
  g.font = 'bold 17px Verdana, sans-serif';
  g.textAlign = 'center';
  for (const f of G.floaters) {
    g.globalAlpha = Math.max(0, 1 - f.t / 1.5);
    g.fillStyle = '#20242a';
    g.fillText(f.text, f.x + 1.5, f.y + 1.5);
    g.fillStyle = f.color;
    g.fillText(f.text, f.x, f.y);
  }
  g.globalAlpha = 1;
}
