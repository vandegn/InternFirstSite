import cities from '@/data/us-cities.json';

// Builds the dotted U.S. map from the bundled city list, on the server. Every
// city is projected, snapped to a grid, and each occupied cell becomes one
// dot, so the silhouette of the country comes out of real data, not a traced
// outline. Cells holding a large city are marked "lit".
type CityRow = [string, string, number, number, number];

export type Dot = { x: number; y: number; st: string; lit: boolean };

const CELL = 0.5;
const LIT_POP = 250_000;

export function buildDots() {
  const cells = new Map<string, { st: string; pop: number; maxPop: number }>();

  for (const [, st, lat, lng, pop] of cities as CityRow[]) {
    if (st === 'AK' || st === 'HI' || st === 'PR') continue;
    if (lat < 24 || lat > 50 || lng < -125 || lng > -66) continue;
    // Sinusoidal-style projection centred on the middle of the country, so
    // the northern border curves the way people expect.
    const x = (lng + 96) * Math.cos((lat * Math.PI) / 180);
    const y = -lat;
    const key = `${Math.round(x / CELL)},${Math.round(y / CELL)}`;
    const cell = cells.get(key);
    if (!cell) {
      cells.set(key, { st, pop, maxPop: pop });
    } else {
      if (pop > cell.pop) { cell.st = st; cell.pop = pop; }
      cell.maxPop = Math.max(cell.maxPop, pop);
    }
  }

  const raw = [...cells.entries()].map(([key, c]) => {
    const [gx, gy] = key.split(',').map(Number);
    return { gx, gy, st: c.st, lit: c.maxPop >= LIT_POP };
  });
  const minX = Math.min(...raw.map((d) => d.gx));
  const minY = Math.min(...raw.map((d) => d.gy));
  const dots: Dot[] = raw.map((d) => ({ x: d.gx - minX, y: d.gy - minY, st: d.st, lit: d.lit }));
  const width = Math.max(...dots.map((d) => d.x)) + 1;
  const height = Math.max(...dots.map((d) => d.y)) + 1;
  return { dots, width, height };
}
