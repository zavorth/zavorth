import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[zavorth-product-qa-check] ${message}`);
  }
}

function assertFile(relativePath) {
  assert(existsSync(path.join(root, relativePath)), `missing required file: ${relativePath}`);
}

function assertIncludes(haystack, needle, label) {
  assert(haystack.includes(needle), `${label} missing ${needle}`);
}

function runCheck(script) {
  execFileSync('node', [path.join(root, script)], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
}

async function waitForText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 8000 });
}

async function runDesktopAndMobileFlowQa() {
  const htmlUrl = pathToFileURL(path.join(root, 'assets/command-center/index.html')).href;
  const viewports = [
    { name: 'desktop', width: 1366, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });

      await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-profile="personal"]').click();
      await page.locator('[data-mission="organize-day"]').click();
      await page.locator('[data-personal-flow="organize-day"]').waitFor({ timeout: 8000 });
      await waitForText(page, 'Daily plan');
      await waitForText(page, 'Nothing outside this dashboard');
      await waitForText(page, 'Simple receipt');

      await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-profile="developer"]').click();
      await page.locator('[data-mission="review-workspace"]').click();
      await page.locator('[data-developer-flow="workspace-picker"]').waitFor({ timeout: 8000 });
      await page.locator('[data-developer-flow-action="use-current-workspace"]').click();
      const developerReview = page.locator('[data-developer-flow="review-workspace"]');
      await developerReview.waitFor({ timeout: 8000 });
      await developerReview.getByText('Repository review', { exact: false }).waitFor({ timeout: 8000 });
      await developerReview.getByText('Patch preview', { exact: true }).waitFor({ timeout: 8000 });
      await developerReview.getByText('Developer receipt', { exact: true }).waitFor({ timeout: 8000 });
      await page.locator('[data-developer-flow-action="approve-patch"]').click();
      await waitForText(page, 'Patch proposal approved as a preview');

      await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-profile="business"]').click();
      await page.locator('[data-mission="business-audit"]').click();
      await page.locator('[data-business-flow="audit"]').waitFor({ timeout: 8000 });
      await waitForText(page, 'Approval channel');
      await waitForText(page, 'TTL');
      await waitForText(page, 'Blocked actions');
      await waitForText(page, 'Approver');
      await waitForText(page, 'Evidence');
      await page.locator('[data-business-flow-action="confirm-channel"]').click();
      await waitForText(page, 'Dashboard approval channel confirmed');

      await page.close();
    }
  } finally {
    await browser.close();
  }
}

function runStaticProductQa() {
  [
    'assets/command-center/index.html',
    'assets/command-center/scripts/app.js',
    'assets/command-center/styles/chat.css',
    'src/zavorth-cli.ts',
    'scripts/zavorth-personal-flow-check.mjs',
    'scripts/zavorth-developer-flow-check.mjs',
    'scripts/zavorth-business-flow-check.mjs',
  ].forEach(assertFile);

  const html = read('assets/command-center/index.html');
  const app = read('assets/command-center/scripts/app.js');
  const css = read('assets/command-center/styles/chat.css');
  const cli = read('src/zavorth-cli.ts');

  [
    'data-profile="personal"',
    'data-profile="developer"',
    'data-profile="business"',
    'data-mission="organize-day"',
    'data-mission="review-workspace"',
    'data-mission="business-audit"',
  ].forEach((needle) => assertIncludes(html, needle, 'dashboard home'));

  [
    'renderPersonalDayFlow',
    'renderDeveloperReviewFlow',
    'renderBusinessAuditFlow',
  ].forEach((needle) => assertIncludes(app, needle, 'dashboard flow runtime'));

  [
    '.personal-flow-grid',
    '.developer-flow-grid',
    '.business-flow-grid',
  ].forEach((needle) => assertIncludes(css, needle, 'dashboard flow styles'));

  [
    "command === 'missions'",
    "command === 'receipts'",
    "command === 'experience'",
    "command === 'guided-missions'",
    "command === 'dashboard-home'",
    "command === 'providers'",
    '[gateway channels]',
    "command === 'doctor'",
  ].forEach((needle) => assertIncludes(cli, needle, 'CLI product mirror'));

  const homeHero = html.slice(html.indexOf('home-hero'), html.indexOf('composer-panel'));
  const hiddenComplexityTerms = ['Policy Broker', 'SecretRefs', 'JSON'];
  hiddenComplexityTerms.forEach((term) => {
    assert(!homeHero.includes(term), `home hero leaks implementation term: ${term}`);
  });

  const falseReadyPatterns = [
    /Provider<\/span>\s*<strong>Ready<\/strong>/i,
    /Channels<\/span>\s*<strong>Ready<\/strong>/i,
    /Sandbox<\/span>\s*<strong>Ready<\/strong>/i,
    /data-readiness=["']ready["']/i,
    /\bmock\s+ready\b/i,
    /\bfake\s+ready\b/i,
  ];
  falseReadyPatterns.forEach((pattern) => {
    assert(!pattern.test(html), `dashboard contains misleading readiness pattern: ${pattern}`);
  });

  [
    'Nothing outside this dashboard',
    'Read first',
    'no policy was changed, no channel was modified',
    'live execution must go through runtime safety approval',
  ].forEach((needle) => assertIncludes(app, needle, 'safe product copy'));
}

runStaticProductQa();
runCheck('scripts/zavorth-personal-flow-check.mjs');
runCheck('scripts/zavorth-developer-flow-check.mjs');
runCheck('scripts/zavorth-business-flow-check.mjs');
runCheck('scripts/zavorth-cli-experience-parity-check.mjs');
await runDesktopAndMobileFlowQa();

console.log('[zavorth-product-qa-check] ok: Personal, Developer and Business flows pass on desktop/mobile, CLI mirrors essentials, and readiness remains honest.');
