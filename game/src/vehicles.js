// vehicles.js — every car in Palm Cove: the models, the parked rows in the
// lots, the traffic that drives the grid, the arcade driving physics the
// player uses, and how a car is drawn.
//
// Traffic follows the road grid intersection to intersection, keeping to
// the right-hand lane, slowing for the car in front and turning at
// junctions. The player's car uses the same body and collision code but
// takes its orders from the keyboard via driveCar().

import { G } from './state.js';
import {
  V_ROADS, H_ROADS, ROAD_HALF, lots, collides, randomRoadPoint, seededRandom,
} from './city.js';
import { spawnSparks, spawnSmoke, addSkid } from './effects.js';
import { playCrash } from './audio.js';

export const CAR_TYPES = {
  brisa: { label: 'Brisa', len: 40, wid: 20, topSpeed: 305, accel: 250, colors: ['#ffd94d', '#7fd4e6', '#f28bb4', '#a8e063'] },
  palmera: { label: 'Palmera', len: 46, wid: 22, topSpeed: 345, accel: 265, colors: ['#e8e8ec', '#b03a48', '#3a6ea5', '#4f772d'] },
  comet: { label: 'Comet GT', len: 48, wid: 23, topSpeed: 435, accel: 340, colors: ['#19c2c2', '#ff7847', '#ffe14d', '#9b5de5'] },
  marea: { label: 'Marea', len: 48, wid: 24, topSpeed: 330, accel: 240, colors: ['#5a6b7a', '#8c5e58', '#31572c', '#e0c097'] },
  tortuga: { label: 'Tortuga', len: 54, wid: 25, topSpeed: 290, accel: 215, colors: ['#f4f1e6', '#c9ada7', '#84a98c', '#e9c46a'] },
  interceptor: { label: 'PCPD Interceptor', len: 47, wid: 22, topSpeed: 405, accel: 320, colors: ['#f2f4f6'] },
};

const TRAFFIC_TYPES = ['brisa', 'palmera', 'comet', 'marea', 'tortuga'];
const LANE = 27; // lane offset from the road centre line
export const crashEvents = []; // filled during updates, read by player.js

let nextCarId = 1;

export function makeCar(type, x, y, angle, kind, color) {
  const spec = CAR_TYPES[type];
  const car = {
    id: nextCarId++,
    type,
    spec,
    x, y, angle,
    speed: 0,
    kind, // 'parked' | 'traffic' | 'police' | 'mission'
    color: color || spec.colors[(Math.random() * spec.colors.length) | 0],
    health: 100,
    stolen: false,
    dirx: Math.cos(angle),
    diry: Math.sin(angle),
    waypoint: null,
    stuckFor: 0,
    smokeTick: 0,
    copExited: false,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(car) {
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}

export function nearestCar(x, y, maxDist, filter = () => true) {
  let best = null;
  let bd = maxDist;
  for (const car of G.cars) {
    if (!filter(car)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) {
      bd = d;
      best = car;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Spawning.

/** Fill the parking lots with parked cars, a few per lot. */
export function spawnParkedCars() {
  const rand = seededRandom(777);
  for (const lot of lots) {
    const horizontal = lot.w >= lot.h;
    const stalls = Math.floor((horizontal ? lot.w : lot.h) / 36);
    for (let i = 0; i < stalls; i++) {
      if (rand() < 0.45) continue; // leave gaps in the rows
      const t = TRAFFIC_TYPES[(rand() * TRAFFIC_TYPES.length) | 0];
      let x; let y; let angle;
      if (horizontal) {
        x = lot.x + 18 + i * 36;
        const topRow = rand() < 0.5;
        y = topRow ? lot.y + 17 : lot.y + lot.h - 17;
        angle = topRow ? Math.PI / 2 : -Math.PI / 2;
      } else {
        y = lot.y + 18 + i * 36;
        const leftRow = rand() < 0.5;
        x = leftRow ? lot.x + 17 : lot.x + lot.w - 17;
        angle = leftRow ? 0 : Math.PI;
      }
      makeCar(t, x, y, angle, 'parked');
    }
  }
  // A few cars parked along Ocean Drive and the promenade.
  for (let i = 0; i < 7; i++) {
    const y = 200 + i * 430 + rand() * 120;
    makeCar(TRAFFIC_TYPES[(rand() * TRAFFIC_TYPES.length) | 0], 2885, y, Math.PI / 2, 'parked');
  }
}

/** Keep a living ring of traffic around the player. */
export function maintainTraffic() {
  const p = G.player;
  if (!p) return;
  let traffic = 0;
  for (const car of G.cars) if (car.kind === 'traffic') traffic++;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.kind === 'traffic' && Math.hypot(car.x - p.x, car.y - p.y) > 1500) {
      G.cars.splice(i, 1);
      traffic--;
    }
  }
  while (traffic < 13) {
    const pt = randomRoadPoint(Math.random);
    if (Math.hypot(pt.x - p.x, pt.y - p.y) < 620) continue;
    spawnTrafficCar(pt.x, pt.y);
    traffic++;
  }
}

export function spawnTrafficCar(x, y) {
  // Snap to the nearest road centre and pick a direction along it.
  let bestVx = V_ROADS[0];
  let bd = Infinity;
  for (const vx of V_ROADS) {
    const d = Math.abs(vx - x);
    if (d < bd) { bd = d; bestVx = vx; }
  }
  let bestHy = H_ROADS[0];
  bd = Infinity;
  for (const hy of H_ROADS) {
    const d = Math.abs(hy - y);
    if (d < bd) { bd = d; bestHy = hy; }
  }
  const onVertical = Math.abs(bestVx - x) <= Math.abs(bestHy - y);
  const car = makeCar(
    TRAFFIC_TYPES[(Math.random() * TRAFFIC_TYPES.length) | 0],
    onVertical ? bestVx : x,
    onVertical ? y : bestHy,
    0,
    'traffic',
  );
  if (onVertical) {
    car.dirx = 0;
    car.diry = Math.random() < 0.5 ? 1 : -1;
  } else {
    car.dirx = Math.random() < 0.5 ? 1 : -1;
    car.diry = 0;
  }
  placeOnLane(car);
  chooseWaypoint(car, true);
  return car;
}

/** Move a routed car onto its right-hand lane for its current direction. */
function placeOnLane(car) {
  const ox = -car.diry * LANE;
  const oy = car.dirx * LANE;
  if (car.diry !== 0) car.x = snapToRoad(car.x, V_ROADS) + ox;
  if (car.dirx !== 0) car.y = snapToRoad(car.y, H_ROADS) + oy;
  car.angle = Math.atan2(car.diry, car.dirx);
}

function snapToRoad(v, roads) {
  let best = roads[0];
  let bd = Infinity;
  for (const r of roads) {
    const d = Math.abs(r - v);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

/** Pick the next intersection the car will aim at, turning if it likes. */
function chooseWaypoint(car, first = false) {
  // The intersection ahead of the car along its direction of travel.
  let ix;
  let iy;
  if (car.dirx > 0) ix = V_ROADS.find((v) => v > car.x + 4) ?? V_ROADS[V_ROADS.length - 1];
  else if (car.dirx < 0) ix = [...V_ROADS].reverse().find((v) => v < car.x - 4) ?? V_ROADS[0];
  else ix = snapToRoad(car.x, V_ROADS);
  if (car.diry > 0) iy = H_ROADS.find((h) => h > car.y + 4) ?? H_ROADS[H_ROADS.length - 1];
  else if (car.diry < 0) iy = [...H_ROADS].reverse().find((h) => h < car.y - 4) ?? H_ROADS[0];
  else iy = snapToRoad(car.y, H_ROADS);
  if (car.dirx !== 0) iy = snapToRoad(car.y, H_ROADS);
  if (car.diry !== 0) ix = snapToRoad(car.x, V_ROADS);
  car.waypoint = { x: ix, y: iy };
  car.turnAtArrival = !first && Math.random() < 0.45;
}

function turnCar(car) {
  // At an intersection: go straight, or turn left or right (never a U-turn).
  const options = [];
  const straight = { dx: car.dirx, dy: car.diry };
  const left = { dx: car.diry, dy: -car.dirx };
  const right = { dx: -car.diry, dy: car.dirx };
  options.push(straight, straight);
  // Only turn if the road actually continues that way from here.
  if (car.waypoint.x + left.dx * 200 > 0 && car.waypoint.x + left.dx * 200 < 3300 &&
      car.waypoint.y + left.dy * 200 > 0 && car.waypoint.y + left.dy * 200 < 3200) options.push(left);
  if (car.waypoint.x + right.dx * 200 > 0 && car.waypoint.x + right.dx * 200 < 3300 &&
      car.waypoint.y + right.dy * 200 > 0 && car.waypoint.y + right.dy * 200 < 3200) options.push(right);
  const pick = options[(Math.random() * options.length) | 0];
  car.dirx = pick.dx;
  car.diry = pick.dy;
}

// ---------------------------------------------------------------------------
// Updates.

function angleLerpTurn(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > maxStep) diff = maxStep;
  if (diff < -maxStep) diff = -maxStep;
  return current + diff;
}

/** Shared movement + collision step for every driven car. */
function moveCar(car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probeX = nx + Math.cos(car.angle) * (car.spec.len / 2 - 6);
  const probeY = ny + Math.sin(car.angle) * (car.spec.len / 2 - 6);
  if (collides(probeX, probeY, 13) || collides(nx, ny, 15)) {
    if (Math.abs(car.speed) > 90) {
      crashEvents.push({ car, other: null, strength: Math.abs(car.speed) / 400 });
      spawnSparks(probeX, probeY, 8);
      car.health -= Math.abs(car.speed) * 0.045;
    }
    car.speed = -car.speed * 0.22;
    return;
  }
  car.x = nx;
  car.y = ny;
  // Car-to-car: soft circles, a push and a dent.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    const min = 34;
    if (d > 0.01 && d < min) {
      const rel = Math.abs(car.speed - other.speed);
      car.x += (dx / d) * (min - d) * 0.6;
      car.y += (dy / d) * (min - d) * 0.6;
      if (rel > 70) {
        crashEvents.push({ car, other, strength: rel / 400 });
        spawnSparks(car.x, car.y, 6);
        car.health -= rel * 0.03;
        other.health -= rel * 0.02;
      }
      if (car.kind !== 'parked') car.speed *= 0.55;
    }
  }
}

export function updateTrafficCar(car, dt) {
  if (!car.waypoint) chooseWaypoint(car, true);
  const laneX = car.waypoint.x + (car.dirx !== 0 ? 0 : -car.diry * LANE);
  const laneY = car.waypoint.y + (car.diry !== 0 ? 0 : car.dirx * LANE);
  // Aim at the point where the lane meets the next intersection, so the
  // car settles onto its lane as it approaches the junction.
  const aimX = car.dirx !== 0 ? car.waypoint.x : laneX;
  const aimY = car.diry !== 0 ? car.waypoint.y : laneY;
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  car.angle = angleLerpTurn(car.angle, desired, 2.3 * dt);

  // Slow for a car ahead in the same lane.
  let targetSpeed = 148;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (ahead > 0 && ahead < 62 && Math.abs(side) < 16) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, (ahead - 40) * 4));
    }
  }
  const distToWaypoint = Math.hypot(car.waypoint.x - car.x, car.waypoint.y - car.y);
  if (distToWaypoint < 90) targetSpeed = Math.min(targetSpeed, 105);
  if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 130 * dt);
  else car.speed = Math.max(targetSpeed, car.speed - 320 * dt);
  moveCar(car, dt);

  if (car.speed < 4 && targetSpeed > 40) car.stuckFor += dt;
  else car.stuckFor = 0;
  if (car.stuckFor > 2.5) {
    // Hop to the nearest intersection and start a fresh leg.
    const ix = snapToRoad(car.x, V_ROADS);
    const iy = snapToRoad(car.y, H_ROADS);
    car.x = ix;
    car.y = iy;
    if (Math.random() < 0.5) { car.dirx = 0; car.diry = Math.random() < 0.5 ? 1 : -1; }
    else { car.diry = 0; car.dirx = Math.random() < 0.5 ? 1 : -1; }
    placeOnLane(car);
    car.stuckFor = 0;
    chooseWaypoint(car, true);
    return;
  }
  if (distToWaypoint < 34) {
    if (car.turnAtArrival) turnCar(car);
    placeOnLane(car);
    chooseWaypoint(car);
  }
}

/**
 * Drive a car from direct input (the player, or a police chase brain that
 * sets the same fields). throttle -1..1, steer -1..1, handbrake boolean.
 */
export function driveCar(car, throttle, steer, handbrake, dt) {
  const spec = car.spec;
  if (throttle > 0) {
    if (car.speed < 0) {
      car.speed += spec.accel * throttle * dt * 2.4; // braking out of reverse
    } else {
      // Acceleration fades as the car nears its top speed, then stops.
      const fade = Math.max(0, 1 - car.speed / spec.topSpeed);
      car.speed = Math.min(spec.topSpeed, car.speed + spec.accel * throttle * dt * fade);
    }
  } else if (throttle < 0) {
    if (car.speed > 12) car.speed -= 430 * dt; // braking
    else car.speed = Math.max(-125, car.speed + spec.accel * throttle * dt * 0.7);
  } else {
    // Engine braking / rolling drag.
    const drag = 120 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  if (handbrake) {
    const dec = 520 * dt;
    car.speed = Math.abs(car.speed) <= dec ? 0 : car.speed - Math.sign(car.speed) * dec;
  }
  const speedFactor = Math.min(Math.abs(car.speed) / 95, 1);
  const turnRate = 2.05 * (handbrake ? 1.45 : 1) * speedFactor;
  car.angle += steer * turnRate * dt * (car.speed < 0 ? -1 : 1);
  moveCar(car, dt);

  // Skid marks when the tyres are suffering.
  const rearX = car.x - Math.cos(car.angle) * (spec.len / 2 - 6);
  const rearY = car.y - Math.sin(car.angle) * (spec.len / 2 - 6);
  if ((handbrake && Math.abs(car.speed) > 130) || (Math.abs(steer) > 0.9 && Math.abs(car.speed) > 300)) {
    addSkid(rearX, rearY);
  }
  if (car.health < 55) {
    car.smokeTick -= dt;
    if (car.smokeTick <= 0) {
      car.smokeTick = 0.09;
      spawnSmoke(car.x + Math.cos(car.angle) * 14, car.y + Math.sin(car.angle) * 14, car.health < 25);
    }
  }
  if (Math.abs(car.speed) > G.stats.topSpeed && car === G.player?.car) {
    G.stats.topSpeed = Math.abs(car.speed);
  }
}

/** Police and other AI drivers reuse driveCar with a steering brain. */
export function steerToward(car, tx, ty, dt, aggression = 1) {
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const throttle = Math.abs(diff) > 2.5 ? -0.7 : 1;
  driveCar(car, throttle * aggression, steer, false, dt);
  return dist;
}

// ---------------------------------------------------------------------------
// Drawing.

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function drawCar(g, car, time) {
  const { len, wid } = car.spec;
  g.save();
  g.translate(car.x, car.y);
  // Shadow.
  g.fillStyle = 'rgba(60,45,20,0.28)';
  roundRectPath(g, -len / 2 + 4, -wid / 2 + 5, len, wid, 7);
  g.fill();
  g.rotate(car.angle);
  // Wheels.
  g.fillStyle = '#1c1e22';
  const wx = len / 2 - 10;
  const wy = wid / 2 - 2;
  for (const [x, y] of [[-wx, -wy], [wx, -wy], [-wx, wy - 3], [wx, wy - 3]]) {
    g.fillRect(x - 5, y, 11, 5);
  }
  // Body.
  g.fillStyle = car.color;
  roundRectPath(g, -len / 2, -wid / 2, len, wid, 7);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.20)';
  roundRectPath(g, -len / 2 + 3, -wid / 2 + 3, len - 6, wid / 2 - 3, 5);
  g.fill();
  // Cabin and glass.
  g.fillStyle = '#22303c';
  roundRectPath(g, -len * 0.16, -wid / 2 + 3.5, len * 0.34, wid - 7, 4);
  g.fill();
  g.fillStyle = 'rgba(160,220,240,0.5)';
  roundRectPath(g, len * 0.05, -wid / 2 + 5, len * 0.1, wid - 10, 3);
  g.fill();
  // Headlights.
  g.fillStyle = '#fff6bf';
  g.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 4);
  g.fillRect(len / 2 - 3, wid / 2 - 7, 3, 4);
  g.fillStyle = '#e5484d';
  g.fillRect(-len / 2, -wid / 2 + 3, 3, 4);
  g.fillRect(-len / 2, wid / 2 - 7, 3, 4);

  if (car.kind === 'police') {
    g.fillStyle = '#274b8f';
    g.fillRect(-len * 0.02, -wid / 2, len * 0.2, wid);
    g.fillStyle = '#f2f4f6';
    g.font = 'bold 8px Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PCPD', len * 0.08, 0.5);
    // Light bar: red and blue strobes alternate.
    const phase = Math.floor(time * 6 + car.id) % 2;
    g.fillStyle = phase ? '#ff3b30' : '#5e5ce6';
    roundRectPath(g, -8, -wid / 2 + 4, 7, wid - 8, 2);
    g.fill();
    g.fillStyle = phase ? '#5e5ce6' : '#ff3b30';
    roundRectPath(g, 2, -wid / 2 + 4, 7, wid - 8, 2);
    g.fill();
    if (G.wanted.stars > 0) {
      g.fillStyle = phase ? 'rgba(255,59,48,0.08)' : 'rgba(94,92,230,0.08)';
      g.beginPath();
      g.arc(0, 0, 46, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (car.kind === 'mission') {
    // The story target gets a gold trim so the player can spot it.
    g.strokeStyle = '#ffd94d';
    g.lineWidth = 2;
    roundRectPath(g, -len / 2 - 1, -wid / 2 - 1, len + 2, wid + 2, 8);
    g.stroke();
  }
  g.restore();
}
