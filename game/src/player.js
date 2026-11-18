// player.js — Danny Solano: walking, aiming, shooting, stealing cars and
// driving them, taking damage and getting back up at the hospital.
//
// On foot the game is a twin-stick: WASD moves, the mouse aims, holding
// the mouse button fires. F (or E) is the interact key — it is how Danny
// gets into any car in Palm Cove, including the ones that are not his.
// In a car the same keys drive, Space is the handbrake, and F gets out.

import { G } from './state.js';
import { collides } from './city.js';
import { keys, pressed, mouse } from './input.js';
import { driveCar, nearestCar, crashEvents } from './vehicles.js';
import { spawnPedestrian, scarePeds, hitPedestrian } from './pedestrians.js';
import { commitCrime } from './police.js';
import { spawnMuzzle, spawnSparks, spawnPuff } from './effects.js';
import { playShot, playCrash } from './audio.js';

export function createPlayer(x, y) {
  const player = {
    x, y,
    angle: 0,
    hp: 100,
    car: null,
    fireCd: 0,
    lastHurtAt: -99,
    walkPhase: 0,
    moving: false,
  };
  G.player = player;
  return player;
}

function interactPressed() {
  return pressed.has('KeyF') || pressed.has('KeyE');
}

/** Screen pixels to world coordinates, through the camera. */
export function screenToWorld(sx, sy) {
  const cam = G.camera;
  return {
    x: cam.x + (sx - innerWidth / 2) / cam.zoom,
    y: cam.y + (sy - innerHeight / 2) / cam.zoom,
  };
}

export function hurtPlayer(amount) {
  const p = G.player;
  if (!p || G.mode !== 'playing') return;
  p.hp -= amount;
  p.lastHurtAt = G.time;
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = 'wasted';
  }
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  p.fireCd -= dt;
  // Slow health regen once Danny has been out of the fire for a while.
  if (G.time - p.lastHurtAt > 7 && p.hp > 0 && p.hp < 100) {
    p.hp = Math.min(100, p.hp + 6 * dt);
  }
  if (p.car) updateDriving(p, dt);
  else updateOnFoot(p, dt);
  consumeCrashEvents(p);
}

function updateOnFoot(p, dt) {
  G.prompt = ''; // missions and nearby cars set it fresh each frame
  let mx = 0;
  let my = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = sprint ? 236 : 150;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    p.walkPhase += dt * (sprint ? 13 : 10);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    if (!collides(nx, p.y, 10)) p.x = nx;
    if (!collides(p.x, ny, 10)) p.y = ny;
  }
  // Aim at the mouse; fire while it is held.
  const aim = screenToWorld(mouse.x, mouse.y);
  p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  if (mouse.down && p.fireCd <= 0) {
    p.fireCd = 0.145;
    fireBullet(p);
  }
  // Interact: get into the nearest car.
  const near = nearestCar(p.x, p.y, 54);
  if (near) {
    if (near.kind === 'police') G.prompt = `F — Steal the ${near.spec.label} (very illegal)`;
    else if (near.kind === 'mission') G.prompt = `F — Take the ${near.spec.label}`;
    else G.prompt = `F — Steal the ${near.spec.label}`;
    if (interactPressed()) enterCar(p, near);
  }
}

function fireBullet(p) {
  const spread = (Math.random() - 0.5) * 0.035;
  const a = p.angle + spread;
  G.bullets.push({
    x: p.x + Math.cos(p.angle) * 15,
    y: p.y + Math.sin(p.angle) * 15,
    vx: Math.cos(a) * 820,
    vy: Math.sin(a) * 820,
    life: 0.55,
    from: 'player',
  });
  G.stats.shotsFired++;
  spawnMuzzle(p.x, p.y, p.angle);
  playShot();
  scarePeds(p.x, p.y, 250);
  commitCrime('shotFired');
}

function enterCar(p, car) {
  if (car.kind === 'traffic') {
    // The driver bails out and runs for it.
    const driver = spawnPedestrian(car.x + 14, car.y + 10);
    driver.state = 'flee';
    driver.stateT = 2.4;
    driver.fleeX = car.x - 160;
    driver.fleeY = car.y + 120;
    commitCrime('theft');
    car.stolen = true;
    G.stats.carsStolen++;
  } else if (car.kind === 'parked' || car.kind === 'mission') {
    // Even the car Sol sent Danny for is somebody else's car.
    commitCrime('theft');
    car.stolen = true;
    G.stats.carsStolen++;
  } else if (car.kind === 'police') {
    commitCrime('theft');
    commitCrime('hitCopCar');
    car.stolen = true;
    G.stats.carsStolen++;
  }
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  G.prompt = '';
}

function exitCar(p) {
  const car = p.car;
  p.car = null;
  if (car.kind === 'traffic' || car.kind === 'police') car.kind = 'parked';
  // Step out beside the car, trying the left side, the right, then behind.
  const offsets = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];
  for (const off of offsets) {
    const x = car.x + Math.cos(car.angle + off) * 27;
    const y = car.y + Math.sin(car.angle + off) * 27;
    if (!collides(x, y, 10)) {
      p.x = x;
      p.y = y;
      return;
    }
  }
  p.x = car.x;
  p.y = car.y - 27;
}

function updateDriving(p, dt) {
  const car = p.car;
  let throttle = 0;
  let steer = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) throttle = 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) throttle = -1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer = -1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer = 1;
  const handbrake = keys.has('Space');
  driveCar(car, throttle, steer, handbrake, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Running people over is a crime and a mess.
  if (Math.abs(car.speed) > 50) {
    for (const ped of G.peds) {
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 25) {
        if (ped.state !== 'down') {
          const wasHit = hitPedestrian(ped, Math.abs(car.speed));
          if (wasHit) {
            commitCrime('hitPed');
            car.speed *= 0.72;
            spawnPuff(ped.x, ped.y, 'rgba(230,80,80,0.6)');
          }
        }
      }
    }
    scarePeds(car.x, car.y, 90);
  }
  G.prompt = 'F — Get out';
  if (interactPressed()) {
    exitCar(p);
    G.prompt = '';
  }
}

function consumeCrashEvents(p) {
  for (const ev of crashEvents) {
    const mine = p.car && ev.car === p.car;
    const againstMe = p.car && ev.other === p.car;
    if (mine || againstMe) {
      playCrash(ev.strength);
      if (ev.strength > 0.35) hurtPlayer(ev.strength * 7);
      if (ev.other && ev.other.kind === 'police') commitCrime('hitCopCar');
      else if (ev.other && ev.strength > 0.3) commitCrime('ramCar');
      else if (!ev.other && ev.strength > 0.45) commitCrime('propertyDamage');
    } else if (ev.car.kind === 'police' || (ev.other && ev.other.kind === 'police')) {
      // Police trading paint near the player still makes noise.
      if (Math.hypot(ev.car.x - p.x, ev.car.y - p.y) < 500) playCrash(ev.strength * 0.6);
    }
  }
  crashEvents.length = 0;
}

/** Bullets fly straight and stop at the first thing they meet. */
export function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && collides(b.x, b.y, 2)) {
      spawnSparks(b.x, b.y, 3);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const cop of G.cops) {
        if (cop.state !== 'down' && Math.hypot(cop.x - b.x, cop.y - b.y) < 12) {
          cop.hp -= 34;
          spawnPuff(b.x, b.y, 'rgba(230,80,80,0.65)');
          if (cop.hp <= 0) cop.state = 'down';
          commitCrime('shootCop');
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
            ped.state = 'down';
            ped.stateT = 6;
            spawnPuff(b.x, b.y, 'rgba(230,80,80,0.65)');
            commitCrime('shootPed');
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of G.cars) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < 25) {
            car.health -= 7;
            spawnSparks(b.x, b.y, 3);
            if (car.kind === 'police') commitCrime('shootCop');
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'cop') {
      const p = G.player;
      if (p.car) {
        if (Math.hypot(p.car.x - b.x, p.car.y - b.y) < 26) {
          p.car.health -= 5;
          spawnSparks(b.x, b.y, 3);
          dead = true;
        }
      } else if (Math.hypot(p.x - b.x, p.y - b.y) < 11) {
        hurtPlayer(7);
        spawnPuff(b.x, b.y, 'rgba(230,80,80,0.65)');
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function drawPlayer(g, p) {
  if (p.car) return; // the car is drawn by vehicles.js
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(60,45,20,0.28)';
  g.beginPath();
  g.ellipse(2, 3, 9, 5, 0, 0, Math.PI * 2);
  g.fill();
  const step = p.moving ? Math.sin(p.walkPhase) * 3.6 : 0;
  g.rotate(p.angle);
  g.strokeStyle = '#2f3b46';
  g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(step, 3.6);
  g.moveTo(0, 0);
  g.lineTo(-step, -3.6);
  g.stroke();
  // Torso: Danny's teal shirt.
  g.fillStyle = '#0e7c86';
  g.beginPath();
  g.arc(0, 0, 7, 0, Math.PI * 2);
  g.fill();
  // Arms and the pistol, toward the aim.
  g.strokeStyle = '#e0ac69';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(2, -3);
  g.lineTo(11, -1.5);
  g.moveTo(2, 3);
  g.lineTo(11, 1.5);
  g.stroke();
  g.fillStyle = '#22242a';
  g.fillRect(10, -1.6, 8, 3.2);
  // Head with a coral cap.
  g.fillStyle = '#e0ac69';
  g.beginPath();
  g.arc(1.5, 0, 4.8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ff6b5e';
  g.beginPath();
  g.arc(1.5, 0, 4.8, Math.PI * 0.7, Math.PI * 1.9);
  g.fill();
  g.restore();
}
