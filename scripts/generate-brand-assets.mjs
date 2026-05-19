import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const outDir = path.join(root, 'assets', 'brand');
const logoPath = path.join(root, 'assets', 'command-center', 'assets', 'fox-semfundo.png');

fs.mkdirSync(outDir, { recursive: true });

function dataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function html({ kind }) {
  const logo = dataUrl(logoPath);
  const isSocial = kind === 'social';
  const width = isSocial ? 1280 : 1600;
  const height = isSocial ? 640 : 560;
  const titleSize = isSocial ? 78 : 70;
  const subtitleSize = isSocial ? 28 : 26;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #07110f; font-family: Inter, "Segoe UI", Arial, sans-serif; }
  .frame {
    width: ${width}px;
    height: ${height}px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 12% 20%, rgba(22, 163, 127, 0.28), transparent 30%),
      radial-gradient(circle at 74% 22%, rgba(73, 222, 178, 0.18), transparent 32%),
      linear-gradient(135deg, #06100e 0%, #0b1714 52%, #10251f 100%);
    color: #f8fffc;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(170, 231, 213, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(170, 231, 213, 0.08) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: linear-gradient(to right, rgba(0,0,0,0.55), transparent 82%);
  }
  .copy {
    position: absolute;
    left: ${isSocial ? 76 : 86}px;
    top: ${isSocial ? 66 : 50}px;
    width: ${isSocial ? 560 : 650}px;
    z-index: 2;
  }
  .brand { display: flex; align-items: center; gap: 18px; margin-bottom: ${isSocial ? 48 : 38}px; }
  .mark { width: 74px; height: 74px; border-radius: 20px; background: #dff5ee; padding: 10px; box-shadow: 0 18px 60px rgba(45, 212, 169, .22); }
  .mark img { width: 100%; height: 100%; object-fit: contain; }
  .name { font-size: 30px; font-weight: 850; letter-spacing: 0; }
  .eyebrow { color: #73d8be; font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 18px; }
  h1 { margin: 0; font-size: ${titleSize}px; line-height: .94; letter-spacing: 0; max-width: 700px; }
  p { margin: 24px 0 0; color: #c5ddd4; font-size: ${subtitleSize}px; line-height: 1.32; max-width: ${isSocial ? 540 : 650}px; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
  .chip { border: 1px solid rgba(148, 221, 201, .26); background: rgba(11, 38, 31, .68); border-radius: 999px; padding: 11px 16px; font-size: 17px; font-weight: 700; color: #dff8f0; }
  .shotWrap {
    position: absolute;
    right: ${isSocial ? -110 : 80}px;
    top: ${isSocial ? 70 : 74}px;
    width: ${isSocial ? 680 : 690}px;
    height: ${isSocial ? 440 : 410}px;
    border-radius: 34px;
    padding: 14px;
    background: linear-gradient(145deg, rgba(223,245,238,.28), rgba(26,94,77,.1));
    box-shadow: 0 34px 100px rgba(0,0,0,.48);
    transform: perspective(1200px) rotateY(${isSocial ? '-10deg' : '-8deg'}) rotateX(2deg);
    z-index: 1;
  }
  .mock {
    width: 100%;
    height: 100%;
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,.18);
    background: #f6faf7;
    color: #10201c;
    padding: 22px;
    overflow: hidden;
    font-family: Inter, "Segoe UI", Arial, sans-serif;
  }
  .mockTop { display:flex; justify-content:space-between; align-items:center; height:34px; padding:0 10px 10px; border-bottom:1px solid #d8e4df; color:#567168; font-size:13px; }
  .mockTitle { margin: 22px 8px 8px; color:#07110f; font-size:28px; line-height:1.05; font-weight:850; letter-spacing:0; }
  .mockText { margin: 0 8px 18px; color:#49645b; font-size:14px; line-height:1.45; max-width:560px; }
  .cards { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin: 0 8px 18px; }
  .card { min-height:68px; border:1px solid #b8dcd1; background:#e1f4ee; border-radius:14px; padding:13px; }
  .label { color:#47655c; font-size:12px; margin-bottom:8px; }
  .value { color:#07110f; font-size:16px; font-weight:800; }
  .actions { display:flex; gap:10px; margin: 0 8px 18px; }
  .primary { background:#08745e; color:white; border-radius:999px; padding:12px 18px; font-weight:800; font-size:13px; }
  .secondary { border:1px solid #d3ded9; color:#14231f; border-radius:999px; padding:12px 18px; font-weight:700; font-size:13px; }
  .panel { margin: 0 8px; border:1px solid #d7e2dd; border-radius:18px; padding:16px; background:white; }
  .panelHead { color:#08745e; text-transform:uppercase; letter-spacing:1.4px; font-size:11px; font-weight:900; margin-bottom:12px; }
  .rows { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .row { border:1px solid #e3ece8; border-radius:12px; padding:12px; color:#425c53; font-size:12px; }
  .row strong { display:block; color:#0e1e19; font-size:14px; margin-bottom:5px; }
  }
  .glow { position: absolute; right: 70px; bottom: -90px; width: 420px; height: 220px; background: rgba(45,212,169,.18); filter: blur(60px); }
</style>
</head>
<body>
  <div class="frame">
    <div class="grid"></div>
    <div class="glow"></div>
    <div class="copy">
      <div class="brand">
        <div class="mark"><img src="${logo}" /></div>
        <div>
          <div class="name">Zavorth</div>
          <div style="color:#7fa99d;font-size:16px;font-weight:650;margin-top:4px;">Governed Agent Runtime</div>
        </div>
      </div>
      <div class="eyebrow">Local-first agent OS</div>
      <h1>Ask naturally. Execute safely.</h1>
      <p>Command Center, approvals, subagents, skills, channels and receipts for daily AI work you can actually trust.</p>
      <div class="chips">
        <div class="chip">Policy Broker</div>
        <div class="chip">Approvals</div>
        <div class="chip">Subagents</div>
        <div class="chip">Channel Mesh</div>
      </div>
    </div>
    <div class="shotWrap">
      <div class="mock">
        <div class="mockTop"><strong>Command Center</strong><span>/control</span></div>
        <div class="mockTitle">Runtime, terminal and API live here.</div>
        <div class="mockText">One governed surface for requests, status, approvals, sessions, artifacts and channel readiness.</div>
        <div class="cards">
          <div class="card"><div class="label">Runtime</div><div class="value">Ready</div></div>
          <div class="card"><div class="label">Approvals</div><div class="value">Clean</div></div>
          <div class="card"><div class="label">Channels</div><div class="value">Mapped</div></div>
          <div class="card"><div class="label">Policy</div><div class="value">Active</div></div>
        </div>
        <div class="actions"><div class="primary">Open Command Center</div><div class="secondary">Run doctor</div></div>
        <div class="panel">
          <div class="panelHead">Operational trace</div>
          <div class="rows">
            <div class="row"><strong>Ask naturally</strong>Route intent into governed runtime.</div>
            <div class="row"><strong>Execute safely</strong>Require policy for sensitive work.</div>
            <div class="row"><strong>Use subagents</strong>Delegate with budgets and receipts.</div>
            <div class="row"><strong>Keep evidence</strong>Store approvals, artifacts and outcomes.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function render(name, kind) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: kind === 'social' ? { width: 1280, height: 640 } : { width: 1600, height: 560 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html({ kind }), { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  await browser.close();
}

await render('zavorth-readme-banner.png', 'banner');
await render('zavorth-social-preview.png', 'social');

console.log(`Generated brand assets in ${outDir}`);
