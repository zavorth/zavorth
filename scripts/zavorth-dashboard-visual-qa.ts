import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ZavorthControlVisualQaService } from '../src/services/ZavorthControlVisualQaService.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const capture = args.includes('--capture');
const requireEvidence = args.includes('--require-evidence');
const rootDir = path.resolve(process.cwd());
const outDir = path.resolve(rootDir, '.tmp', 'zavorth-control-visual-qa');
const previewDir = path.resolve(rootDir, '.tmp', 'zavorthControl-browser-preview');
const previewHtml = path.resolve(previewDir, 'index.html');

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  if (capture) {
    await captureScreenshots();
  }

  const service = new ZavorthControlVisualQaService();
  const snapshot = service.buildSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderReport(snapshot)}\n`);
  }

  if (requireEvidence && !snapshot.summary.evidenceReady) {
    process.stderr.write('Zavorth zavorthControl visual QA evidence is not complete.\n');
    process.exitCode = 1;
  }
}

async function captureScreenshots(): Promise<void> {
  ensurePreviewHtml();
  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const captures = [
      { id: 'desktop', width: 1440, height: 1000, file: path.join(outDir, 'desktop.png'), query: '' },
      { id: 'mobile', width: 390, height: 844, file: path.join(outDir, 'mobile.png'), query: '' },
      { id: 'auto-subagents', width: 1440, height: 1800, file: path.join(outDir, 'auto-subagents.png'), query: '?fixture=auto-subagents' },
    ];
    for (const captureTarget of captures) {
      const page = await browser.newPage({
        viewport: { width: captureTarget.width, height: captureTarget.height },
      });
      await page.goto(`${pathToFileURL(previewHtml).href}${captureTarget.query}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: captureTarget.file, fullPage: true });
      await page.close();
    }
    const manifest = {
      generatedAt: new Date().toISOString(),
      previewHtml: path.relative(rootDir, previewHtml).replace(/\\/g, '/'),
      captures: captures.map((captureTarget) => ({
        id: captureTarget.id,
        width: captureTarget.width,
        height: captureTarget.height,
        path: path.relative(rootDir, captureTarget.file).replace(/\\/g, '/'),
      })),
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

function ensurePreviewHtml(): void {
  const result = spawnSync(
    process.execPath,
    [
      './node_modules/tsx/dist/cli.mjs',
      'scripts/zavorthControl-browser-preview.ts',
      '--fixture=all',
      '--out=.tmp/zavorthControl-browser-preview',
    ],
    {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    },
  );
  if (result.status !== 0 || !fs.existsSync(previewHtml)) {
    throw new Error('Could not generate .tmp/zavorthControl-browser-preview/index.html.');
  }
}
