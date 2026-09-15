/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generates the SocialLens app icons without any native image dependency.
 * Draws a gradient "lens" ring with an ascending trend line (own brand mark).
 *
 *   node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets', 'images');

/* ---------------- PNG encoder ---------------- */
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- Drawing ---------------- */
const GRADIENT = [
  [0xf9, 0xce, 0x34],
  [0xee, 0x2a, 0x7b],
  [0x62, 0x28, 0xd7],
];

function gradientAt(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const pos = clamped * (GRADIENT.length - 1);
  const i = Math.min(GRADIENT.length - 2, Math.floor(pos));
  const f = pos - i;
  return GRADIENT[i].map((c, k) => Math.round(c + (GRADIENT[i + 1][k] - c) * f));
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Renders the mark into an RGBA buffer.
 * @param size output size
 * @param opts { background: [r,g,b] | null, scale: number (0..1 of size for the mark), mono: boolean }
 */
function render(size, opts) {
  const ss = 3; // supersampling
  const S = size * ss;
  const rgba = Buffer.alloc(size * size * 4);
  const cx = S / 2;
  const cy = S / 2;
  const R = (S / 2) * opts.scale;
  const ringW = R * 0.19;
  const innerR = R * 0.58;
  const innerW = R * 0.09;
  const lineW = R * 0.14;
  // trend polyline in unit space relative to R
  const pts = [
    [-0.44, 0.26],
    [-0.14, -0.04],
    [0.1, 0.14],
    [0.46, -0.3],
  ].map(([x, y]) => [cx + x * R, cy + y * R]);
  const arrow = [
    [0.26, -0.3],
    [0.46, -0.3],
    [0.46, -0.1],
  ].map(([x, y]) => [cx + x * R, cy + y * R]);
  // iOS masks its own corners, so the store icon stays a full square; only the favicon gets rounded corners.
  const cornerRadius = opts.rounded ? S * 0.22 : 0.0001;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x * ss + sx + 0.5;
          const py = y * ss + sy + 0.5;
          let color = null;
          let alpha = 0;
          // background (rounded square) when requested
          if (opts.background) {
            const qx = Math.max(Math.abs(px - cx) - (S / 2 - cornerRadius), 0);
            const qy = Math.max(Math.abs(py - cy) - (S / 2 - cornerRadius), 0);
            if (Math.hypot(qx, qy) <= cornerRadius) {
              color = opts.background;
              alpha = 1;
            }
          }
          const d = Math.hypot(px - cx, py - cy);
          const t = (px - cx + (py - cy)) / (2 * R) + 0.5; // diagonal gradient
          const mark = opts.mono ? [255, 255, 255] : gradientAt(t);
          if (Math.abs(d - R) <= ringW / 2) {
            color = mark;
            alpha = 1;
          } else if (Math.abs(d - innerR) <= innerW / 2) {
            color = opts.mono ? mark : mark.map((c) => Math.round(c * 0.55 + (opts.background ? opts.background[0] * 0.45 : 0)));
            alpha = opts.mono ? 1 : 1;
          }
          let onLine = false;
          for (let i = 0; i < pts.length - 1; i += 1) {
            if (distToSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= lineW / 2) onLine = true;
          }
          for (let i = 0; i < arrow.length - 1; i += 1) {
            if (distToSegment(px, py, arrow[i][0], arrow[i][1], arrow[i + 1][0], arrow[i + 1][1]) <= lineW / 2) onLine = true;
          }
          if (onLine) {
            color = opts.mono ? [255, 255, 255] : [255, 255, 255];
            alpha = 1;
          }
          if (color && alpha > 0) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 255;
          }
        }
      }
      const n = ss * ss;
      const idx = (y * size + x) * 4;
      const cov = a / n / 255;
      if (cov > 0) {
        rgba[idx] = Math.round(r / (a / 255));
        rgba[idx + 1] = Math.round(g / (a / 255));
        rgba[idx + 2] = Math.round(b / (a / 255));
        rgba[idx + 3] = Math.round(cov * 255);
      }
    }
  }
  return rgba;
}

function write(name, size, opts) {
  const png = encodePng(size, size, render(size, opts));
  fs.writeFileSync(path.join(OUT, name), png);
  console.log('wrote', name, `${size}x${size}`, `${(png.length / 1024).toFixed(1)}KB`);
}

fs.mkdirSync(OUT, { recursive: true });
write('icon.png', 1024, { background: [0, 0, 0], scale: 0.62 });
write('splash-icon.png', 512, { background: null, scale: 0.78 });
write('android-icon-foreground.png', 1024, { background: null, scale: 0.44 });
write('android-icon-monochrome.png', 1024, { background: null, scale: 0.44, mono: true });
write('favicon.png', 96, { background: [0, 0, 0], scale: 0.62, rounded: true });
// Solid background layer for the adaptive icon
const bg = Buffer.alloc(1024 * 1024 * 4);
for (let i = 0; i < 1024 * 1024; i += 1) {
  bg[i * 4 + 3] = 255;
}
fs.writeFileSync(path.join(OUT, 'android-icon-background.png'), encodePng(1024, 1024, bg));
console.log('wrote android-icon-background.png');
