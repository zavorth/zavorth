/**
 * axe-core accessibility scan on Zavorth Desktop (Electron + Playwright).
 *
 * Uses in-page axe injection (Electron does not support AxeBuilder.newPage).
 *
 * Usage:
 *   npm run check:a11y
 *   ZAVORTH_A11Y_INCLUDE_MODERATE=1 npm run check:a11y
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  launchDesktopHarness,
  openSidebarPanel,
  stabilizePage,
} from './lib/desktop-e2e-harness.mjs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'a11y', 'artifacts');
const distDir = join(root, 'dist');
mkdirSync(outDir, { recursive: true });

const failOnModerate = process.env.ZAVORTH_A11Y_INCLUDE_MODERATE === '1';

const axePathCandidates = [
  resolve(root, 'node_modules', 'axe-core', 'axe.min.js'),
  resolve(dirname(require.resolve('axe-core/package.json')), 'axe.min.js'),
];
const axeSourcePath = axePathCandidates.find((p) => existsSync(p));
if (!axeSourcePath) {
  console.error('FAIL  axe-core not found. Run: npm install --save-dev axe-core');
  process.exit(1);
}

// CSP is script-src 'self' — serve axe from the same origin as the renderer (dist/).
if (!existsSync(distDir)) {
  console.error('FAIL  dist/ missing. Run npm run check (build) before check:a11y.');
  process.exit(1);
}
const axeDistPath = join(distDir, 'axe.min.js');
copyFileSync(axeSourcePath, axeDistPath);

const SURFACES = [
  { id: 'shell-chat', panel: 'chat' },
  { id: 'review', panel: 'approvals' },
  { id: 'proof', panel: 'receipts' },
  { id: 'settings', panel: 'settings' },
];

function isFailingImpact(impact) {
  if (!impact) return false;
  if (impact === 'critical' || impact === 'serious') return true;
  if (failOnModerate && impact === 'moderate') return true;
  return false;
}

async function runAxe(page) {
  const hasAxe = await page.evaluate(() => typeof window.axe?.run === 'function');
  if (!hasAxe) {
    // Prefer same-origin file under dist/ (satisfies CSP script-src 'self')
    const pageUrl = page.url();
    let axeUrl;
    if (pageUrl.startsWith('file:')) {
      axeUrl = pathToFileURL(axeDistPath).href;
    } else {
      // http(s) renderer (dev) — still try file URL for local axe
      axeUrl = pathToFileURL(axeDistPath).href;
    }
    try {
      await page.addScriptTag({ url: axeUrl });
    } catch {
      // last resort: relative from index.html
      await page.addScriptTag({ url: 'axe.min.js' });
    }
  }

  const ready = await page.evaluate(() => typeof window.axe?.run === 'function');
  if (!ready) {
    throw new Error('axe-core failed to load under CSP (script-src self)');
  }

  return page.evaluate(async () => {
    return window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    });
  });
}

const harness = await launchDesktopHarness({ timeoutMs: 25000 });
const surfaceReports = [];
let failCount = 0;
let warnCount = 0;

try {
  const { window: page } = harness;
  await stabilizePage(page);

  const skipLink = page.locator('.zvd-skip-link, a[href="#zvd-main-content"]').first();
  if (!(await skipLink.count())) {
    console.error('FAIL  skip link missing (.zvd-skip-link)');
    process.exitCode = 1;
    failCount += 1;
  } else {
    console.log('OK    skip link present');
  }

  /**
   * Soft check: when Review approve/reject controls are rendered, they should
   * expose an accessible name (text content or aria-label). Missing controls
   * (empty queue) is not a failure — full SR path remains partially automated.
   */
  async function softCheckReviewActionNames(page) {
    return page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.zvd-approval-card'));
      if (!cards.length) {
        return { status: 'skipped', reason: 'no approval cards on review surface' };
      }

      const issues = [];
      for (const card of cards) {
        const buttons = Array.from(card.querySelectorAll('button'));
        const named = buttons.map((btn) => {
          const label = (
            btn.getAttribute('aria-label') ||
            btn.getAttribute('title') ||
            btn.textContent ||
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();
          return { label, html: btn.outerHTML.slice(0, 120) };
        });

        const hasApprove = named.some((b) => /approve|aprovar/i.test(b.label));
        const hasReject = named.some((b) => /reject|rejeitar|deny|recusar/i.test(b.label));
        const unnamed = named.filter((b) => !b.label);

        if (unnamed.length) {
          issues.push({ kind: 'unnamed-button', count: unnamed.length });
        }
        if (!hasApprove || !hasReject) {
          issues.push({
            kind: 'missing-decision-name',
            hasApprove,
            hasReject,
            labels: named.map((b) => b.label),
          });
        }
      }

      return {
        status: issues.length ? 'warn' : 'ok',
        cardCount: cards.length,
        issues,
      };
    });
  }

  for (const surface of SURFACES) {
    try {
      const opened = await openSidebarPanel(page, surface.panel);
      if (!opened) {
        throw new Error(`Could not open panel ${surface.panel}`);
      }
      await page.waitForTimeout(300);
      await stabilizePage(page);

      let reviewActionCheck = null;
      if (surface.panel === 'approvals') {
        reviewActionCheck = await softCheckReviewActionNames(page);
        if (reviewActionCheck.status === 'ok') {
          console.log(
            `OK    review action names (${reviewActionCheck.cardCount} card(s) with approve/reject labels)`,
          );
        } else if (reviewActionCheck.status === 'skipped') {
          console.log(`OK    review action names soft-check skipped (${reviewActionCheck.reason})`);
        } else {
          // Soft: log only — empty queues and partial SR coverage are expected.
          warnCount += 1;
          console.warn(
            `WARN  review action names soft-check: ${JSON.stringify(reviewActionCheck.issues)}`,
          );
        }
      }

      const results = await runAxe(page);
      const violations = results.violations || [];
      const failing = [];
      const warnings = [];

      for (const v of violations) {
        const entry = {
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: (v.nodes || []).slice(0, 5).map((n) => n.target),
        };
        if (isFailingImpact(v.impact)) failing.push(entry);
        else warnings.push(entry);
      }

      failCount += failing.length;
      warnCount += warnings.length;

      if (failing.length) {
        console.error(`FAIL  a11y ${surface.id}: ${failing.length} serious/critical`);
        for (const f of failing) {
          console.error(`  - [${f.impact}] ${f.id}: ${f.description}`);
        }
        process.exitCode = 1;
      } else {
        console.log(`OK    a11y ${surface.id} (${warnings.length} non-blocking warnings)`);
      }

      surfaceReports.push({
        id: surface.id,
        panel: surface.panel,
        failing,
        warnings,
        reviewActionCheck,
        passes: (results.passes || []).length,
        incomplete: (results.incomplete || []).length,
      });
    } catch (error) {
      failCount += 1;
      process.exitCode = 1;
      console.error(`FAIL  a11y ${surface.id}: ${error.message}`);
      surfaceReports.push({ id: surface.id, error: error.message });
    }
  }
} finally {
  await harness.close();
}

const summary = {
  status: process.exitCode ? 'fail' : 'pass',
  failOnModerate,
  failCount,
  warnCount,
  surfaces: surfaceReports,
};

writeFileSync(join(outDir, 'a11y-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ status: summary.status, failCount, warnCount }, null, 2));

if (process.exitCode) {
  console.error('\nDesktop a11y check failed. See tests/a11y/artifacts/a11y-summary.json');
  process.exit(1);
}

console.log('\nDesktop a11y check passed.');
