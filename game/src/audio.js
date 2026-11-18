// audio.js — every sound in Palm Cove Heat is synthesized with WebAudio.
//
// There are no audio files: the engine is a detuned sawtooth through a
// lowpass filter whose pitch follows the car's speed, the siren is a
// two-tone square wave, gunshots and crashes are shaped noise bursts, and
// the little jingles (phone, pickup, mission complete) are sine arpeggios.
// The context is created lazily on the first user gesture, as browsers
// require, and every entry point is a no-op until then.

let ctx = null;
let master = null;
let engineOsc = null;
let engineFilter = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenLfo = null;
let muted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.42;
  master.connect(ctx.destination);

  // Engine: always running once created, gain steers its audibility.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const engineSub = ctx.createOscillator();
  engineSub.type = 'square';
  engineSub.frequency.value = 28;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.5;
  engineOsc.connect(engineFilter);
  engineSub.connect(subGain);
  subGain.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  engineSub.start();

  // Siren: a square wave whose frequency an LFO flips between two tones.
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 700;
  sirenLfo = ctx.createOscillator();
  sirenLfo.type = 'square';
  sirenLfo.frequency.value = 0.85;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 160;
  sirenLfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain);
  sirenGain.connect(master);
  sirenOsc.start();
  sirenLfo.start();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.42;
  return muted;
}

export function isMuted() {
  return muted;
}

/** speedNorm is 0..1 of the car's top speed; off when the player walks. */
export function setEngine(speedNorm, driving) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const target = driving ? 0.05 + speedNorm * 0.05 : 0;
  engineGain.gain.setTargetAtTime(target, t, 0.09);
  engineOsc.frequency.setTargetAtTime(52 + speedNorm * 165, t, 0.06);
  engineFilter.frequency.setTargetAtTime(280 + speedNorm * 900, t, 0.08);
}

/** closeness is 0..1: how near the nearest police unit is. */
export function setSiren(closeness) {
  if (!ctx) return;
  const target = closeness > 0.03 ? 0.012 + closeness * 0.05 : 0;
  sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
}

function noiseBurst(duration, filterFreq, gainValue, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const length = Math.max(1, (duration * ctx.sampleRate) | 0);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
}

function tone(freq, duration, gainValue, type = 'sine', when = 0, slideTo = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainValue, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export function playShot() {
  noiseBurst(0.13, 2600, 0.5, 'highpass');
  tone(150, 0.09, 0.35, 'square', 0, 55);
}

export function playCrash(strength) {
  noiseBurst(0.22, 500, Math.min(0.6, 0.2 + strength * 0.5));
  tone(90, 0.18, 0.3, 'sine', 0, 40);
}

export function playPhoneBlip() {
  tone(1175, 0.09, 0.16, 'sine');
  tone(1568, 0.12, 0.16, 'sine', 0.11);
}

export function playPickup() {
  tone(880, 0.1, 0.2, 'sine');
  tone(1318, 0.16, 0.2, 'sine', 0.08);
}

export function playMissionComplete() {
  tone(659, 0.12, 0.2, 'triangle');
  tone(880, 0.12, 0.2, 'triangle', 0.11);
  tone(1109, 0.22, 0.22, 'triangle', 0.22);
}

export function playBusted() {
  tone(392, 0.2, 0.25, 'square');
  tone(311, 0.2, 0.25, 'square', 0.18);
  tone(233, 0.42, 0.25, 'square', 0.36);
}

export function playCash() {
  tone(1568, 0.07, 0.14, 'square');
  tone(2093, 0.12, 0.14, 'square', 0.06);
}
