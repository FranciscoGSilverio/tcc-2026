// Protocol section 4.5 requires the collection order to be shuffled, so
// that temporal variation in the service does not line up with one cell.
// A shuffle nobody can reproduce is not auditable, though: the driver
// prints a seed, and anyone can pass it back to rebuild the exact order
// the collection ran in. Math.random cannot do that, so this is a small
// explicit generator instead.
import { randomBytes } from 'node:crypto';

export const randomSeed = () => randomBytes(4).toString('hex');

// FNV-1a over the seed text, so any string works as a seed.
function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: small, well known, and far more than enough to order
// fifty items. Nothing statistical rests on it -- it only has to be
// deterministic given the seed and not obviously patterned.
function generator(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(items, seed) {
  const next = generator(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}
