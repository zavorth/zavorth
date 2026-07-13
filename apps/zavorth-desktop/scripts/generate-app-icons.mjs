/**
 * Generate Zavorth Desktop app icon pack from the pixel mascot SVG.
 *
 * Outputs (under apps/zavorth-desktop/):
 *   build/app-icon.svg          — 1024 product mark (vector source)
 *   build/icon.png              — 1024×1024 master PNG
 *   build/icon.ico              — Windows multi-size ICO (16–256)
 *   build/icons/256x256.png     — Linux / tray helper
 *   build/icons/512x512.png     — Linux / tray helper
 *   public/icon.png             — runtime / Electron window icon
 *
 * Usage: npm run icons:generate
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const MASTER = 1024;
const PADDING_RATIO = 0.14; // ~14% pad around mascot
const BG = '#0a0f0c';
const ACCENT = '#00e88f';
const CORNER_RX = 200;
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const EXTRA_PNGS = [256, 512];

const paths = {
  mascot: join(root, 'public', 'zavorth-mascot.svg'),
  appIconSvg: join(root, 'build', 'app-icon.svg'),
  iconPng: join(root, 'build', 'icon.png'),
  iconIco: join(root, 'build', 'icon.ico'),
  iconsDir: join(root, 'build', 'icons'),
  publicIcon: join(root, 'public', 'icon.png'),
};

function fail(msg) {
  console.error(`icons:generate FAIL  ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`icons:generate OK    ${msg}`);
}

function fileSizeLabel(filePath) {
  if (!existsSync(filePath)) return 'missing';
  const n = statSync(filePath).size;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Build product-mark SVG: dark rounded square + accent border + scaled mascot rects.
 * Prefer brand-bright body gradient so the mark reads on near-black.
 */
function buildAppIconSvg() {
  if (!existsSync(paths.mascot)) {
    fail(`mascot SVG not found: ${paths.mascot}`);
  }

  const mascot = readFileSync(paths.mascot, 'utf8');
  const rectRe =
    /<rect\s+([^>]*?)\/?>/gi;
  const rects = [];
  let m;
  while ((m = rectRe.exec(mascot)) !== null) {
    const attrs = m[1];
    // Keep only mascot body/eye rects (skip none in current asset)
    if (!/x=/.test(attrs) || !/y=/.test(attrs)) continue;
    rects.push(attrs.trim());
  }

  if (rects.length < 8) {
    fail(`expected mascot body rects in ${paths.mascot}, found ${rects.length}`);
  }

  // Map original body gradient fills to app-icon body gradient id
  const mascotInner = rects
    .map((attrs) => {
      let a = attrs
        .replace(/fill="url\([^"]+\)"/g, 'fill="url(#bodyGreen)"')
        .replace(/fill='url\([^']+\)'/g, "fill='url(#bodyGreen)'");
      // Keep black eyes as-is
      return `    <rect ${a}/>`;
    })
    .join('\n');

  const pad = MASTER * PADDING_RATIO;
  const scale = (MASTER - pad * 2) / 512;
  const tx = pad;
  const ty = pad;
  const borderInset = 14;
  const borderRx = Math.max(8, CORNER_RX - borderInset * 0.7);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="${MASTER}"
  height="${MASTER}"
  viewBox="0 0 ${MASTER} ${MASTER}"
  xmlns="http://www.w3.org/2000/svg"
  shape-rendering="crispEdges"
>
  <!--
    Zavorth Desktop product mark (app icon).
    Generated from public/zavorth-mascot.svg — do not hand-edit raster outputs.
    npm run icons:generate
  -->
  <defs>
    <linearGradient id="bodyGreen" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="45%" stop-color="#2A5E2F"/>
      <stop offset="100%" stop-color="#3F7A42"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${MASTER}" height="${MASTER}" rx="${CORNER_RX}" ry="${CORNER_RX}" fill="${BG}"/>

  <rect
    x="${borderInset}"
    y="${borderInset}"
    width="${MASTER - borderInset * 2}"
    height="${MASTER - borderInset * 2}"
    rx="${borderRx}"
    ry="${borderRx}"
    fill="none"
    stroke="${ACCENT}"
    stroke-opacity="0.3"
    stroke-width="8"
  />

  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(6)})">
${mascotInner}
  </g>
</svg>
`;
}

async function loadResvg() {
  try {
    const mod = await import('@resvg/resvg-js');
    return mod.Resvg;
  } catch {
    fail(
      'missing @resvg/resvg-js — install with: npm install -D @resvg/resvg-js png-to-ico',
    );
  }
}

async function loadPngToIco() {
  try {
    const mod = await import('png-to-ico');
    return mod.default || mod;
  } catch {
    return null;
  }
}

function renderSvgToPng(Resvg, svgString, size) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

async function main() {
  mkdirSync(join(root, 'build'), { recursive: true });
  mkdirSync(paths.iconsDir, { recursive: true });

  const svg = buildAppIconSvg();
  writeFileSync(paths.appIconSvg, svg, 'utf8');
  ok(`wrote ${paths.appIconSvg}`);

  const Resvg = await loadResvg();
  const masterPng = renderSvgToPng(Resvg, svg, MASTER);
  writeFileSync(paths.iconPng, masterPng);
  ok(`wrote ${paths.iconPng} (${fileSizeLabel(paths.iconPng)})`);

  // Extra Linux sizes from full SVG (crisp scale)
  for (const size of EXTRA_PNGS) {
    const out = join(paths.iconsDir, `${size}x${size}.png`);
    writeFileSync(out, renderSvgToPng(Resvg, svg, size));
    ok(`wrote ${out} (${fileSizeLabel(out)})`);
  }

  // public/icon.png — keep runtime icon in sync with master
  copyFileSync(paths.iconPng, paths.publicIcon);
  ok(`synced ${paths.publicIcon}`);

  // ICO multi-resolution
  const pngToIco = await loadPngToIco();
  if (!pngToIco) {
    console.warn(
      'icons:generate WARN  png-to-ico not installed — skipping icon.ico (electron-builder can use PNG)',
    );
  } else {
    const icoBuffers = ICO_SIZES.map((size) => renderSvgToPng(Resvg, svg, size));
    const ico = await pngToIco(icoBuffers);
    writeFileSync(paths.iconIco, ico);
    ok(`wrote ${paths.iconIco} sizes=[${ICO_SIZES.join(',')}] (${fileSizeLabel(paths.iconIco)})`);
  }

  console.log('');
  console.log('Icon pack summary:');
  for (const p of [
    paths.appIconSvg,
    paths.iconPng,
    paths.iconIco,
    join(paths.iconsDir, '256x256.png'),
    join(paths.iconsDir, '512x512.png'),
    paths.publicIcon,
  ]) {
    const status = existsSync(p) ? fileSizeLabel(p) : 'MISSING';
    console.log(`  ${status.padStart(10)}  ${p}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
