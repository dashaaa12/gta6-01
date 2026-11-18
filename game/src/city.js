// city.js — Palm Cove itself: the road grid, the blocks and buildings, the
// beach, the landmarks, and the static map pre-rendered to an offscreen
// canvas.
//
// The city is generated from a fixed seed, so Palm Cove is identical on
// every load: the same pastel towers, the same parking lots, the same
// palms. Only the people and the traffic move. Gameplay code asks this
// module three kinds of questions: where are the roads, what can I bump
// into, and where are the named places the story cares about.

import { WORLD } from './state.js';

export const ROAD_HALF = 60; // half the width of a road, in world units
export const V_ROADS = [340, 990, 1640, 2290, 2940];
export const H_ROADS = [340, 890, 1440, 1990, 2540];
export const SAND_X = 3260; // the beach starts here
export const WATER_X = 3460; // the ocean starts here

export const LANDMARKS = {
  garage: { x: 150, y: 1160, name: 'Ferrer Auto Works' },
  garageZone: { x: 96, y: 1230, w: 150, h: 92 }, // painted delivery bay
  police: { x: 1310, y: 150, name: 'Palm Cove PD' },
  hospital: { x: 2610, y: 2260, name: 'Palm Cove General' },
  hotel: { x: 3100, y: 170, name: 'Hotel Azure' },
  casino: { x: 1960, y: 1160, name: 'The Gilded Palm' },
  beachLot: { x: 3100, y: 1160, name: 'Beach Lot' },
  docks: { x: 3235, y: 2920, name: 'Marina del Sur' },
  hideout: { x: 665, y: 2150, name: 'The Palms hideout' },
};

/** Deterministic RNG (mulberry32) so the city never changes shape. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const buildings = []; // {x, y, w, h, color, roof, name}
export const palms = []; // {x, y, s} trunk positions and crown scale
export const lots = []; // parking lots {x, y, w, h} that hold parked cars

const BLOCK_COLS = [
  [30, 280],
  [400, 930],
  [1050, 1580],
  [1700, 2230],
  [2350, 2880],
  [3000, 3200],
];
const BLOCK_ROWS = [
  [30, 280],
  [400, 830],
  [950, 1380],
  [1500, 1930],
  [2050, 2480],
  [2600, 3140],
];

const PASTELS = ['#ffd9c0', '#f9c6d3', '#fff0ae', '#bfe3dd', '#c9dcf2', '#f6e3b4', '#e6ccf2', '#cfe8c0'];
const ROOFS = ['#ef8f6b', '#5fb4ad', '#e5b95f', '#8fa8c8', '#d97782', '#7fb069'];

function addBuilding(x, y, w, h, rand, name = '') {
  const i = (rand() * PASTELS.length) | 0;
  buildings.push({
    x, y, w, h,
    color: PASTELS[i],
    roof: ROOFS[(rand() * ROOFS.length) | 0],
    name,
  });
}

function buildBlock(col, row, rand) {
  const [x0, x1] = BLOCK_COLS[col];
  const [y0, y1] = BLOCK_ROWS[row];
  const key = `${col},${row}`;

  // Named cells the story needs, laid out by hand.
  if (key === '0,2') {
    // Ferrer Auto Works: one long workshop and its delivery yard.
    addBuilding(x0 + 10, y0 + 20, 190, 120, rand, 'FERRER AUTO WORKS');
    lots.push({ x: x0 + 16, y: y0 + 250, w: 200, h: 110 });
    return;
  }
  if (key === '2,0') {
    addBuilding(x0 + 90, y0 + 30, 300, 170, rand, 'PALM COVE PD');
    lots.push({ x: x0 + 60, y: y0 + 215, w: 340, h: 30 });
    return;
  }
  if (key === '4,4') {
    addBuilding(x0 + 60, y0 + 60, 300, 200, rand, 'PALM COVE GENERAL');
    return;
  }
  if (key === '5,0') {
    addBuilding(x0 + 25, y0 + 25, 150, 200, rand, 'HOTEL AZURE');
    return;
  }
  if (key === '3,2') {
    addBuilding(x0 + 60, y0 + 70, 380, 240, rand, 'THE GILDED PALM');
    lots.push({ x: x0 + 70, y: y0 + 340, w: 360, h: 70 });
    return;
  }
  if (key === '5,2') {
    // The Beach Lot: open parking by the sand, where a certain turquoise
    // sports car waits in mission one.
    lots.push({ x: x0 + 15, y: y0 + 60, w: 175, h: 300 });
    return;
  }
  if (key === '1,4') {
    // The Palms: a park block, no buildings, just grass and palms.
    for (let i = 0; i < 16; i++) {
      palms.push({
        x: x0 + 40 + rand() * (x1 - x0 - 80),
        y: y0 + 40 + rand() * (y1 - y0 - 80),
        s: 0.9 + rand() * 0.5,
      });
    }
    return;
  }
  if (key === '5,5') {
    // Marina del Sur: dock sheds at the south-east corner.
    addBuilding(x0 + 10, y0 + 60, 120, 90, rand, 'MARINA DEL SUR');
    addBuilding(x0 + 10, y0 + 300, 120, 90, rand, '');
    return;
  }

  // Generic blocks: sometimes a parking lot, usually pastel buildings
  // with alleys between them wide enough to run through.
  const roll = rand();
  if (roll < 0.18) {
    lots.push({ x: x0 + 14, y: y0 + 14, w: x1 - x0 - 28, h: y1 - y0 - 28 });
    return;
  }
  const bw = x1 - x0;
  const bh = y1 - y0;
  const cols = bw > 380 ? 2 : 1;
  const rows = bh > 380 ? 2 : 1;
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const cellW = bw / cols;
      const cellH = bh / rows;
      const m = 26;
      addBuilding(
        x0 + cx * cellW + m,
        y0 + cy * cellH + m,
        cellW - m * 2 - rand() * 30,
        cellH - m * 2 - rand() * 30,
        rand,
      );
    }
  }
}

export function buildCity() {
  if (buildings.length) return; // build once
  const rand = seededRandom(20261119);
  for (let col = 0; col < BLOCK_COLS.length; col++) {
    for (let row = 0; row < BLOCK_ROWS.length; row++) {
      buildBlock(col, row, rand);
    }
  }
  // Palms along the promenade and the coast road.
  for (let y = 90; y < WORLD.height - 60; y += 95) {
    palms.push({ x: 3228 + (rand() * 14 - 7), y: y + (rand() * 20 - 10), s: 1 + rand() * 0.4 });
  }
  for (let x = 60; x < 2900; x += 210) {
    if (rand() < 0.6) palms.push({ x: x + rand() * 30, y: 2610 + rand() * 24, s: 0.9 + rand() * 0.3 });
  }
}

// ---------------------------------------------------------------------------
// Queries the gameplay code lives on.

export function isRoad(x, y) {
  if (x >= SAND_X) return false;
  for (const vx of V_ROADS) if (Math.abs(x - vx) <= ROAD_HALF) return true;
  for (const hy of H_ROADS) if (Math.abs(y - hy) <= ROAD_HALF) return true;
  return false;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Does a circle at (x, y) with radius r touch anything solid? */
export function collides(x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  if (x + r > WATER_X) return true; // nobody drives into the ocean
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  for (const p of palms) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < (r + 5) * (r + 5)) return true;
  }
  return false;
}

/** A random point in the middle of a random road, for spawning traffic. */
export function randomRoadPoint(rand) {
  if (rand() < 0.5) {
    const vx = V_ROADS[(rand() * V_ROADS.length) | 0];
    return { x: vx, y: 80 + rand() * (WORLD.height - 160) };
  }
  const hy = H_ROADS[(rand() * H_ROADS.length) | 0];
  return { x: 80 + rand() * (SAND_X - 160), y: hy };
}

/** The nearest intersection to a point, used to route traffic. */
export function nearestIntersection(x, y) {
  let bx = V_ROADS[0];
  let by = H_ROADS[0];
  let bd = Infinity;
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      const d = (vx - x) * (vx - x) + (hy - y) * (hy - y);
      if (d < bd) {
        bd = d;
        bx = vx;
        by = hy;
      }
    }
  }
  return { x: bx, y: by };
}

// ---------------------------------------------------------------------------
// The pre-rendered static map.

let mapCanvas = null;

export function cityMapCanvas() {
  if (mapCanvas) return mapCanvas;
  buildCity();
  const c = document.createElement('canvas');
  c.width = WORLD.width;
  c.height = WORLD.height;
  const g = c.getContext('2d');
  paintGround(g);
  paintRoads(g);
  paintBeachAndWater(g);
  paintLots(g);
  paintPark(g);
  paintBuildings(g);
  paintPalms(g);
  paintGarageZone(g);
  mapCanvas = c;
  return c;
}

function paintGround(g) {
  g.fillStyle = '#ded4ba';
  g.fillRect(0, 0, WORLD.width, WORLD.height);
  // A faint block grid of pavement tones for texture.
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < WORLD.width; x += 130) {
    for (let y = 0; y < WORLD.height; y += 130) {
      if ((x + y) % 260 === 0) g.fillRect(x, y, 130, 130);
    }
  }
}

function paintRoads(g) {
  // Sidewalk skirts first, wider than the asphalt.
  g.fillStyle = '#c9bfa4';
  for (const vx of V_ROADS) g.fillRect(vx - ROAD_HALF - 15, 0, (ROAD_HALF + 15) * 2, WORLD.height);
  for (const hy of H_ROADS) g.fillRect(0, hy - ROAD_HALF - 15, SAND_X + 40, (ROAD_HALF + 15) * 2);
  // Asphalt.
  g.fillStyle = '#484d55';
  for (const vx of V_ROADS) g.fillRect(vx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD.height);
  for (const hy of H_ROADS) g.fillRect(0, hy - ROAD_HALF, SAND_X + 40, ROAD_HALF * 2);
  // Centre dashes.
  g.fillStyle = '#f5d76e';
  for (const vx of V_ROADS) {
    for (let y = 8; y < WORLD.height; y += 44) {
      if (!H_ROADS.some((hy) => Math.abs(y - hy) < ROAD_HALF + 14)) g.fillRect(vx - 2, y, 4, 24);
    }
  }
  for (const hy of H_ROADS) {
    for (let x = 8; x < SAND_X; x += 44) {
      if (!V_ROADS.some((vx) => Math.abs(x - vx) < ROAD_HALF + 14)) g.fillRect(x, hy - 2, 24, 4);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(240,240,235,0.75)';
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(vx - ROAD_HALF - 10, hy + i * 20 - 5, 12, 10);
        g.fillRect(vx + ROAD_HALF - 2, hy + i * 20 - 5, 12, 10);
        g.fillRect(vx + i * 20 - 5, hy - ROAD_HALF - 10, 10, 12);
        g.fillRect(vx + i * 20 - 5, hy + ROAD_HALF - 2, 10, 12);
      }
    }
  }
}

function paintBeachAndWater(g) {
  const sand = g.createLinearGradient(SAND_X, 0, WATER_X, 0);
  sand.addColorStop(0, '#f2dfae');
  sand.addColorStop(1, '#ecd096');
  g.fillStyle = sand;
  g.fillRect(SAND_X, 0, WATER_X - SAND_X, WORLD.height);
  const sea = g.createLinearGradient(WATER_X, 0, WORLD.width, 0);
  sea.addColorStop(0, '#3fb9cf');
  sea.addColorStop(1, '#1d7f96');
  g.fillStyle = sea;
  g.fillRect(WATER_X, 0, WORLD.width - WATER_X, WORLD.height);
  // Foam line and gentle wave strokes.
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(WATER_X + 2, 0);
  g.lineTo(WATER_X + 2, WORLD.height);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.20)';
  g.lineWidth = 2;
  for (let y = 40; y < WORLD.height; y += 90) {
    g.beginPath();
    g.moveTo(WATER_X + 26, y);
    g.quadraticCurveTo(WATER_X + 60, y - 10, WATER_X + 96, y);
    g.stroke();
  }
  // The promenade: a pale walkway between the coast road and the sand.
  g.fillStyle = '#e8dcc0';
  g.fillRect(3196, 0, 64, WORLD.height);
  // Marina piers reaching into the water at the south-east.
  g.fillStyle = '#9a6b46';
  for (const py of [2780, 2960, 3140]) {
    g.fillRect(3380, py, 190, 16);
  }
  // Moored boats, drawn as simple hulls.
  g.fillStyle = '#f4f1e6';
  for (const [bx, by] of [[3520, 2795], [3500, 2975], [3530, 3155]]) {
    g.beginPath();
    g.ellipse(bx, by, 26, 10, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function paintLots(g) {
  for (const lot of lots) {
    g.fillStyle = '#5b6068';
    g.fillRect(lot.x, lot.y, lot.w, lot.h);
    g.strokeStyle = 'rgba(240,240,235,0.5)';
    g.lineWidth = 2;
    const horizontal = lot.w >= lot.h;
    const stalls = Math.floor((horizontal ? lot.w : lot.h) / 34);
    for (let i = 0; i <= stalls; i++) {
      g.beginPath();
      if (horizontal) {
        g.moveTo(lot.x + i * 34, lot.y + 6);
        g.lineTo(lot.x + i * 34, lot.y + 26);
        g.moveTo(lot.x + i * 34, lot.y + lot.h - 26);
        g.lineTo(lot.x + i * 34, lot.y + lot.h - 6);
      } else {
        g.moveTo(lot.x + 6, lot.y + i * 34);
        g.lineTo(lot.x + 26, lot.y + i * 34);
        g.moveTo(lot.x + lot.w - 26, lot.y + i * 34);
        g.lineTo(lot.x + lot.w - 6, lot.y + i * 34);
      }
      g.stroke();
    }
  }
}

function paintPark(g) {
  const [x0, x1] = BLOCK_COLS[1];
  const [y0, y1] = BLOCK_ROWS[4];
  g.fillStyle = '#9ccb6b';
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = '#e8dcc0';
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(x0, (y0 + y1) / 2);
  g.lineTo(x1, (y0 + y1) / 2);
  g.moveTo((x0 + x1) / 2, y0);
  g.lineTo((x0 + x1) / 2, y1);
  g.stroke();
}

function paintBuildings(g) {
  for (const b of buildings) {
    // Drop shadow to the south-east: cheap height.
    g.fillStyle = 'rgba(70,50,20,0.25)';
    g.fillRect(b.x + 12, b.y + 14, b.w, b.h);
    g.fillStyle = b.color;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = b.roof;
    g.fillRect(b.x + 9, b.y + 9, b.w - 18, b.h - 18);
    // Rooftop details: vents and a window sheen.
    g.fillStyle = 'rgba(255,255,255,0.20)';
    g.fillRect(b.x + 20, b.y + 20, Math.max(10, b.w * 0.22), 12);
    g.fillStyle = 'rgba(0,0,0,0.13)';
    g.fillRect(b.x + b.w - 44, b.y + b.h - 40, 22, 16);
    if (b.name) {
      g.fillStyle = 'rgba(40,35,30,0.85)';
      g.font = 'bold 17px Verdana, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
    }
  }
}

function paintPalms(g) {
  for (const p of palms) {
    g.fillStyle = 'rgba(70,50,20,0.22)';
    g.beginPath();
    g.ellipse(p.x + 9, p.y + 10, 20 * p.s, 8 * p.s, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a6b46';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x + 3, p.y - 6);
    g.stroke();
    g.strokeStyle = '#3f9e4d';
    g.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
      g.beginPath();
      g.moveTo(p.x + 3, p.y - 6);
      g.quadraticCurveTo(
        p.x + 3 + Math.cos(a) * 15 * p.s,
        p.y - 14 * p.s,
        p.x + 3 + Math.cos(a) * 26 * p.s,
        p.y - 2 * p.s + Math.abs(Math.sin(a)) * 6,
      );
      g.stroke();
    }
  }
}

function paintGarageZone(g) {
  const z = LANDMARKS.garageZone;
  g.fillStyle = 'rgba(245,215,110,0.30)';
  g.fillRect(z.x, z.y, z.w, z.h);
  g.strokeStyle = '#f5d76e';
  g.lineWidth = 3;
  g.setLineDash([10, 7]);
  g.strokeRect(z.x, z.y, z.w, z.h);
  g.setLineDash([]);
  g.fillStyle = 'rgba(60,50,20,0.8)';
  g.font = 'bold 13px Verdana, sans-serif';
  g.textAlign = 'center';
  g.fillText('DELIVERIES', z.x + z.w / 2, z.y + z.h / 2);
}
