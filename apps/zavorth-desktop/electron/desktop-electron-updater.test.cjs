const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDesktopElectronUpdater,
  compareSemver,
  normalizeUpdateInfo,
} = require('./desktop-electron-updater.cjs');

function createMockAutoUpdater(handlers = {}) {
  const listeners = new Map();
  return {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    on(event, fn) {
      listeners.set(event, fn);
    },
    emit(event, payload) {
      const fn = listeners.get(event);
      if (fn) fn(payload);
    },
    async checkForUpdates() {
      if (handlers.checkForUpdates) return handlers.checkForUpdates();
      return { updateInfo: { version: '0.2.0', releaseNotes: 'Installer update' } };
    },
    async downloadUpdate() {
      if (handlers.downloadUpdate) return handlers.downloadUpdate();
      this.emit('update-downloaded', { version: '0.2.0' });
    },
    quitAndInstall() {
      if (handlers.quitAndInstall) handlers.quitAndInstall();
    },
  };
}

test('compareSemver and normalizeUpdateInfo helpers', () => {
  assert.equal(compareSemver('0.2.0', '0.1.0'), 1);
  assert.equal(normalizeUpdateInfo({ version: 'v1.4.0', releaseNotes: 'notes' }).version, '1.4.0');
  assert.equal(normalizeUpdateInfo(null), null);
});

test('electron-updater is disabled when not packaged', () => {
  const service = createDesktopElectronUpdater({
    isPackaged: () => false,
    getVersion: () => '0.1.0',
    autoUpdater: createMockAutoUpdater(),
  });
  assert.equal(service.isEnabled(), false);
  const cfg = service.configure();
  assert.equal(cfg.ok, false);
  assert.equal(cfg.reason, 'not-packaged');
});

test('check/download/install flow with injected autoUpdater', async () => {
  const mock = createMockAutoUpdater();
  const service = createDesktopElectronUpdater({
    forceEnable: true,
    getVersion: () => '0.1.0',
    autoUpdater: mock,
  });

  assert.equal(service.isEnabled(), true);
  const cfg = service.configure();
  assert.equal(cfg.ok, true);
  assert.equal(mock.autoDownload, false);
  assert.equal(mock.autoInstallOnAppQuit, true);

  const check = await service.checkForUpdates();
  assert.equal(check.ok, true);
  assert.equal(check.hasUpdate, true);
  assert.equal(check.latestVersion, '0.2.0');
  assert.equal(check.source, 'electron-updater');
  assert.match(check.message, /0\.2\.0|electron-updater/i);

  const dl = await service.downloadUpdate();
  assert.equal(dl.ok, true);
  assert.equal(dl.mode, 'electron-updater-download');
  assert.equal(service.isDownloaded(), true);

  const install = service.quitAndInstall();
  assert.equal(install.ok, true);
  assert.equal(install.mode, 'electron-updater-install');
});

test('check reports up-to-date when remote equals current', async () => {
  const mock = createMockAutoUpdater({
    checkForUpdates: async () => ({ updateInfo: { version: '0.1.0' } }),
  });
  const service = createDesktopElectronUpdater({
    forceEnable: true,
    getVersion: () => '0.1.0',
    autoUpdater: mock,
  });
  const check = await service.checkForUpdates();
  assert.equal(check.ok, true);
  assert.equal(check.hasUpdate, false);
});
