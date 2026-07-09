const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  compareSemver,
  checkUpdates,
  downloadUpdate,
  deferUpdate,
  installUpdate,
  rollbackUpdate,
  resolveGithubRepo,
  normalizeReleaseVersion,
  pickReleaseAsset,
  readState,
  DEFAULT_GITHUB_REPO,
} = require('./desktop-updates.cjs');

test('compareSemver orders versions', () => {
  assert.equal(compareSemver('0.2.0', '0.1.0'), 1);
  assert.equal(compareSemver('0.1.0', '0.1.0'), 0);
  assert.equal(compareSemver('0.1.0', '0.2.0'), -1);
});

test('resolveGithubRepo defaults to zavorth/zavorth', () => {
  assert.equal(resolveGithubRepo({}), DEFAULT_GITHUB_REPO);
  assert.equal(resolveGithubRepo({ githubRepo: 'acme/app' }), 'acme/app');
  assert.equal(resolveGithubRepo({ githubRepo: 'https://github.com/acme/app.git' }), 'acme/app');
});

test('normalizeReleaseVersion strips prefixes', () => {
  assert.equal(normalizeReleaseVersion('v1.2.3'), '1.2.3');
  assert.equal(normalizeReleaseVersion('desktop-0.2.0'), '0.2.0');
  assert.equal(normalizeReleaseVersion('zavorth-desktop@0.3.1'), '0.3.1');
});

test('pickReleaseAsset prefers platform packages', () => {
  const assets = [
    { name: 'source.tar.gz', browser_download_url: 'https://example/source' },
    { name: 'Zavorth-Setup.exe', browser_download_url: 'https://example/setup.exe' },
  ];
  const previous = process.platform;
  // Function uses process.platform argument override
  assert.equal(pickReleaseAsset(assets, 'win32'), 'https://example/setup.exe');
  assert.ok(previous);
});

test('checkUpdates uses GitHub channel by default (mocked, no network)', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zvd-upd-gh-'));
  const result = await checkUpdates({
    currentVersion: '0.1.0',
    homeDir,
    githubRepo: 'zavorth/zavorth',
    fetchJson: async () => ({
      ok: true,
      status: 200,
      data: {
        tag_name: 'v0.2.0',
        body: 'Desktop workboard + GitHub channel',
        html_url: 'https://github.com/zavorth/zavorth/releases/tag/v0.2.0',
        assets: [
          { name: 'Zavorth-0.2.0-win.exe', browser_download_url: 'https://github.com/zavorth/zavorth/releases/download/v0.2.0/Zavorth.exe' },
        ],
      },
    }),
  });
  assert.equal(result.providerConfigured, true);
  assert.equal(result.source, 'github');
  assert.equal(result.hasUpdate, true);
  assert.equal(result.latestVersion, '0.2.0');
  assert.match(result.message, /GitHub|0\.2\.0/i);
  assert.ok(result.releaseUrl.includes('github.com'));
});

test('checkUpdates is honest when GitHub has no releases yet', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zvd-upd-empty-'));
  const result = await checkUpdates({
    currentVersion: '0.1.0',
    homeDir,
    fetchJson: async () => ({ ok: false, status: 404, error: 'Not Found' }),
  });
  assert.equal(result.providerConfigured, true);
  assert.equal(result.source, 'github');
  assert.equal(result.hasUpdate, false);
  assert.match(result.changelog || result.message, /No published|GitHub|Releases/i);
});

test('defer and rollback update state persist locally', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zvd-upd-'));
  const deferred = deferUpdate({ homeDir, days: 3 });
  assert.equal(deferred.ok, true);
  assert.ok(deferred.deferredUntil);
  assert.equal(readState(homeDir).deferredUntil, deferred.deferredUntil);

  const opened = [];
  const install = await installUpdate({
    currentVersion: '0.1.0',
    homeDir,
    openExternal: async (url) => { opened.push(url); },
    startSetup: async () => ({ ok: true, message: 'setup' }),
  });
  // without downloaded version, GitHub path still opens/guides
  assert.equal(install.ok, true);
  assert.ok(opened.some(url => String(url).includes('github.com')));

  const statePath = path.join(homeDir, 'desktop-update-state.json');
  fs.writeFileSync(statePath, JSON.stringify({
    downloadedVersion: '0.2.0',
    deferredUntil: null,
    rollbackVersion: null,
    lastManifest: {
      latestVersion: '0.2.0',
      releaseUrl: 'https://github.com/zavorth/zavorth/releases/tag/v0.2.0',
      source: 'github',
    },
  }));
  const installed = await installUpdate({
    currentVersion: '0.1.0',
    homeDir,
    openExternal: async (url) => { opened.push(url); },
    startSetup: async () => ({ ok: true, message: 'setup launched' }),
  });
  assert.equal(installed.ok, true);
  assert.equal(installed.rollbackVersion, '0.1.0');

  const rb = rollbackUpdate({ homeDir });
  assert.equal(rb.ok, true);
  assert.equal(rb.rollbackVersion, '0.1.0');
});

test('downloadUpdate without remote URL marks manual package ready (manifest path)', async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zvd-upd-dl-'));
  // Force a fake "update available" by writing a previous check state is not enough;
  // without manifest URL there is no update. Seed via download with empty provider:
  const opened = [];
  const noUpdate = await downloadUpdate({
    currentVersion: '0.1.0',
    homeDir,
    manifestUrl: '',
    openExternal: async (url) => { opened.push(url); },
    fetchJson: async () => ({ ok: false, status: 404 }),
  });
  // Opens GitHub Releases even without a newer tag.
  assert.equal(noUpdate.ok, true);
  assert.match(noUpdate.message, /GitHub|Releases/i);
  assert.ok(opened.some(url => String(url).includes('github.com')));

  // With allowSetupFallback install still works for guided upgrade.
  const setupOnly = await installUpdate({
    currentVersion: '0.1.0',
    homeDir,
    allowSetupFallback: true,
    openExternal: async (url) => { opened.push(url); },
    startSetup: async () => ({ ok: true, launched: true, message: 'setup open', command: 'zavorth setup' }),
  });
  assert.equal(setupOnly.ok, true);
  assert.match(setupOnly.message, /setup|Setup|GitHub|install/i);
});
