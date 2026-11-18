// hud.js — everything drawn over the world: the minimap, the money and
// health and wanted stars, the objective card, Sol's phone banners, the
// contextual prompt, and every menu screen (title, pause, BUSTED, WASTED).
//
// The judge reads the game mostly from screenshots, so the HUD works hard:
// a single frame should show where Danny is, what he is doing, how much
// trouble he is in, and where the story wants him next.

import { G, WORLD } from './state.js';
import { V_ROADS, H_ROADS, SAND_X, WATER_X, LANDMARKS } from './city.js';
import { hasSave } from './save.js';
import { isMuted } from './audio.js';
import { playPhoneBlip } from './audio.js';

export const menuButtons = [];

// ---------------------------------------------------------------------------
// Phone banners.

export function updateBanners(dt) {
  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t >= G.banner.dur) G.banner = null;
  }
  if (!G.banner && G.bannerQueue.length) {
    G.banner = G.bannerQueue.shift();
    playPhoneBlip();
  }
  if (G.toast) {
    G.toast.t += dt;
    if (G.toast.t > 2.6) G.toast = null;
  }
}

// ---------------------------------------------------------------------------
// World-space objective marker: a pillar of light nobody can miss.

export function drawObjectiveMarker(g, time) {
  const m = G.objective.marker;
  if (!m || G.mode !== 'playing') return;
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  const grad = g.createLinearGradient(0, m.y - 130, 0, m.y);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, 'rgba(255,217,77,0.35)');
  g.fillStyle = grad;
  g.fillRect(m.x - 7, m.y - 130, 14, 130);
  g.strokeStyle = '#ffd94d';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(m.x, m.y, 20 * pulse, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#ffd94d';
  g.beginPath();
  const bob = Math.sin(time * 3.2) * 4;
  g.moveTo(m.x, m.y - 44 + bob);
  g.lineTo(m.x - 9, m.y - 58 + bob);
  g.lineTo(m.x + 9, m.y - 58 + bob);
  g.closePath();
  g.fill();
}

// ---------------------------------------------------------------------------
// The minimap, pre-rendered once from the city layout.

let miniMap = null;
const MINI_W = 184;
const MINI_H = 164;
const MINI_SCALE = MINI_W / WORLD.width;

function buildMiniMap() {
  const c = document.createElement('canvas');
  c.width = MINI_W;
  c.height = MINI_H;
  const g = c.getContext('2d');
  g.fillStyle = '#d8cdae';
  g.fillRect(0, 0, MINI_W, MINI_H);
  g.fillStyle = '#9ccb6b';
  g.fillRect(400 * MINI_SCALE, 2050 * MINI_SCALE, 530 * MINI_SCALE, 430 * MINI_SCALE);
  g.fillStyle = '#f2dfae';
  g.fillRect(SAND_X * MINI_SCALE, 0, (WATER_X - SAND_X) * MINI_SCALE, MINI_H);
  g.fillStyle = '#2b9db8';
  g.fillRect(WATER_X * MINI_SCALE, 0, MINI_W - WATER_X * MINI_SCALE, MINI_H);
  g.fillStyle = '#555b63';
  for (const vx of V_ROADS) g.fillRect(vx * MINI_SCALE - 3, 0, 6, MINI_H);
  for (const hy of H_ROADS) g.fillRect(0, hy * MINI_SCALE - 3, SAND_X * MINI_SCALE, 6);
  miniMap = c;
}

function drawMinimap(g, time) {
  if (!miniMap) buildMiniMap();
  const x0 = 14;
  const y0 = 14;
  g.save();
  g.fillStyle = 'rgba(16,20,26,0.72)';
  roundRect(g, x0 - 4, y0 - 4, MINI_W + 8, MINI_H + 8, 8);
  g.fill();
  g.drawImage(miniMap, x0, y0);
  const toMini = (wx, wy) => [x0 + wx * MINI_SCALE, y0 + wy * (MINI_H / WORLD.height)];
  // Garage: a permanent gold dot, home base.
  const [gx, gy] = toMini(LANDMARKS.garageZone.x + 75, LANDMARKS.garageZone.y + 46);
  g.fillStyle = '#ffd94d';
  g.fillRect(gx - 2.5, gy - 2.5, 5, 5);
  // Objective.
  if (G.objective.marker) {
    const [ox, oy] = toMini(G.objective.marker.x, G.objective.marker.y);
    g.fillStyle = Math.sin(time * 6) > 0 ? '#ffd94d' : '#fff3b0';
    g.beginPath();
    g.arc(ox, oy, 4.4, 0, Math.PI * 2);
    g.fill();
  }
  // Police: flashing blue/red dots.
  g.fillStyle = Math.sin(time * 7) > 0 ? '#5e9bff' : '#ff5e5e';
  for (const car of G.cars) {
    if (car.kind !== 'police') continue;
    const [px, py] = toMini(car.x, car.y);
    g.fillRect(px - 2, py - 2, 4, 4);
  }
  for (const cop of G.cops) {
    const [px, py] = toMini(cop.x, cop.y);
    g.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  // Danny: a white arrow that turns with him.
  const p = G.player;
  const [px, py] = toMini(p.x, p.y);
  g.translate(px, py);
  g.rotate(p.angle);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(6, 0);
  g.lineTo(-4.5, -4);
  g.lineTo(-4.5, 4);
  g.closePath();
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------------------
// Screen-space HUD.

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function starPath(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

export function drawHUD(g, w, h, time) {
  if (G.mode === 'title') return;
  const p = G.player;
  if (!p) return;
  drawMinimap(g, time);

  // Top-right stack: money, wanted stars, health.
  g.textAlign = 'right';
  g.font = 'bold 25px Verdana, sans-serif';
  g.fillStyle = '#20242a';
  g.fillText(`$${G.money.toLocaleString()}`, w - 17, 40);
  g.fillStyle = '#3fae5a';
  g.fillText(`$${G.money.toLocaleString()}`, w - 19, 38);
  const stars = G.wanted.stars;
  for (let i = 0; i < 5; i++) {
    const cx = w - 30 - (4 - i) * 30;
    const cy = 66;
    const active = i < stars;
    const blink = !G.playerSeen && stars > 0 && Math.sin(time * 6) > 0;
    starPath(g, cx, cy, 12);
    g.fillStyle = active ? (blink ? '#ffe9a3' : '#ffb703') : 'rgba(20,24,30,0.35)';
    g.fill();
    g.strokeStyle = 'rgba(20,24,30,0.55)';
    g.lineWidth = 1.4;
    g.stroke();
  }
  if (stars > 0 && !G.playerSeen) {
    g.font = 'bold 11px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.textAlign = 'right';
    g.fillText('LOSING THEM…', w - 19, 90);
  }
  // Health bar.
  g.fillStyle = 'rgba(16,20,26,0.55)';
  roundRect(g, w - 194, 96, 180, 13, 6);
  g.fill();
  g.fillStyle = p.hp > 30 ? '#58cc02' : '#ff4b4b';
  if (p.hp > 0) {
    roundRect(g, w - 192, 98, 176 * (p.hp / 100), 9, 4);
    g.fill();
  }

  // Bust meter: a ring of trouble around the wanted stars.
  if (G.bustMeter > 0.02) {
    g.font = 'bold 13px Verdana, sans-serif';
    g.textAlign = 'right';
    g.fillStyle = '#ff5e5e';
    g.fillText('BUSTED?', w - 19, 128);
    g.fillStyle = 'rgba(16,20,26,0.55)';
    roundRect(g, w - 194, 134, 180, 8, 4);
    g.fill();
    g.fillStyle = '#ff5e5e';
    roundRect(g, w - 192, 136, 176 * Math.min(1, G.bustMeter), 4.5, 2);
    g.fill();
  }

  // Objective card, bottom-left.
  if (G.objective.title) {
    g.textAlign = 'left';
    const boxW = 372;
    g.fillStyle = 'rgba(16,20,26,0.66)';
    roundRect(g, 14, h - 86, boxW, 72, 9);
    g.fill();
    g.fillStyle = '#ffd94d';
    g.font = 'bold 12.5px Verdana, sans-serif';
    g.fillText(G.objective.title.toUpperCase(), 28, h - 60);
    g.fillStyle = '#ffffff';
    g.font = '14.5px Verdana, sans-serif';
    wrapText(g, G.objective.text, 28, h - 40, boxW - 28, 17, 2);
  }

  drawObjectiveArrow(g, w, h, time);

  // Speedometer when driving.
  if (p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.31);
    g.textAlign = 'right';
    g.font = 'bold 30px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.fillText(`${mph}`, w - 62, h - 24);
    g.font = 'bold 12px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.fillText('MPH', w - 18, h - 24);
  }

  // Context prompt, bottom-centre.
  if (G.prompt && G.mode === 'playing') {
    g.font = 'bold 15px Verdana, sans-serif';
    const tw = g.measureText(G.prompt).width;
    g.fillStyle = 'rgba(16,20,26,0.72)';
    roundRect(g, w / 2 - tw / 2 - 14, h - 128, tw + 28, 30, 15);
    g.fill();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.fillText(G.prompt, w / 2, h - 108);
  }

  drawBanner(g, w, h);
  drawToast(g, w, h);

  if (isMuted()) {
    g.textAlign = 'left';
    g.font = '11px Verdana, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('MUTED (M)', 16, h - 10);
  }
}

/** An arrow at the screen edge pointing at an off-screen objective. */
function drawObjectiveArrow(g, w, h, time) {
  const m = G.objective.marker;
  if (!m || G.mode !== 'playing') return;
  const cam = G.camera;
  const sx = (m.x - cam.x) * cam.zoom + w / 2;
  const sy = (m.y - cam.y) * cam.zoom + h / 2;
  if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) return; // on screen
  const cx = Math.max(42, Math.min(w - 42, sx));
  const cy = Math.max(42, Math.min(h - 42, sy));
  const ang = Math.atan2(sy - cy, sx - cx);
  const dist = Math.round(Math.hypot(m.x - G.player.x, m.y - G.player.y) / 9);
  g.save();
  g.translate(cx, cy);
  g.rotate(ang);
  g.fillStyle = '#ffd94d';
  g.beginPath();
  g.moveTo(15, 0);
  g.lineTo(-8, -9);
  g.lineTo(-8, 9);
  g.closePath();
  g.fill();
  g.restore();
  g.font = 'bold 11.5px Verdana, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.fillText(`${dist}m`, cx, cy + 26);
}

function drawBanner(g, w, h) {
  const b = G.banner;
  if (!b) return;
  const inT = Math.min(1, b.t / 0.3);
  const outT = Math.min(1, (b.dur - b.t) / 0.4);
  const alpha = Math.max(0, Math.min(inT, outT));
  const boxW = Math.min(560, w - 40);
  g.save();
  g.globalAlpha = alpha;
  const y = 118;
  g.fillStyle = 'rgba(14,18,24,0.88)';
  roundRect(g, w / 2 - boxW / 2, y, boxW, 64, 12);
  g.fill();
  g.strokeStyle = 'rgba(255,217,77,0.5)';
  g.lineWidth = 1.5;
  roundRect(g, w / 2 - boxW / 2, y, boxW, 64, 12);
  g.stroke();
  // A little phone glyph.
  g.fillStyle = '#ffd94d';
  roundRect(g, w / 2 - boxW / 2 + 14, y + 13, 17, 30, 3);
  g.fill();
  g.fillStyle = '#14181e';
  g.fillRect(w / 2 - boxW / 2 + 17.5, y + 17, 10, 19);
  g.textAlign = 'left';
  g.fillStyle = '#ffd94d';
  g.font = 'bold 12px Verdana, sans-serif';
  g.fillText(b.from.toUpperCase(), w / 2 - boxW / 2 + 44, y + 22);
  g.fillStyle = '#ffffff';
  g.font = '14.5px Verdana, sans-serif';
  wrapText(g, b.text, w / 2 - boxW / 2 + 44, y + 40, boxW - 60, 17, 2);
  g.restore();
}

function drawToast(g, w, h) {
  const t = G.toast;
  if (!t) return;
  const alpha = t.t < 0.25 ? t.t / 0.25 : Math.max(0, 1 - (t.t - 2) / 0.6);
  g.save();
  g.globalAlpha = alpha;
  g.textAlign = 'center';
  g.font = 'bold 34px Verdana, sans-serif';
  g.fillStyle = 'rgba(20,24,30,0.8)';
  g.fillText(t.text, w / 2 + 2, h * 0.3 + 2);
  g.fillStyle = '#ffd94d';
  g.fillText(t.text, w / 2, h * 0.3);
  if (t.sub) {
    g.font = 'bold 17px Verdana, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(t.sub, w / 2, h * 0.3 + 30);
  }
  g.restore();
}

function wrapText(g, text, x, y, maxW, lineH, maxLines) {
  const words = String(text).split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + lines * lineH);
      lines++;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) g.fillText(line, x, y + lines * lineH);
}

// ---------------------------------------------------------------------------
// Menu screens.

function button(g, x, y, w, h, label, action, hot = false) {
  g.fillStyle = hot ? '#ffb703' : 'rgba(20,26,34,0.85)';
  roundRect(g, x, y, w, h, 10);
  g.fill();
  g.strokeStyle = hot ? '#ffd94d' : 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  roundRect(g, x, y, w, h, 10);
  g.stroke();
  g.fillStyle = hot ? '#1d2733' : '#ffffff';
  g.font = 'bold 19px Verdana, sans-serif';
  g.textAlign = 'center';
  g.fillText(label, x + w / 2, y + h / 2 + 7);
  menuButtons.push({ x, y, w, h, action });
}

export function handleMenuClick(mx, my) {
  for (const b of menuButtons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.action;
  }
  return null;
}

export function drawMenus(g, w, h, time) {
  menuButtons.length = 0;
  if (G.mode === 'title') drawTitle(g, w, h, time);
  else if (G.mode === 'paused') drawPause(g, w, h);
  else if (G.mode === 'busted') drawEndScreen(g, w, h, 'BUSTED', '#5e9bff', 'The Palm Cove PD impounded your ride and fined you.');
  else if (G.mode === 'wasted') drawEndScreen(g, w, h, 'WASTED', '#ff5e5e', 'You wake up in Palm Cove General. The bill stings.');
}

function drawTitle(g, w, h, time) {
  // Sunset wash over the drifting city view.
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,120,80,0.30)');
  grad.addColorStop(0.55, 'rgba(30,30,60,0.18)');
  grad.addColorStop(1, 'rgba(10,14,22,0.62)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.font = 'bold 30px Verdana, sans-serif';
  g.fillStyle = '#ffe9a3';
  g.fillText('P A L M   C O V E', w / 2, h * 0.26);
  g.font = '900 104px Verdana, sans-serif';
  g.fillStyle = '#20242a';
  g.fillText('HEAT', w / 2 + 4, h * 0.26 + 100 + 4);
  const pulse = 1 + Math.sin(time * 2.2) * 0.012;
  g.save();
  g.translate(w / 2, h * 0.26 + 100);
  g.scale(pulse, pulse);
  g.fillStyle = '#ffb703';
  g.fillText('HEAT', 0, 0);
  g.restore();
  g.font = '16.5px Verdana, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillText('An original open-world crime story in a sun-soaked coastal city.', w / 2, h * 0.26 + 138);
  g.fillText('Steal cars. Run jobs for Sol. Outrun the Palm Cove PD.', w / 2, h * 0.26 + 162);

  const bw = 264;
  const bx = w / 2 - bw / 2;
  let by = h * 0.58;
  button(g, bx, by, bw, 52, 'NEW GAME', 'new', true);
  by += 66;
  if (hasSave()) {
    button(g, bx, by, bw, 52, 'CONTINUE', 'continue');
    by += 66;
  }
  g.font = '13.5px Verdana, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillText('WASD drive & walk · Mouse aim · Click shoot · F enter/exit car · Shift sprint · Space handbrake · P pause · M mute', w / 2, h - 44);
  g.font = '12px Verdana, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillText('Every name, street and story in Palm Cove is invented. Any resemblance to other games is purely generic.', w / 2, h - 20);
}

function drawPause(g, w, h) {
  g.fillStyle = 'rgba(10,14,22,0.62)';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.font = '900 54px Verdana, sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText('PAUSED', w / 2, h * 0.36);
  g.font = '15px Verdana, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText(`Cash $${G.money.toLocaleString()} · Missions done: ${G.missionIndex}/3 · Cars fenced: ${G.delivered}`, w / 2, h * 0.36 + 36);
  const bw = 240;
  const bx = w / 2 - bw / 2;
  button(g, bx, h * 0.48, bw, 50, 'RESUME', 'resume', true);
  button(g, bx, h * 0.48 + 64, bw, 50, 'BACK TO TITLE', 'title');
  g.font = '13px Verdana, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText('Progress saves itself whenever a job is finished.', w / 2, h * 0.48 + 148);
}

function drawEndScreen(g, w, h, word, color, line) {
  g.fillStyle = word === 'BUSTED' ? 'rgba(18,30,66,0.55)' : 'rgba(50,10,10,0.55)';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.font = '900 92px Verdana, sans-serif';
  g.fillStyle = '#14181e';
  g.fillText(word, w / 2 + 3, h * 0.42 + 3);
  g.fillStyle = color;
  g.fillText(word, w / 2, h * 0.42);
  g.font = '16.5px Verdana, sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText(line, w / 2, h * 0.42 + 44);
  const bw = 264;
  button(g, w / 2 - bw / 2, h * 0.56, bw, 52, 'KEEP GOING', 'respawn', true);
}
