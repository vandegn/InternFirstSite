// Regenerates public/internfirst-logo-dark.png from public/internfirst-logo.png.
//
//   node scripts/make-dark-logo.mjs
//
// A per-pixel recolor, not a filter: navy (cap + "ntern") becomes warm cream,
// the brand green (arrow, tassel) is left exactly as it is, and the grey
// "First" shifts to a warm stone grey while keeping its tonal gradient. Alpha
// is copied untouched, so geometry and every antialiased edge are identical
// to the light logo. Pixels on internal navy/green seams are blended by how
// navy they are, so those seams stay smooth.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SRC = path.join(root, 'internfirst-logo.png');
const OUT = path.join(root, 'internfirst-logo-dark.png');

const NAVY = [26, 44, 73];
const CREAM = [243, 235, 221]; // #F3EBDD
const GREY_SRC = [145, 147, 148]; // mean of "First"
const GREY_DST = [178, 169, 156]; // #B2A99C

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

for (let i = 0; i < data.length; i += 4) {
  const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
  if (a === 0) continue;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const mean = (r + g + b) / 3;
  let d;
  if (spread < 25 && mean > 90) {
    d = GREY_DST.map((v, k) => v - GREY_SRC[k]);
  } else {
    // navy has b-g of about +29, the brand green about -159
    let wn = Math.max(0, Math.min(1, (b - g + 60) / 89));
    if (wn >= 0.8) wn = 1; // solid navy: snap so source noise isn't amplified
    d = CREAM.map((v, k) => wn * (v - NAVY[k]));
  }
  data[i] = clamp(r + d[0]);
  data[i + 1] = clamp(g + d[1]);
  data[i + 2] = clamp(b + d[2]);
}

await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(OUT);
console.log(`wrote ${OUT} (${info.width}x${info.height})`);
