# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dashaaa12/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dashaaa12/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**PALM COVE HEAT** — an original top-down 2D open-world crime game in vanilla JavaScript and canvas. No libraries, no build step, no network: every file lives under `game/`.

Welcome to **Palm Cove**, a sun-soaked coastal city of pastel towers, palm-lined avenues and one long beach. You are **Danny Solano**, a small-time wheelman with rent due. Fixer **Marisol "Sol" Ferrer** of Ferrer Auto Works has work — the kind that pays cash and attracts sirens.

**The story** is a chain of three missions, introduced by Sol's phone messages:

1. **First Wheels** — steal the turquoise Comet GT idling at the Beach Lot and deliver it to Ferrer Auto Works.
2. **Hot Package** — collect a package at Marina del Sur and run it to the Hotel Azure against the clock, with the heat already on you.
3. **Loud Exit** — lift the crew van outside the Gilded Palm casino, shake a three-star response, and park it at the Palms park hideout.

After the story, Palm Cove stays open: any car you fence at Sol's garage pays out by model and condition.

**The city, alive:** traffic AI drives the grid in the correct lanes and flees crashes; pedestrians stroll the sidewalks, cross at the crosswalks and dive out of the way; a five-star **wanted system** answers theft, collisions and gunfire with interceptor cars and on-foot officers who chase, shoot (at three stars and up) and fill your bust meter if they corner you. Break line of sight and the heat cools. Get caught and you wake up outside Palm Cove PD, lighter in the wallet; get wasted and it's the hospital. Progress — cash, story progress, cars fenced — is saved in `localStorage`, with a continue option on the title screen.

**Features:** on-foot and driving play with real acceleration, braking and collision physics; mouse-aimed shooting; a full HUD with health, cash, wanted stars, objective card, speedometer and a live minimap (streets, police, objective markers); title, pause, BUSTED and WASTED screens; procedural WebAudio engine hum, sirens, gunshots and jingles — no audio files; skid marks, sparks, smoke and a pastel day-bright palette with soft shadows.

**Controls:** WASD/arrows move and drive · **F** or **Enter** enter/exit cars · mouse aims, click shoots · **Shift** sprint · **Space** handbrake · **P**/**Esc** pause · **M** mute.

## Run it

```sh
# Produce the hand-in output (copies game/ + screenshots/ into the output
# directory and writes dossier.json there):
MAKEFUN_OUTPUT_DIR=/output node main.ts     # Node 22+; or plain `node main.ts` for /output

# Play the game: serve the game folder with any static server, e.g.
python3 -m http.server 8000 --directory game
# then open http://localhost:8000 in a desktop browser.
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=y1enas6g&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
