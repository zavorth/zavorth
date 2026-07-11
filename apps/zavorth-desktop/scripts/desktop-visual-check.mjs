/**
 * Visual regression gate for Zavorth Desktop (Playwright + Electron).
 *
 * Usage:
 *   npm run check:visual
 *   npm run check:visual -- --update
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {
  launchDesktopHarness,
  openSidebarPanel,
  captureScreenshot,
  stabilizePage,
} from './lib/desktop-e2e-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactsDir = join(root, 'tests', 'visual', 'artifacts');
const baselinesDir = join(root, 'tests', 'visual', 'baselines');
const update = process.argv.includes('--update') || process.env.ZAVORTH_VISUAL_UPDATE === '1';
const maxDiffRatio = Number(process.env.ZAVORTH_VISUAL_MAX_DIFF || '0.02');

mkdirSync(artifactsDir, { recursive: true });
mkdirSync(baselinesDir, { recursive: true });

/** Ensure a composer status stack is visible for busy visual capture. */
async function ensureComposerBusySurface(page) {
  await page.evaluate(() => {
    const app = document.querySelector('.zvd-app');
    if (app) app.classList.add('is-agent-busy');

    let stack = document.querySelector('.zvd-composer-status-stack');
    if (stack) return;

    const host =
      document.querySelector('.zvd-composer-shell') ||
      document.querySelector('.zvd-command-bar') ||
      document.querySelector('.zvd-thread') ||
      document.querySelector('.zvd-app');
    if (!host) return;

    stack = document.createElement('div');
    stack.className = 'zvd-composer-status-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    stack.setAttribute('aria-label', 'Thinking');
    stack.innerHTML = [
      '<div class="zvd-composer-status-stack__steps">',
      '  <span class="zvd-composer-status-stack__step is-active" data-phase="thinking">Thinking</span>',
      '  <span class="zvd-composer-status-stack__step" data-phase="tools">Tools</span>',
      '  <span class="zvd-composer-status-stack__step" data-phase="writing">Writing</span>',
      '</div>',
      '<div class="zvd-composer-status-stack__copy">',
      '  <strong>Thinking</strong>',
      '  <span>Working on your request\u2026</span>',
      '</div>',
    ].join('');

    if (host.classList?.contains('zvd-composer-shell')) {
      host.prepend(stack);
    } else {
      host.appendChild(stack);
    }
  });
}

/** Ensure at least one approval card is present on the review surface. */
async function ensureApprovalCardSurface(page) {
  await page.evaluate(() => {
    if (document.querySelector('.zvd-approval-card')) return;

    const host =
      document.querySelector('.zvd-review-tabs')?.parentElement ||
      document.querySelector('[data-panel="approvals"]') ||
      document.querySelector('.zvd-main') ||
      document.querySelector('.zvd-app');
    if (!host) return;

    const list = document.createElement('div');
    list.className = 'zvd-approval-list';
    list.setAttribute('role', 'list');
    list.innerHTML = [
      '<article class="zvd-approval-card" role="listitem">',
      '  <div class="zvd-approval-card__main">',
      '    <div class="zvd-approval-card__title-row">',
      '      <strong>Allow write to README.md</strong>',
      '      <span class="zvd-badge">Medium risk</span>',
      '    </div>',
      '    <p class="zvd-approval-card__action">workspace.write</p>',
      '    <div class="zvd-approval-card__meta"><span>pending</span></div>',
      '  </div>',
      '  <div class="zvd-approval-card__actions zvd-row-actions">',
      '    <button type="button" class="zvd-btn zvd-btn-default zvd-btn-sm">Approve</button>',
      '    <button type="button" class="zvd-btn zvd-btn-secondary zvd-btn-sm">Reject</button>',
      '  </div>',
      '</article>',
    ].join('');
    host.appendChild(list);
  });
}

/** Force compact density on shell root for layout regression. */
async function applyDensityCompact(page) {
  await page.evaluate(() => {
    const app = document.querySelector('.zvd-app');
    if (app) {
      app.classList.remove('density-comfortable');
      app.classList.add('density-compact');
    }
    document.documentElement.dataset.density = 'compact';
    document.documentElement.classList.add('density-compact');
  });
}

async function dismissOnboarding(page) {
  const skip = page.locator('.zvd-onboarding-overlay button', { hasText: /Pular|Skip/i }).first();
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click({ force: true });
    await page.waitForSelector('.zvd-onboarding-overlay', { state: 'detached', timeout: 5000 });
  }
}

const SCENES = [
  {
    id: 'onboarding-providers',
    prepare: async (page) => {
      await page.waitForSelector('.zvd-onboarding-overlay .zvd-onboarding-providers-grid', { timeout: 8000 });
    },
    assert: async (page) => {
      const providers = await page.locator('.zvd-onboarding-provider-card').count();
      if (providers < 10) throw new Error(`Expected broad provider catalog, found ${providers}`);
    },
  },
  {
    id: 'shell-chat',
    prepare: async (page) => {
      await dismissOnboarding(page);
      await openSidebarPanel(page, 'chat');
    },
    assert: async (page) => {
      await page.waitForSelector('.zvd-app', { timeout: 10000 });
    },
  },
  {
    id: 'chat-empty',
    prepare: async (page) => {
      await openSidebarPanel(page, 'chat');
      await page.waitForTimeout(250);
    },
    assert: async (page) => {
      const ok = await page.locator('.zvd-thread, .zvd-empty-thread, .zvd-composer-shell, .zvd-app').first().count();
      if (!ok) throw new Error('Chat surface not found');
    },
  },
  {
    id: 'composer-busy',
    prepare: async (page) => {
      await openSidebarPanel(page, 'chat');
      await page.waitForTimeout(200);
      await ensureComposerBusySurface(page);
      await page.waitForTimeout(150);
    },
    assert: async (page) => {
      const ok = await page.locator('.zvd-composer-status-stack, .zvd-composer-shell, .zvd-app').first().count();
      if (!ok) throw new Error('Composer busy surface not found');
    },
  },
  {
    id: 'review-hub',
    prepare: async (page) => {
      const opened = await openSidebarPanel(page, 'approvals');
      if (!opened) throw new Error('Could not open Review (approvals)');
      await page.waitForTimeout(350);
    },
    assert: async (page) => {
      await page.waitForSelector(
        '.zvd-review-tabs, [data-panel="approvals"].is-active, .zvd-app',
        { timeout: 8000 },
      );
    },
  },
  {
    id: 'approval-card',
    prepare: async (page) => {
      const opened = await openSidebarPanel(page, 'approvals');
      if (!opened) throw new Error('Could not open Review for approval-card');
      await page.waitForTimeout(300);
      await ensureApprovalCardSurface(page);
      await page.waitForTimeout(100);
    },
    assert: async (page) => {
      const ok = await page.locator('.zvd-approval-card, .zvd-review-tabs, .zvd-app').first().count();
      if (!ok) throw new Error('Approval card surface not found');
    },
  },
  {
    id: 'proof-timeline',
    prepare: async (page) => {
      const opened = await openSidebarPanel(page, 'receipts');
      if (!opened) throw new Error('Could not open Proof (receipts)');
      await page.waitForTimeout(350);
    },
    assert: async (page) => {
      await page.waitForSelector(
        '.zvd-proof-timeline, [data-panel="receipts"].is-active, .zvd-app',
        { timeout: 8000 },
      );
    },
  },
  ...[
    ['workboard', '.zvd-workboard-container, .zvd-kanban-board'],
    ['marketplace', '.zvd-capability-layout'],
    ['skills', '.zvd-capability-layout'],
    ['agents', '.zvd-agents-container'],
    ['profiles', '.zvd-profiles-container'],
    ['automations', '.zvd-automation-layout'],
    ['analytics', '.zvd-usage-analytics, .zvd-ua-stats-grid'],
  ].map(([panel, selector]) => ({
    id: `panel-${panel}`,
    prepare: async (page) => {
      const opened = await openSidebarPanel(page, panel);
      if (!opened) throw new Error(`Could not open ${panel}`);
      await page.waitForTimeout(500);
    },
    assert: async (page) => {
      await page.waitForSelector(`${selector}, .zvd-app`, { timeout: 8000 });
    },
  })),
  {
    id: 'settings',
    prepare: async (page) => {
      const opened = await openSidebarPanel(page, 'settings');
      if (!opened) throw new Error('Could not open Settings');
      await page.waitForTimeout(400);
    },
    assert: async (page) => {
      await page.waitForSelector(
        '.zvd-settings-section, .zvd-settings-overlay, [data-panel="settings"].is-active, .zvd-app',
        { timeout: 8000 },
      );
    },
  },
  {
    id: 'density-compact',
    prepare: async (page) => {
      await openSidebarPanel(page, 'chat');
      await page.waitForTimeout(200);
      await applyDensityCompact(page);
      await page.waitForTimeout(150);
    },
    assert: async (page) => {
      const ok = await page.evaluate(() => {
        const app = document.querySelector('.zvd-app');
        return Boolean(
          app?.classList.contains('density-compact') ||
            document.documentElement.dataset.density === 'compact',
        );
      });
      if (!ok) throw new Error('density-compact class/dataset not applied');
      await page.waitForSelector('.zvd-app', { timeout: 5000 });
    },
  },
  {
    id: 'code-bridge-checks',
    prepare: async (page) => {
      await page.locator('.zvd-code-bridge-status').first().click({ force: true });
      await page.waitForTimeout(250);
    },
    assert: async (page) => {
      await page.waitForSelector('.zvd-code-bridge-panel__frame', { timeout: 5000 });
    },
  },
  {
    id: 'terminal-rail',
    prepare: async (page) => {
      const closeCodeBridge = page.locator('.zvd-code-bridge-panel__close').first();
      if (await closeCodeBridge.isVisible().catch(() => false)) await closeCodeBridge.click({ force: true });
      const terminalToggle = page.locator('.zvd-statusbar [aria-label="Toggle terminal"]').first();
      await terminalToggle.click({ force: true });
      await page.waitForTimeout(500);
    },
    assert: async (page) => {
      await page.waitForSelector('.zvd-right-rail .zvd-terminal-tabs-panel', { timeout: 8000 });
      const floatingTerminal = await page.locator('.zvd-terminal-panel').count();
      if (floatingTerminal) throw new Error('Legacy floating terminal is still mounted');
      const geometry = await page.evaluate(() => ({
        scrollX: window.scrollX,
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        railRight: Math.round(document.querySelector('.zvd-right-rail')?.getBoundingClientRect().right || 0),
      }));
      if (geometry.scrollX !== 0 || geometry.documentWidth > geometry.viewport + 2 || geometry.railRight > geometry.viewport + 2) {
        throw new Error(`Terminal escaped rail bounds: ${JSON.stringify(geometry)}`);
      }
    },
  },
];

function comparePng(actualPath, baselinePath, diffPath) {
  const actual = PNG.sync.read(readFileSync(actualPath));
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return {
      ok: false,
      reason: `size mismatch actual=${actual.width}x${actual.height} baseline=${baseline.width}x${baseline.height}`,
      ratio: 1,
    };
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  const mismatched = pixelmatch(
    actual.data,
    baseline.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.15 },
  );
  writeFileSync(diffPath, PNG.sync.write(diff));
  const ratio = mismatched / (actual.width * actual.height);
  return { ok: ratio <= maxDiffRatio, reason: `${mismatched} pixels (${(ratio * 100).toFixed(3)}%)`, ratio };
}

const harness = await launchDesktopHarness({ timeoutMs: 25000, dismissOnboarding: false });
const results = [];

try {
  const { window: page, app } = harness;
  await stabilizePage(page);
  await page.waitForTimeout(400);

  for (const scene of SCENES) {
    const artifactPath = join(artifactsDir, `${scene.id}.png`);
    const baselinePath = join(baselinesDir, `${scene.id}.png`);
    const diffPath = join(artifactsDir, `${scene.id}.diff.png`);

    try {
      await scene.prepare(page);
      await scene.assert(page);
      await captureScreenshot(page, artifactPath, app);

      if (update) {
        writeFileSync(baselinePath, readFileSync(artifactPath));
        results.push({ id: scene.id, status: 'baseline-updated', path: baselinePath });
        console.log(`OK    ${scene.id} baseline updated`);
        continue;
      }

      if (!existsSync(baselinePath)) {
        writeFileSync(baselinePath, readFileSync(artifactPath));
        results.push({ id: scene.id, status: 'baseline-seeded', path: baselinePath });
        console.log(`OK    ${scene.id} baseline seeded (first run)`);
        continue;
      }

      const cmp = comparePng(artifactPath, baselinePath, diffPath);
      if (!cmp.ok) {
        results.push({ id: scene.id, status: 'fail', detail: cmp.reason });
        console.error(`FAIL  ${scene.id}: ${cmp.reason}`);
        process.exitCode = 1;
      } else {
        results.push({ id: scene.id, status: 'pass', detail: cmp.reason });
        console.log(`OK    ${scene.id} (${cmp.reason})`);
      }
    } catch (error) {
      results.push({ id: scene.id, status: 'error', detail: error.message });
      console.error(`FAIL  ${scene.id}: ${error.message}`);
      process.exitCode = 1;
    }
  }
} finally {
  await harness.close();
}

const summary = {
  status: process.exitCode ? 'fail' : 'pass',
  maxDiffRatio,
  update,
  baselines: existsSync(baselinesDir) ? readdirSync(baselinesDir).filter((f) => f.endsWith('.png')) : [],
  results,
};
writeFileSync(join(artifactsDir, 'visual-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

if (process.exitCode) {
  console.error('\nDesktop visual check failed. Re-baseline with: npm run check:visual -- --update');
  process.exit(1);
}

console.log('\nDesktop visual check passed.');
