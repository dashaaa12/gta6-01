// state.js — the shared game state for Palm Cove Heat.
//
// Every module imports the single mutable object G from here, so there is
// exactly one source of truth for the player, the traffic, the police, the
// wanted level, the active mission and the camera. Modules talk to each
// other through G and through each other's exported functions, never
// through globals.

export const WORLD = {
  width: 3600,
  height: 3200,
};

export const G = {
  // 'title' | 'playing' | 'paused' | 'busted' | 'wasted'
  mode: 'title',
  // seconds of play since the current run started (frozen on menus)
  time: 0,
  // camera looks at the middle of the screen; zoom eases out at speed
  camera: { x: 1800, y: 1600, zoom: 1 },
  player: null,
  cars: [], // traffic, parked, police and the player's ride all live here
  peds: [],
  cops: [], // on-foot police officers
  bullets: [],
  particles: [],
  floaters: [],
  skids: [],
  // wanted level: heat is the raw score, stars the 0..5 level it maps to
  wanted: { heat: 0, stars: 0, hiddenFor: 0 },
  bustMeter: 0,
  // progression, persisted by save.js
  money: 250,
  missionIndex: 0,
  storyDone: false,
  delivered: 0,
  // mission runtime, owned by missions.js
  mission: null,
  objective: { title: '', text: '', marker: null },
  bannerQueue: [],
  banner: null,
  prompt: '',
  toast: null,
  // set by police.js each frame: is any officer looking at the player?
  playerSeen: false,
  stats: { shotsFired: 0, carsStolen: 0, topSpeed: 0 },
};

/** Reset all per-run state before a new game or a continue. */
export function resetRunState() {
  G.cars.length = 0;
  G.peds.length = 0;
  G.cops.length = 0;
  G.bullets.length = 0;
  G.particles.length = 0;
  G.floaters.length = 0;
  G.skids.length = 0;
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  G.wanted.hiddenFor = 0;
  G.bustMeter = 0;
  G.mission = null;
  G.bannerQueue.length = 0;
  G.banner = null;
  G.prompt = '';
  G.toast = null;
  G.playerSeen = false;
  G.time = 0;
}
