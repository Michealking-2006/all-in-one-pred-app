// The maths behind dragging a bottom drawer down to dismiss it. Pure (no DOM), so it is unit-tested.

// How far the drawer follows the finger. Pulling down follows 1:1; pulling up past the top meets
// resistance (rubber band) so it feels attached but never leaves the screen.
export function dragOffset(dy) {
  return dy >= 0 ? dy : -Math.sqrt(-dy) * 2.2;
}

// Backdrop fades as the drawer goes down: fully visible at rest, gone when it is off the bottom.
export function backdropOpacity(dy, height) {
  if (!(height > 0) || dy <= 0) return 1;
  return Math.max(0, 1 - dy / height);
}

// Close if it was dragged past a third of its height, or flicked down quickly (px per ms).
// A slow drag that stays short springs back; an upward flick never closes.
export function shouldDismiss({ dy, height, velocity }) {
  if (!(height > 0)) return dy > 120;
  if (velocity < -0.2) return false;
  return dy > height * 0.33 || (velocity > 0.55 && dy > 24);
}

// Velocity over the last ~100 ms of the gesture, in px per ms (positive = downwards).
export function makeVelocityTracker() {
  const samples = [];
  return {
    add(y, t = performance.now()) {
      samples.push({ y, t });
      while (samples.length > 2 && t - samples[0].t > 100) samples.shift();
    },
    velocity() {
      if (samples.length < 2) return 0;
      const a = samples[0], b = samples[samples.length - 1];
      return b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    },
    reset() { samples.length = 0; },
  };
}
