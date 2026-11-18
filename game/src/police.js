// police.js — the Palm Cove PD: the wanted system, patrol cars that hunt,
// officers on foot who chase and shoot, and the bust meter that ends a run.
//
// Crimes add heat; heat maps to stars; stars decide how many units the
// city sends. Heat only drains while no officer can see Danny, which makes
// breaking line of sight — ducking into the park, the alleys, the beach —
// the way out of trouble. Get cornered with the meter full and it's BUSTED.

import { G } from './state.js';
import { randomRoadPoint, collides } from './city.js';
import { makeCar, removeCar, steerToward } from './vehicles.js';
import { spawnPuff } from './effects.js';
import { playBusted } from './audio.js';

const STAR_THRESHOLDS = [10, 30, 55, 85, 120];
const CRIME_HEAT = {
  theft: 20,
  hitPed: 34,
  shootPed: 42,
  shootCop: 46,
  hitCopCar: 22,
  ramCar: 9,
  propertyDamage: 7,
  shotFired: 3,
};

export function starsForHeat(heat) {
  let stars = 0;
  for (const t of STAR_THRESHOLDS) if (heat >= t) stars++;
  return stars;
}

/** Report a crime. Witnesses matter for the small stuff: an unwitnessed
 *  gunshot in an empty street barely registers. */
export function commitCrime(kind) {
  let heat = CRIME_HEAT[kind] || 5;
  if (kind === 'shotFired') {
    const witnessed = G.cops.length > 0 || G.cars.some(
      (c) => c.kind === 'police' && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 540,
    );
    if (!witnessed) heat = 1;
  }
  G.wanted.heat = Math.min(170, G.wanted.heat + heat);
  G.wanted.stars = starsForHeat(G.wanted.heat);
}

export function resetWanted() {
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.wanted.hiddenFor = 0;
  G.bustMeter = 0;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    if (G.cars[i].kind === 'police') G.cars.splice(i, 1);
  }
  G.cops.length = 0;
}

export function updateWanted(dt) {
  const w = G.wanted;
  w.stars = starsForHeat(w.heat);
  // Who can see Danny right now?
  const p = G.player;
  let seen = false;
  if (p && w.stars > 0) {
    for (const car of G.cars) {
      if (car.kind === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 470) { seen = true; break; }
    }
    if (!seen) {
      for (const cop of G.cops) {
        if (cop.state !== 'down' && Math.hypot(cop.x - p.x, cop.y - p.y) < 390) { seen = true; break; }
      }
    }
  }
  G.playerSeen = seen;
  if (seen) w.hiddenFor = 0;
  else {
    w.hiddenFor += dt;
    if (w.hiddenFor > 4 && w.heat > 0) {
      w.heat = Math.max(0, w.heat - 4.6 * dt);
      w.stars = starsForHeat(w.heat);
    }
  }
  if (G.bustMeter >= 1 && G.mode === 'playing') {
    G.bustMeter = 1;
    G.mode = 'busted';
    playBusted();
  }
}

function desiredPoliceCars() {
  const s = G.wanted.stars;
  return s === 0 ? 0 : Math.min(2 + s, 6);
}

function spawnPoliceCar() {
  const p = G.player;
  for (let tries = 0; tries < 8; tries++) {
    const pt = randomRoadPoint(Math.random);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d > 640 && d < 980) {
      const car = makeCar('interceptor', pt.x, pt.y, Math.random() * Math.PI * 2, 'police');
      car.speed = 60;
      return car;
    }
  }
  return null;
}

export function updatePolice(dt) {
  const p = G.player;
  if (!p) return;
  let bustPressure = false;
  const active = G.wanted.stars > 0;

  // Fleet size follows the wanted level.
  const policeCars = G.cars.filter((c) => c.kind === 'police' && c !== p.car);
  const want = desiredPoliceCars();
  if (policeCars.length < want) spawnPoliceCar();
  for (const car of policeCars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (!active) {
      // Called off: no chasing, no busting — they peel away and despawn.
      if (d > 460) {
        removeCar(car);
        continue;
      }
      steerToward(car, car.x + (car.x - p.x), car.y + (car.y - p.y), dt, 0.7);
      continue;
    }
    if (d > 1600) {
      removeCar(car);
      continue;
    }
    steerToward(car, p.x, p.y, dt, 1);
    // An officer gets out when the chase becomes a foot problem.
    if (!car.copExited && d < 300 && (!p.car || Math.abs(p.car.speed) < 20)) {
      car.copExited = true;
      spawnCop(car.x + 16, car.y + 12);
    }
    if (car.copExited && d > 420) car.copExited = false;
    // Cornering the player fills the bust meter.
    if (p.car) {
      if (Math.abs(p.car.speed) < 14 && d < 78) {
        G.bustMeter += dt / 2.4;
        bustPressure = true;
      }
    } else if (d < 46) {
      G.bustMeter += dt / 4;
      bustPressure = true;
    }
  }

  // Officers on foot.
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    if (cop.state === 'down') {
      cop.downT -= dt;
      if (cop.downT <= 0) G.cops.splice(i, 1);
      continue;
    }
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    if (d > 1500 || (!active && d > 240)) {
      G.cops.splice(i, 1);
      continue;
    }
    if (!active) {
      // Stood down: officers walk back toward their cars and disperse.
      cop.phase += dt * 8;
      const nx = cop.x - ((p.x - cop.x) / (d || 1)) * 80 * dt;
      const ny = cop.y - ((p.y - cop.y) / (d || 1)) * 80 * dt;
      if (!collides(nx, cop.y, 8)) cop.x = nx;
      if (!collides(cop.x, ny, 8)) cop.y = ny;
      cop.angle = Math.atan2(cop.y - p.y, cop.x - p.x);
      continue;
    }
    cop.phase += dt * 11;
    if (d > 24) {
      const speed = 176;
      const nx = cop.x + ((p.x - cop.x) / d) * speed * dt;
      const ny = cop.y + ((p.y - cop.y) / d) * speed * dt;
      if (!collides(nx, cop.y, 8)) cop.x = nx;
      if (!collides(cop.x, ny, 8)) cop.y = ny;
      cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    } else if (!p.car) {
      G.bustMeter += dt / 1.15;
      bustPressure = true;
    }
    // At three stars and up, officers shoot instead of only chasing.
    cop.shootCd -= dt;
    if (G.wanted.stars >= 3 && d < 335 && d > 30 && cop.shootCd <= 0) {
      cop.shootCd = 1.5 + Math.random() * 0.7;
      const a = Math.atan2(p.y - cop.y, p.x - cop.x) + (Math.random() - 0.5) * 0.16;
      const targetSpeed = p.car ? Math.abs(p.car.speed) : 0;
      const lead = targetSpeed > 30 ? 0.12 : 0;
      G.bullets.push({
        x: cop.x + Math.cos(a) * 13,
        y: cop.y + Math.sin(a) * 13,
        vx: Math.cos(a) * 700 + (p.car ? Math.cos(p.car.angle) * targetSpeed * lead * 5 : 0),
        vy: Math.sin(a) * 700 + (p.car ? Math.sin(p.car.angle) * targetSpeed * lead * 5 : 0),
        life: 0.5,
        from: 'cop',
      });
      spawnPuff(cop.x + Math.cos(a) * 15, cop.y + Math.sin(a) * 15, 'rgba(255,207,92,0.8)');
    }
  }
  // Keep officers from stacking on the same spot.
  for (let i = 0; i < G.cops.length; i++) {
    for (let j = i + 1; j < G.cops.length; j++) {
      const a = G.cops[i];
      const b = G.cops[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 15) {
        b.x += (dx / d) * (15 - d) * 0.5;
        b.y += (dy / d) * (15 - d) * 0.5;
      }
    }
  }
  if (!bustPressure) G.bustMeter = Math.max(0, G.bustMeter - dt * 0.45);
}

export function spawnCop(x, y) {
  const cop = {
    x, y,
    angle: 0,
    hp: 40,
    state: 'chase',
    downT: 4,
    shootCd: 1 + Math.random(),
    phase: Math.random() * 6,
  };
  G.cops.push(cop);
  return cop;
}

export function drawCop(g, cop) {
  g.save();
  g.translate(cop.x, cop.y);
  g.fillStyle = 'rgba(60,45,20,0.28)';
  g.beginPath();
  g.ellipse(2, 3, 9, 5, 0, 0, Math.PI * 2);
  g.fill();
  if (cop.state === 'down') {
    g.rotate(Math.PI / 2.2);
    g.fillStyle = '#274b8f';
    g.fillRect(-11, -4.5, 21, 9);
    g.fillStyle = '#e0ac69';
    g.beginPath();
    g.arc(14, 0, 4.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  const step = Math.sin(cop.phase) * 3.4;
  g.rotate(cop.angle);
  g.strokeStyle = '#1d2733';
  g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(step, 3.6);
  g.moveTo(0, 0);
  g.lineTo(-step, -3.6);
  g.stroke();
  // Navy uniform and cap.
  g.fillStyle = '#274b8f';
  g.beginPath();
  g.arc(0, 0, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f5d76e';
  g.fillRect(-1.5, -5.5, 3, 3); // badge glint
  g.fillStyle = '#e0ac69';
  g.beginPath();
  g.arc(1.5, 0, 4.7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1d3557';
  g.beginPath();
  g.arc(1.5, 0, 4.7, Math.PI * 0.75, Math.PI * 1.85);
  g.fill();
  g.restore();
}
