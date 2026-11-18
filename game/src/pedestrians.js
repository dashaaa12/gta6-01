// pedestrians.js — the people of Palm Cove: beachgoers, shoppers and
// dog-walkers strolling the sidewalks and the promenade.
//
// A pedestrian follows a sidewalk line along one road, turns around or
// switches roads at intersections, hurries away from gunfire and fast
// cars, and falls over when a car actually hits them. They are also the
// city's witnesses: crimes committed near a pedestrian are what turns a
// quiet street into a police response (police.js reads the same ranges).

import { G } from './state.js';
import { V_ROADS, H_ROADS, ROAD_HALF, SAND_X, collides } from './city.js';

const SHIRTS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#c8d6e5', '#fd79a8'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPedestrian(x, y) {
  const ped = {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    walkSpeed: 52 + Math.random() * 26,
    phase: Math.random() * 10,
    shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
    skin: SKIN[(Math.random() * SKIN.length) | 0],
    // route: walk along `axis` ('v' = along a vertical road) at fixed line
    axis: Math.random() < 0.5 ? 'v' : 'h',
    line: 0,
    dir: Math.random() < 0.5 ? 1 : -1,
    state: 'walk', // 'walk' | 'flee' | 'down'
    stateT: 0,
    fleeX: 0,
    fleeY: 0,
  };
  snapToSidewalk(ped);
  G.peds.push(ped);
  return ped;
}

function snapToSidewalk(ped) {
  const side = ROAD_HALF + 13;
  if (ped.axis === 'v') {
    const vx = V_ROADS.reduce((a, b) => (Math.abs(b - ped.x) < Math.abs(a - ped.x) ? b : a));
    ped.line = vx + (Math.random() < 0.5 ? -side : side);
    ped.x = ped.line;
  } else {
    const hy = H_ROADS.reduce((a, b) => (Math.abs(b - ped.y) < Math.abs(a - ped.y) ? b : a));
    ped.line = hy + (Math.random() < 0.5 ? -side : side);
    ped.y = ped.line;
  }
}

/** Keep a strolling crowd around the player, thinner at the beach. */
export function maintainPedestrians() {
  const p = G.player;
  if (!p) return;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1250) G.peds.splice(i, 1);
  }
  while (G.peds.length < 26) {
    const a = Math.random() * Math.PI * 2;
    const d = 480 + Math.random() * 620;
    const x = Math.min(SAND_X + 130, Math.max(40, p.x + Math.cos(a) * d));
    const y = Math.min(3160, Math.max(40, p.y + Math.sin(a) * d));
    if (collides(x, y, 8)) continue;
    spawnPedestrian(x, y);
  }
}

/** Gunfire and near-miss cars send nearby pedestrians running. */
export function scarePeds(x, y, radius) {
  for (const ped of G.peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius && ped.state === 'walk') {
      ped.state = 'flee';
      ped.stateT = 1.6 + Math.random();
      ped.fleeX = ped.x + (ped.x - x) * 2.2;
      ped.fleeY = ped.y + (ped.y - y) * 2.2;
    }
  }
}

export function updatePedestrian(ped, dt) {
  ped.phase += dt * (ped.state === 'flee' ? 13 : 8);
  if (ped.state === 'down') {
    ped.stateT -= dt;
    if (ped.stateT <= 0) {
      ped.state = 'flee'; // they get up angry and run off
      ped.stateT = 2;
      ped.fleeX = ped.x + (Math.random() * 200 - 100);
      ped.fleeY = ped.y + (Math.random() * 200 - 100);
    }
    return;
  }
  let tx;
  let ty;
  if (ped.state === 'flee') {
    ped.stateT -= dt;
    tx = ped.fleeX;
    ty = ped.fleeY;
    if (ped.stateT <= 0) {
      ped.state = 'walk';
      snapToSidewalk(ped);
      return;
    }
  } else if (ped.axis === 'v') {
    tx = ped.line;
    ty = ped.y + ped.dir * 100;
    if (ped.y < 50) ped.dir = 1;
    if (ped.y > 3150) ped.dir = -1;
    // At an intersection, sometimes swap onto the crossing street.
    for (const hy of H_ROADS) {
      if (Math.abs(ped.y - hy) < 3 && Math.random() < 0.006) {
        ped.axis = 'h';
        ped.line = hy + (Math.random() < 0.5 ? -(ROAD_HALF + 13) : ROAD_HALF + 13);
        ped.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
  } else {
    tx = ped.x + ped.dir * 100;
    ty = ped.line;
    if (ped.x < 50) ped.dir = 1;
    if (ped.x > SAND_X + 120) ped.dir = -1;
    for (const vx of V_ROADS) {
      if (Math.abs(ped.x - vx) < 3 && Math.random() < 0.006) {
        ped.axis = 'v';
        ped.line = vx + (Math.random() < 0.5 ? -(ROAD_HALF + 13) : ROAD_HALF + 13);
        ped.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = ped.state === 'flee' ? 168 : ped.walkSpeed;
  const nx = ped.x + (dx / d) * speed * dt;
  const ny = ped.y + (dy / d) * speed * dt;
  if (!collides(nx, ny, 7)) {
    ped.x = nx;
    ped.y = ny;
  } else if (ped.state === 'walk') {
    ped.dir *= -1; // bumped into something: turn around
  }
  ped.angle = Math.atan2(dy, dx);
}

/** A car met this pedestrian at speed. Returns true if it was a hit. */
export function hitPedestrian(ped, speed) {
  if (ped.state === 'down') return false;
  if (speed > 55) {
    ped.state = 'down';
    ped.stateT = 3.5;
    return true;
  }
  ped.state = 'flee';
  ped.stateT = 1.4;
  ped.fleeX = ped.x + (Math.random() * 160 - 80);
  ped.fleeY = ped.y + (Math.random() * 160 - 80);
  return false;
}

export function drawPedestrian(g, ped) {
  g.save();
  g.translate(ped.x, ped.y);
  g.fillStyle = 'rgba(60,45,20,0.25)';
  g.beginPath();
  g.ellipse(2, 3, 8, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  if (ped.state === 'down') {
    g.rotate(Math.PI / 2.3);
    g.fillStyle = ped.shirt;
    g.fillRect(-11, -4, 20, 8);
    g.fillStyle = ped.skin;
    g.beginPath();
    g.arc(13, 0, 4.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  const step = Math.sin(ped.phase) * 3.4;
  g.rotate(ped.angle);
  // Legs.
  g.strokeStyle = '#3d4451';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(step, 3.4);
  g.moveTo(0, 0);
  g.lineTo(-step, -3.4);
  g.stroke();
  // Body and head.
  g.fillStyle = ped.shirt;
  g.beginPath();
  g.arc(0, 0, 6.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ped.skin;
  g.beginPath();
  g.arc(1.5, 0, 4.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
