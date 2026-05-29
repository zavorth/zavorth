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
  await page.waitForFunction((needle) => {
    return Array.from(document.querySelectorAll('body *')).some((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return element.textContent?.includes(String(needle))
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    });
  }, text, { timeout: 8000 });
}

async function clickVisible(page, selector) {
  await page.locator(`${selector}:visible`).first().click({ timeout: 8000 });
}

async function runDesktopAndMobileFlowQa() {
  const htmlUrl = pathToFileURL(path.join(root, 'assets/zavorthControl/index.html')).href;
  const viewports = [
    { name: 'desktop', width: 1366, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });

      await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
      await clickVisible(page, '[data-mission="organize-day"]');
      await waitForText(page, 'Organize my day safely');
      await waitForText(page, 'Start read-only');

      await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
      await clickVisible(page, '[data-mission="review-workspace"]');
      await waitForText(page, 'Review this workspace safely');
      await waitForText(page, 'read-only');

      await page.goto(htmlUrl, { waitUntil: 'domcontentloaded' });
      await clickVisible(page, '[data-mission="business-audit"]');
      await waitForText(page, 'run a governed audit');
      await waitForText(page, 'approval channel');

      await page.close();
    }
  } finally {
    await browser.close();
  }
}

function runStaticProductQa() {
  [
    'assets/zavorthControl/index.html',
    'assets/zavorthControl/scripts/app.js',
    'assets/zavorthControl/styles/chat.css',
    'src/zavorth-cli.ts',
    'scripts/zavorth-personal-flow-check.mjs',
    'scripts/zavorth-developer-flow-check.mjs',
    'scripts/zavorth-business-flow-check.mjs',
  ].forEach(assertFile);

  const html = read('assets/zavorthControl/index.html');
  const app = read('assets/zavorthControl/scripts/app.js');
  const css = read('assets/zavorthControl/styles/chat.css');
  const cli = read('src/zavorth-cli.ts');

  [
    'data-profile="personal"',
    'data-profile="developer"',
    'data-profile="business"',
    'data-mission="organize-day"',
    'data-mission="review-workspace"',
    'data-mission="business-audit"',
  ].forEach((needle) => assertIncludes(html, needle, 'zavorthControl home'));

  [
    'renderPersonalDayFlow',
    'renderDeveloperReviewFlow',
    'renderBusinessAuditFlow',
  ].forEach((needle) => assertIncludes(app, needle, 'zavorthControl flow runtime'));

  [
    '.personal-flow-grid',
    '.developer-flow-grid',
    '.business-flow-grid',
  ].forEach((needle) => assertIncludes(css, needle, 'zavorthControl flow styles'));

  [
    "command === 'missions'",
    "command === 'receipts'",
    "command === 'experience'",
    "command === 'guided-missions'",
    "command === 'zavorthControl-home'",
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
    assert(!pattern.test(html), `zavorthControl contains misleading readiness pattern: ${pattern}`);
  });

  [
    'Nothing outside this zavorthControl',
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
