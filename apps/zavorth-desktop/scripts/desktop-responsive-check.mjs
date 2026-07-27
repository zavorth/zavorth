import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchDesktopHarness, openSidebarPanel, stabilizePage } from './lib/desktop-e2e-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = join(root, 'tests', 'visual', 'artifacts');
mkdirSync(artifacts, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setContentSize(app, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows().find(candidate => !candidate.isDestroyed());
    if (!window) throw new Error('Desktop window not found');
    if (window.isMaximized()) window.unmaximize();
    window.setContentSize(size.width, size.height);
  }, { width, height });
}

async function layoutSnapshot(page) {
  return page.evaluate(() => {
    const bounds = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      content: bounds('.zvd-content-stage'),
      composer: bounds('.zvd-composer-shell'),
      controls: bounds('.zvd-composer-bottom-row'),
      statusbar: bounds('.zvd-statusbar'),
      controlButtons: document.querySelectorAll('.zvd-composer-bottom-row button').length,
    };
  });
}

function assertFits(snapshot, label) {
  const { viewport, document, composer, controls, content, statusbar } = snapshot;
  assert(document.width <= viewport.width + 1, `${label}: horizontal document overflow (${document.width} > ${viewport.width})`);
  assert(content && content.right <= viewport.width + 1 && content.bottom <= viewport.height + 1, `${label}: content is clipped`);
  if (composer) {
    assert(composer.left >= -1 && composer.right <= viewport.width + 1, `${label}: composer is outside the viewport`);
    assert(composer.top >= content.top ? 1 && composer.bottom <= content.bottom + 1, `${label}: composer is outside the content stage`);
  }
  if (controls) {
    assert(controls.left >= -1 && controls.right <= viewport.width + 1, `${label}: composer controls are clipped horizontally`);
    assert(controls.bottom <= viewport.height + 1, `${label}: composer controls are clipped vertically`);
  }
  if (statusbar) {
    assert(statusbar.top >= content.bottom ? 1, `${label}: statusbar overlaps content`);
    assert(statusbar.bottom <= viewport.height + 1, `${label}: statusbar is outside the viewport`);
  }
}

const harness = await launchDesktopHarness();
try {
  const { app, window } = harness;
  await stabilizePage(window);

  for (const [width, height] of [[900, 650], [720, 520], [640, 480]]) {
    await setContentSize(app, width, height);
    await window.waitForTimeout(180);
    const snapshot = await layoutSnapshot(window);
    assertFits(snapshot, `chat ${width}x${height}`);
    assert(snapshot.composer && snapshot.controls, `chat ${width}x${height}: composer is missing`);
    assert(snapshot.controlButtons >= 5, `chat ${width}x${height}: expected composer features, found ${snapshot.controlButtons} buttons`);
  }

  const textarea = window.locator('.zvd-composer-shell textarea').first();
  await textarea.fill('Draft preserved across navigation');
  assert(await openSidebarPanel(window, 'files'), 'Could not open Files');
  await window.waitForSelector('.zvd-statusbar', { timeout: 5000 });
  assertFits(await layoutSnapshot(window), 'files 640x480');

  assert(await openSidebarPanel(window, 'chat'), 'Could not return to Chat');
  await window.waitForSelector('.zvd-composer-bottom-row', { timeout: 5000 });
  const returned = await layoutSnapshot(window);
  assertFits(returned, 'chat after navigation');
  assert(returned.controlButtons >= 5, `chat after navigation: composer features disappeared (${returned.controlButtons})`);
  assert((await textarea.inputValue()) === 'Draft preserved across navigation', 'Composer draft was lost after navigation');

  await window.screenshot({ path: join(artifacts, 'responsive-chat-640x480.png') });
  console.log('Desktop responsive check passed at 900x650, 720x520 and 640x480, including Files → Chat restoration.');
} finally {
  await harness.close();
}
