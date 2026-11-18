// main.js — Palm Cove Heat's entry point: boot, the game loop, the camera,
// the title/pause/busted/wasted state machine, and respawning.
//
// The loop is deliberately plain: fixed-order updates (player, bullets,
// traffic, pedestrians, police, missions, effects) and a single render
// pass that draws the pre-rendered city, then the living things, then the
// HUD. Menus are states of the same loop, never separate pages.

import { G, resetRunState } from './state.js';
import { buildCity, cityMapCanvas, LANDMARKS } from './city.js';
import { installInput, keys, pressed, mouse, endFrameInput } from './input.js';
import { createPlayer, updatePlayer, updateBullets, drawPlayer } from './player.js';
import { spawnParkedCars, maintainTraffic, updateTrafficCar, drawCar, makeCar } from './vehicles.js';
import { maintainPedestrians, updatePedestrian, drawPedestrian } from './pedestrians.js';
import { updateWanted, updatePolice, resetWanted, drawCop } from './police.js';
import { startMissionChain, updateMissions } from './missions.js';
import { updateEffects, drawSkids, drawParticles, drawFloaters } from './effects.js';
import { drawHUD, drawMenus, drawObjectiveMarker, updateBanners, handleMenuClick } from './hud.js';
import { saveProgress, loadProgress, wipeSave } from './save.js';
import { initAudio, toggleMute, setEngine, setSiren } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();
installInput(canvas);
buildCity();

// ---------------------------------------------------------------------------
// Run lifecycle.

function setupWorld() {
  resetRunState();
  spawnParkedCars();
  const p = createPlayer(238, 1120);
  p.angle = Math.PI / 2;
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.camera.zoom = 1;
}

function startNewGame() {
  wipeSave();
  G.money = 250;
  G.missionIndex = 0;
  G.storyDone = false;
  G.delivered = 0;
  G.stats.carsStolen = 0;
  setupWorld();
  startMissionChain();
  saveProgress();
  G.mode = 'playing';
}

function continueGame() {
  loadProgress();
  setupWorld();
  startMissionChain();
  G.mode = 'playing';
}

function respawn() {
  const p = G.player;
  if (G.mode === 'busted') {
    G.money = Math.max(0, G.money - Math.min(250, G.money));
    if (p.car) {
      // Impounded: the car Danny was caught in is gone.
      const i = G.cars.indexOf(p.car);
      if (i >= 0) G.cars.splice(i, 1);
      p.car = null;
    }
    p.x = LANDMARKS.police.x + 30;
    p.y = LANDMARKS.police.y + 130;
  } else {
    G.money = Math.max(0, G.money - Math.min(200, G.money));
    if (p.car) p.car = null; // the car stays where it fell; Danny walks out of hospital
    p.x = LANDMARKS.hospital.x;
    p.y = LANDMARKS.hospital.y + 150;
  }
  p.hp = 100;
  resetWanted();
  G.camera.x = p.x;
  G.camera.y = p.y;
  saveProgress();
  G.mode = 'playing';
}

// Ambient world behind the title screen: a living city with no hero yet.
setupWorld();
G.mode = 'title';

// ---------------------------------------------------------------------------
// Input that belongs to the state machine, not the player.

function handleMetaKeys() {
  if (pressed.has('KeyP') || pressed.has('Escape')) {
    if (G.mode === 'playing') G.mode = 'paused';
    else if (G.mode === 'paused') G.mode = 'playing';
  }
  if (pressed.has('KeyM')) toggleMute();
  if (pressed.has('Enter')) {
    initAudio();
    if (G.mode === 'title') startNewGame();
    else if (G.mode === 'busted' || G.mode === 'wasted') respawn();
    else if (G.mode === 'paused') G.mode = 'playing';
  }
}

function handleClicks() {
  if (!mouse.clicked) return;
  initAudio();
  if (G.mode === 'playing') return;
  const action = handleMenuClick(mouse.x, mouse.y);
  if (action === 'new') startNewGame();
  else if (action === 'continue') continueGame();
  else if (action === 'resume') G.mode = 'playing';
  else if (action === 'title') {
    setupWorld();
    G.mode = 'title';
  } else if (action === 'respawn') respawn();
}

// ---------------------------------------------------------------------------
// Updates.

function updatePlaying(dt) {
  G.time += dt;
  updatePlayer(dt);
  if (G.mode !== 'playing') return; // Danny may have been busted/wasted mid-update
  updateBullets(dt);
  maintainTraffic();
  for (const car of G.cars) {
    if (car.kind === 'traffic' && car !== G.player.car) updateTrafficCar(car, dt);
  }
  maintainPedestrians();
  for (const ped of G.peds) updatePedestrian(ped, dt);
  updateWanted(dt);
  updatePolice(dt);
  updateMissions(dt);
  updateEffects(dt);
  updateBanners(dt);
  updateAudio();
}

function updateAmbient(dt) {
  // Behind the menus the city keeps living, quietly.
  maintainTraffic();
  for (const car of G.cars) {
    if (car.kind === 'traffic') updateTrafficCar(car, dt);
  }
  maintainPedestrians();
  for (const ped of G.peds) updatePedestrian(ped, dt);
  updateEffects(dt);
  updateBanners(dt);
}

function updateAudio() {
  const p = G.player;
  if (p.car) setEngine(Math.abs(p.car.speed) / p.car.spec.topSpeed, true);
  else setEngine(0, false);
  let nearest = Infinity;
  for (const car of G.cars) {
    if (car.kind === 'police') {
      nearest = Math.min(nearest, Math.hypot(car.x - p.x, car.y - p.y));
    }
  }
  setSiren(nearest === Infinity ? 0 : Math.max(0, 1 - nearest / 620));
}

function updateCamera(dt) {
  const cam = G.camera;
  if (G.mode === 'title') {
    // A slow drift down Ocean Drive behind the title.
    const t = performance.now() / 1000;
    cam.x += ((2980 + Math.sin(t * 0.07) * 260) - cam.x) * Math.min(1, dt * 1.4);
    cam.y += ((1500 + Math.cos(t * 0.05) * 700) - cam.y) * Math.min(1, dt * 1.4);
    cam.zoom += (0.92 - cam.zoom) * Math.min(1, dt * 2);
    return;
  }
  const p = G.player;
  if (!p) return;
  const look = p.car ? 0.16 : 0.05;
  const tx = p.x + Math.cos(p.angle) * (p.car ? Math.abs(p.car.speed) * look : 12);
  const ty = p.y + Math.sin(p.angle) * (p.car ? Math.abs(p.car.speed) * look : 12);
  const k = 1 - Math.exp(-dt * 5.2);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const targetZoom = p.car ? 1 - Math.min(Math.abs(p.car.speed) / p.car.spec.topSpeed, 1) * 0.17 : 1;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2.4);
}

// ---------------------------------------------------------------------------
// Rendering.

function render(time) {
  const w = canvas.width;
  const h = canvas.height;
  const cam = G.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2b9db8';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(cityMapCanvas(), 0, 0);
  drawSkids(ctx);
  drawObjectiveMarker(ctx, time);
  for (const car of G.cars) drawCar(ctx, car, time);
  for (const ped of G.peds) drawPedestrian(ctx, ped);
  for (const cop of G.cops) drawCop(ctx, cop);
  if (G.player) drawPlayer(ctx, G.player);
  // Bullets as short tracers.
  for (const b of G.bullets) {
    ctx.strokeStyle = b.from === 'player' ? 'rgba(255,230,150,0.95)' : 'rgba(255,150,120,0.95)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  drawParticles(ctx);
  drawFloaters(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD(ctx, w, h, time);
  drawMenus(ctx, w, h, time);
}

// ---------------------------------------------------------------------------
// The loop.

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleMetaKeys();
  handleClicks();
  if (G.mode === 'playing') updatePlaying(dt);
  else if (G.mode === 'title') updateAmbient(dt);
  updateCamera(dt);
  render(now / 1000);
  endFrameInput();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// A small staging handle for the maker's screenshot driver. It exposes the
// same state the game itself reads, plus a few scene-setting helpers, so
// screenshots can be taken of real gameplay states.

window.PALM_COVE = {
  G,
  newGame: startNewGame,
  continueGame,
  respawn,
  stage: {
    teleport(x, y) {
      const p = G.player;
      if (p.car) {
        p.car.x = x;
        p.car.y = y;
      }
      p.x = x;
      p.y = y;
      G.camera.x = x;
      G.camera.y = y;
    },
    setStars(n) {
      // Mid-band heat values, so the level survives a little decay.
      G.wanted.heat = [0, 20, 42, 70, 102, 140][Math.max(0, Math.min(5, n))];
    },
    putInNearestCar() {
      const p = G.player;
      let best = null;
      let bd = Infinity;
      for (const car of G.cars) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < bd) { bd = d; best = car; }
      }
      if (best) {
        p.car = best;
        p.x = best.x;
        p.y = best.y;
      }
      return best;
    },
    spawnCarBeside(type = 'palmera') {
      const p = G.player;
      const car = makeCar(type, p.x + 40, p.y, 0, 'parked');
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      return car;
    },
    state() {
      const p = G.player;
      return {
        mode: G.mode,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: Math.round(p.hp),
        inCar: !!p.car,
        carSpeed: p.car ? Math.round(p.car.speed) : 0,
        stars: G.wanted.stars,
        money: G.money,
        mission: G.mission ? G.mission.def.title : null,
        step: G.mission ? G.mission.stepIndex : -1,
        objective: G.objective.text,
        cars: G.cars.length,
        peds: G.peds.length,
        cops: G.cops.length,
        policeCars: G.cars.filter((c) => c.kind === 'police').length,
      };
    },
  },
};
