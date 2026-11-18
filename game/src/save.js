// save.js — progress persistence in localStorage.
//
// The save holds only progression: cash, how far the mission chain has
// advanced, whether the story is finished and how many cars the player has
// fenced at Ferrer Auto Works. World state is never saved; Palm Cove is
// rebuilt fresh on every load and the missions re-stage their props.

import { G } from './state.js';

const SAVE_KEY = 'palmCoveHeat.save.v1';

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false; // storage can be unavailable (private mode, file://)
  }
}

export function saveProgress() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        money: G.money,
        missionIndex: G.missionIndex,
        storyDone: G.storyDone,
        delivered: G.delivered,
      }),
    );
  } catch {
    // A failed save must never break the game.
  }
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return false;
    G.money = data.money;
    G.missionIndex = data.missionIndex | 0;
    G.storyDone = !!data.storyDone;
    G.delivered = data.delivered | 0;
    return true;
  } catch {
    return false;
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe.
  }
}
