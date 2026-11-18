// input.js — keyboard and mouse state, polled by the game loop.
//
// The loop asks questions like "is W held?" and "where is the mouse in
// world space?" instead of reacting to events directly, which keeps the
// controls identical whether a human or the screenshot driver is playing.

export const keys = new Set();
/** Codes pressed since the last frame, even if already released again:
 *  a fast tap must still count as a press. Cleared by endFrameInput(). */
export const pressed = new Set();
export const mouse = {
  x: 0, // screen pixels
  y: 0,
  down: false,
  clicked: false, // true for exactly one frame after a press
};

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function installInput(canvas) {
  addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function held(...codes) {
  return codes.some((c) => keys.has(c));
}

/** Called at the end of every frame so one press reads as one click. */
export function endFrameInput() {
  mouse.clicked = false;
  pressed.clear();
}
