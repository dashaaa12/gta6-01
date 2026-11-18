// missions.js — the story of Palm Cove Heat, told in three jobs from
// Marisol "Sol" Ferrer, and the free-roam living Danny makes afterwards.
//
// Sol runs Ferrer Auto Works and always needs cars, packages and drivers.
// Each mission is a list of steps; a step knows its objective text, where
// its marker sits, and the moment it is done. Completing a mission pays
// cash, saves the game, and after a short breather Sol calls again. Once
// the story is done, any stolen car can be fenced at her garage, forever.

import { G } from './state.js';
import { LANDMARKS, pointInRect } from './city.js';
import { makeCar, removeCar } from './vehicles.js';
import { saveProgress } from './save.js';
import { addFloater } from './effects.js';
import { playMissionComplete, playCash, playPhoneBlip } from './audio.js';

export function queueBanner(from, text, dur = 5.2) {
  G.bannerQueue.push({ from, text, t: 0, dur });
  if (G.bannerQueue.length === 1 && !G.banner) playPhoneBlip();
}

const FENCE_BASE = { brisa: 150, palmera: 220, comet: 380, marea: 260, tortuga: 240, interceptor: 300 };

function payPlayer(amount, x, y) {
  G.money += amount;
  addFloater(x, y - 24, `+$${amount.toLocaleString()}`, '#7ee787');
  playCash();
  saveProgress();
}

function forceExitCar() {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  p.car = null;
  if (car.kind === 'traffic' || car.kind === 'police') car.kind = 'parked';
  p.x = car.x;
  p.y = car.y + 30;
}

const MISSIONS = [
  {
    title: 'First Wheels',
    reward: 900,
    intro: [
      ['Sol', "Danny? It's Sol Ferrer. Heard you're back in Palm Cove and short on cash."],
      ['Sol', 'Easy money: a turquoise Comet GT is sitting in the Beach Lot. Bring it to my garage.'],
    ],
    outro: [['Sol', 'Clean work. She purrs. Your cut is in your pocket — stick around, more coming.']],
    steps: [
      {
        objective: 'Steal the turquoise Comet GT at the Beach Lot',
        onStart(m) {
          m.targetCar = makeCar('comet', 3100, 1090, -Math.PI / 2, 'mission', '#19c2c2');
        },
        marker: (m) => (m.targetCar ? { x: m.targetCar.x, y: m.targetCar.y } : null),
        update: (m) => G.player.car === m.targetCar,
      },
      {
        objective: 'Deliver the Comet to Ferrer Auto Works',
        marker: () => ({ x: LANDMARKS.garageZone.x + 75, y: LANDMARKS.garageZone.y + 46 }),
        update(m) {
          const p = G.player;
          return p.car === m.targetCar && pointInRect(p.x, p.y, LANDMARKS.garageZone);
        },
      },
    ],
    onComplete(m) {
      const car = m.targetCar;
      if (car) {
        if (G.player.car === car) forceExitCar();
        removeCar(car);
      }
    },
  },
  {
    title: 'Hot Package',
    reward: 1400,
    intro: [
      ['Sol', 'New job. A package is waiting at Marina del Sur, south docks. On foot, quiet.'],
      ['Sol', 'Then it goes to a guest at Hotel Azure, north end of the beach. He pays well for fast.'],
    ],
    outro: [['Sol', 'The guest is happy, which makes me happy. You drive angry cops well, Danny.']],
    steps: [
      {
        objective: 'Pick up the package at Marina del Sur',
        marker: () => ({ x: LANDMARKS.docks.x, y: LANDMARKS.docks.y }),
        update() {
          const p = G.player;
          return !p.car && Math.hypot(p.x - LANDMARKS.docks.x, p.y - LANDMARKS.docks.y) < 42;
        },
        onDone() {
          // The pickup was watched: the run north starts at two stars.
          G.wanted.heat = Math.max(G.wanted.heat, 34);
          queueBanner('Sol', 'Danny — that dock has eyes. You have company. DRIVE.');
        },
      },
      {
        objective: 'Deliver the package to Hotel Azure',
        timed: 150,
        marker: () => ({ x: 3100, y: 292 }),
        update() {
          const p = G.player;
          return Math.hypot(p.x - 3100, p.y - 292) < 54;
        },
        onFail() {
          queueBanner('Sol', 'Too slow — the guest checked out. Get another package from the marina.');
        },
      },
    ],
  },
  {
    title: 'Loud Exit',
    reward: 2500,
    intro: [
      ['Sol', 'Last one, and it is not quiet. My crew just walked out of the Gilded Palm with the take.'],
      ['Sol', 'Their Tortuga van is at the casino. Get in, lose the heat, park it at the Palms hideout.'],
    ],
    outro: [
      ['Sol', 'That is the loudest exit this town has seen all year. We are square, Danny.'],
      ['Sol', 'Palm Cove is yours now. Bring me any car you lift — I always pay.'],
    ],
    steps: [
      {
        objective: "Take the crew's Tortuga van at the Gilded Palm",
        onStart(m) {
          m.targetCar = makeCar('tortuga', 1950, 1325, 0, 'mission', '#e9c46a');
        },
        marker: (m) => (m.targetCar ? { x: m.targetCar.x, y: m.targetCar.y } : null),
        update: (m) => G.player.car === m.targetCar,
      },
      {
        objective: 'Shake the heat, then park the van at the Palms hideout',
        onStart() {
          // The whole city heard the casino job: three stars, instantly.
          G.wanted.heat = Math.max(G.wanted.heat, 62);
        },
        marker: () => ({ x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y }),
        update(m) {
          const p = G.player;
          return (
            p.car === m.targetCar &&
            G.wanted.stars === 0 &&
            Math.hypot(p.x - LANDMARKS.hideout.x, p.y - LANDMARKS.hideout.y) < 64
          );
        },
      },
    ],
    onComplete(m) {
      const car = m.targetCar;
      if (car) {
        if (G.player.car === car) forceExitCar();
        removeCar(car);
      }
    },
  },
];

let nextMissionAt = -1;

/** Begin (or resume) the chain at G.missionIndex. */
export function startMissionChain() {
  if (G.storyDone || G.missionIndex >= MISSIONS.length) {
    G.storyDone = true;
    return;
  }
  nextMissionAt = G.time + 1.6;
}

function beginMission(index) {
  const def = MISSIONS[index];
  const m = {
    def,
    index,
    stepIndex: 0,
    targetCar: null,
    timeLeft: def.steps[0].timed || 0,
  };
  G.mission = m;
  for (const [from, text] of def.intro) queueBanner(from, text);
  if (def.steps[0].onStart) def.steps[0].onStart(m);
  refreshObjective();
}

function refreshObjective() {
  const m = G.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  let text = step.objective;
  if (step.timed) text += ` — ${Math.max(0, Math.ceil(m.timeLeft))}s left`;
  G.objective = {
    title: m.def.title,
    text,
    marker: step.marker ? step.marker(m) : null,
  };
}

function completeStep() {
  const m = G.mission;
  const step = m.def.steps[m.stepIndex];
  if (step.onDone) step.onDone();
  m.stepIndex++;
  if (m.stepIndex >= m.def.steps.length) {
    completeMission();
    return;
  }
  const next = m.def.steps[m.stepIndex];
  m.timeLeft = next.timed || 0;
  if (next.onStart) next.onStart(m);
  refreshObjective();
}

function completeMission() {
  const m = G.mission;
  if (m.def.onComplete) m.def.onComplete(m);
  // A finished job takes the heat off: Sol's people make calls, witnesses
  // forget faces, and Danny gets to enjoy being paid for a moment.
  G.wanted.heat = 0;
  G.bustMeter = 0;
  const p = G.player;
  payPlayer(m.def.reward, p.x, p.y);
  playMissionComplete();
  G.toast = { text: `${m.def.title.toUpperCase()} — COMPLETE`, sub: `+$${m.def.reward.toLocaleString()}`, t: 0 };
  for (const [from, text] of m.def.outro) queueBanner(from, text);
  G.missionIndex = m.index + 1;
  G.mission = null;
  if (G.missionIndex >= MISSIONS.length) {
    G.storyDone = true;
    saveProgress();
  } else {
    nextMissionAt = G.time + 9;
  }
  G.objective = { title: 'Palm Cove', text: '', marker: null };
}

export function updateMissions(dt) {
  const p = G.player;
  if (!p) return;

  // The next call from Sol comes in on its own.
  if (!G.mission && !G.storyDone && nextMissionAt > 0 && G.time >= nextMissionAt) {
    nextMissionAt = -1;
    beginMission(G.missionIndex);
  }

  const m = G.mission;
  if (m) {
    // A wrecked target car is replaced by Sol's people, quietly.
    if (m.targetCar && m.targetCar.health <= 4 && p.car !== m.targetCar) {
      removeCar(m.targetCar);
      m.targetCar = null;
      const step = m.def.steps[m.stepIndex];
      if (step.onStart) step.onStart(m);
      queueBanner('Sol', 'That car is scrap. Another one is waiting where the first was.');
    }
    const step = m.def.steps[m.stepIndex];
    if (step.timed) {
      m.timeLeft -= dt;
      if (m.timeLeft <= 0) {
        if (step.onFail) step.onFail();
        m.stepIndex = Math.max(0, m.stepIndex - 1);
        const back = m.def.steps[m.stepIndex];
        m.timeLeft = back.timed || 0;
        if (back.onStart) back.onStart(m);
      }
    }
    refreshObjective();
    if (step.update(m)) completeStep();
    return;
  }

  // Free roam: fence stolen cars at Ferrer Auto Works.
  if (G.storyDone) {
    if (p.car && p.car.stolen) {
      G.objective = {
        title: 'Free Roam',
        text: `Fence the ${p.car.spec.label} at Ferrer Auto Works — or keep cruising`,
        marker: { x: LANDMARKS.garageZone.x + 75, y: LANDMARKS.garageZone.y + 46 },
      };
      if (pointInRect(p.x, p.y, LANDMARKS.garageZone)) {
        const car = p.car;
        const payout = Math.round((FENCE_BASE[car.type] || 180) * (0.4 + 0.6 * (car.health / 100)));
        forceExitCar();
        removeCar(car);
        G.delivered++;
        payPlayer(payout, p.x, p.y);
        queueBanner('Sol', `Pleasure doing business. That is car number ${G.delivered} you have brought me.`);
      }
    } else {
      G.objective = {
        title: 'Free Roam',
        text: 'Palm Cove is yours — lift a car and bring it to Ferrer Auto for cash',
        marker: null,
      };
    }
  } else if (!G.mission) {
    G.objective = { title: 'Palm Cove', text: "Waiting on Sol's call…", marker: null };
  }
}
