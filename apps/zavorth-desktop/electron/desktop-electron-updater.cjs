/**
 * Phase 7 — electron-updater bridge for packaged Zavorth Desktop installers.
 *
 * - Enabled only when packaged (or forceEnable for tests).
 * - autoDownload stays false: user confirms download (matches honest update UX).
 * - Falls back to GitHub/manual channel in desktop-updates.cjs when unavailable.
 * - autoUpdater is injectable so unit tests never need a real Electron build.
 */

function createDesktopElectronUpdater(options = {}) {
  const isPackaged = typeof options.isPackaged === 'function'
    ? options.isPackaged
    : () => Boolean(options.isPackaged);
  const getVersion = typeof options.getVersion === 'function'
    ? options.getVersion
    : () => String(options.currentVersion || '0.0.0');
  const forceEnable = options.forceEnable === true;
  const feedConfig = options.feedConfig || null;
  const logger = options.logger || null;
  const allowPrerelease = options.allowPrerelease === true
    || String(process.env.ZAVORTH_UPDATE_ALLOW_PRERELEASE || '').toLowerCase() === 'true';

  /** @type {null | ReturnType<typeof buildMockShape>} */
  let autoUpdater = options.autoUpdater || null;
  let configured = false;
  let lastError = null;
  let lastCheck = null;
  let updateAvailable = null;
  let updateDownloaded = null;
  let downloadProgress = null;
  let listenersBound = false;

  function resolveAutoUpdater() {
    if (autoUpdater) return autoUpdater;
    try {
      // Lazy require — keeps dev unit tests light when inject is provided.
      // eslint-disable-next-line import/no-extraneous-dependencies, global-require
      const mod = require('electron-updater');
      autoUpdater = mod.autoUpdater;
      return autoUpdater;
    } catch (error) {
      lastError = error?.message || 'electron-updater module not available';
      return null;
    }
  }

  function isEnabled() {
    if (forceEnable) return Boolean(resolveAutoUpdater());
    if (!isPackaged()) return false;
    if (String(process.env.ZAVORTH_UPDATE_DISABLE_ELECTRON_UPDATER || '').toLowerCase() === 'true') {
      return false;
    }
    return Boolean(resolveAutoUpdater());
  }

  function bindListeners(au) {
    if (!au || listenersBound) return;
    listenersBound = true;

    const on = typeof au.on === 'function' ? au.on.bind(au) : null;
    if (!on) return;

    on('error', (err) => {
      lastError = err?.message || String(err || 'electron-updater error');
      log('error', lastError);
    });
    on('checking-for-update', () => {
      lastCheck = { at: new Date().toISOString(), state: 'checking' };
    });
    on('update-available', (info) => {
      updateAvailable = normalizeUpdateInfo(info);
      lastError = null;
      log('info', `update available: ${updateAvailable?.version}`);
    });
    on('update-not-available', (info) => {
      updateAvailable = null;
      lastCheck = {
        at: new Date().toISOString(),
        state: 'up-to-date',
        version: info?.version || getVersion(),
      };
    });
    on('download-progress', (progress) => {
      downloadProgress = {
        percent: Number(progress?.percent || 0),
        transferred: Number(progress?.transferred || 0),
        total: Number(progress?.total || 0),
        bytesPerSecond: Number(progress?.bytesPerSecond || 0),
      };
    });
    on('update-downloaded', (info) => {
      updateDownloaded = normalizeUpdateInfo(info);
      downloadProgress = { percent: 100, transferred: 0, total: 0, bytesPerSecond: 0 };
      lastError = null;
      log('info', `update downloaded: ${updateDownloaded?.version}`);
    });
  }

  function configure() {
    const au = resolveAutoUpdater();
    if (!au) {
      return {
        ok: false,
        enabled: false,
        reason: 'electron-updater-unavailable',
        error: lastError,
      };
    }
    if (!forceEnable && !isPackaged()) {
      return {
        ok: false,
        enabled: false,
        reason: 'not-packaged',
        message: 'electron-updater is disabled in unpackaged/dev runs; GitHub channel remains available.',
      };
    }

    try {
      if (typeof au.autoDownload !== 'undefined') au.autoDownload = false;
      if (typeof au.autoInstallOnAppQuit !== 'undefined') au.autoInstallOnAppQuit = true;
      if (typeof au.allowPrerelease !== 'undefined') au.allowPrerelease = allowPrerelease;
      if (typeof au.allowDowngrade !== 'undefined') au.allowDowngrade = false;

      if (feedConfig && typeof au.setFeedURL === 'function') {
        au.setFeedURL(feedConfig);
      } else if (process.env.ZAVORTH_UPDATE_FEED_URL && typeof au.setFeedURL === 'function') {
        au.setFeedURL({
          provider: 'generic',
          url: String(process.env.ZAVORTH_UPDATE_FEED_URL).trim(),
        });
      }

      if (logger && typeof au.logger !== 'undefined') {
        au.logger = logger;
      }

      bindListeners(au);
      configured = true;
      return {
        ok: true,
        enabled: true,
        reason: 'configured',
        allowPrerelease,
        feed: feedConfig || process.env.ZAVORTH_UPDATE_FEED_URL || 'electron-builder publish (github)',
      };
    } catch (error) {
      lastError = error?.message || String(error);
      return { ok: false, enabled: false, reason: 'configure-failed', error: lastError };
    }
  }

  async function checkForUpdates() {
    if (!isEnabled()) {
      return {
        ok: false,
        enabled: false,
        hasUpdate: false,
        reason: forceEnable ? 'unavailable' : (isPackaged() ? 'disabled-or-unavailable' : 'not-packaged'),
        error: lastError,
      };
    }
    if (!configured) {
      const cfg = configure();
      if (!cfg.ok) return { ok: false, enabled: false, hasUpdate: false, ...cfg };
    }

    const au = resolveAutoUpdater();
    try {
      const result = typeof au.checkForUpdates === 'function'
        ? await au.checkForUpdates()
        : null;
      const info = normalizeUpdateInfo(result?.updateInfo || updateAvailable || result);
      const current = getVersion();
      const latest = info?.version || current;
      const hasUpdate = compareSemver(latest, current) > 0;

      if (hasUpdate) {
        updateAvailable = info;
      } else {
        updateAvailable = null;
      }

      lastCheck = {
        at: new Date().toISOString(),
        state: hasUpdate ? 'available' : 'up-to-date',
        version: latest,
      };
      lastError = null;

      return {
        ok: true,
        enabled: true,
        hasUpdate,
        version: current,
        latestVersion: latest,
        changelog: info?.releaseNotes || '',
        downloadUrl: null,
        releaseUrl: info?.releaseUrl || null,
        source: 'electron-updater',
        channel: 'electron-updater',
        engine: 'electron-updater',
        providerConfigured: true,
        downloaded: Boolean(updateDownloaded && compareSemver(updateDownloaded.version, current) > 0),
        updateInfo: info,
        message: hasUpdate ? `Installer update ${latest} is available (electron-updater). Download in-app, then install.`
          : `Desktop ${current} is up to date (electron-updater).`,
      };
    } catch (error) {
      lastError = error?.message || String(error);
      return {
        ok: false,
        enabled: true,
        hasUpdate: false,
        error: lastError,
        source: 'electron-updater',
        engine: 'electron-updater',
        reason: 'check-failed',
        message: lastError,
      };
    }
  }

  async function downloadUpdate() {
    if (!isEnabled()) {
      return { ok: false, error: 'electron-updater is not enabled in this runtime.' };
    }
    if (!configured) configure();
    const au = resolveAutoUpdater();
    try {
      if (typeof au.downloadUpdate === 'function') {
        await au.downloadUpdate();
      } else if (typeof au.checkForUpdatesAndNotify === 'function') {
        // Some mocks only expose notify path
        await au.checkForUpdatesAndNotify();
      } else {
        return { ok: false, error: 'downloadUpdate is not supported by this autoUpdater instance.' };
      }
      // Prefer event-driven state; if local sets updateDownloaded synchronously, use it.
      const version = updateDownloaded?.version || updateAvailable?.version || null;
      return {
        ok: true,
        mode: 'electron-updater-download',
        latestVersion: version,
        message: version ? `Downloaded installer update ${version}. Install when ready (app will relaunch).`
          : 'Download started via electron-updater.',
        progress: downloadProgress,
      };
    } catch (error) {
      lastError = error?.message || String(error);
      return { ok: false, error: lastError, mode: 'electron-updater-download' };
    }
  }

  function quitAndInstall(isSilent = false, isForceRunAfter = true) {
    if (!isEnabled()) {
      return { ok: false, error: 'electron-updater is not enabled in this runtime.' };
    }
    const au = resolveAutoUpdater();
    if (!updateDownloaded && !options.allowInstallWithoutDownload) {
      return {
        ok: false,
        error: 'No update has been downloaded yet. Download first, then install.',
        mode: 'electron-updater-install',
      };
    }
    try {
      if (typeof au.quitAndInstall === 'function') {
        // Fire-and-forget: process may exit.
        setImmediate(() => {
          try {
            au.quitAndInstall(isSilent, isForceRunAfter);
          } catch (error) {
            lastError = error?.message || String(error);
            log('error', lastError);
          }
        });
      }
      return {
        ok: true,
        mode: 'electron-updater-install',
        latestVersion: updateDownloaded?.version || updateAvailable?.version || null,
        message: 'Installing update and relaunching Desktop…',
      };
    } catch (error) {
      lastError = error?.message || String(error);
      return { ok: false, error: lastError, mode: 'electron-updater-install' };
    }
  }

  function isDownloaded() {
    const current = getVersion();
    return Boolean(updateDownloaded && compareSemver(updateDownloaded.version, current) > 0);
  }

  function getStatus() {
    return {
      enabled: isEnabled(),
      configured,
      packaged: forceEnable ? true : isPackaged(),
      currentVersion: getVersion(),
      updateAvailable,
      updateDownloaded,
      downloadProgress,
      lastCheck,
      lastError,
      engine: 'electron-updater',
    };
  }

  /** Test helper: dry-run downloaded package without network. */
  function __setDownloadedForTests(info) {
    updateDownloaded = normalizeUpdateInfo(info);
  }

  function log(level, message) {
    if (!logger) return;
    if (typeof logger[level] === 'function') logger[level](message);
    else if (typeof logger.info === 'function') logger.info(message);
  }

  return {
    configure,
    isEnabled,
    isDownloaded,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    getStatus,
    __setDownloadedForTests,
  };
}

function normalizeUpdateInfo(info) {
  if (!info || typeof info !== 'object') return null;
  const version = String(info.version || info.latestVersion || '')
    .replace(/^v/i, '')
    .trim();
  if (!version) return null;
  let releaseNotes = '';
  if (typeof info.releaseNotes === 'string') {
    releaseNotes = info.releaseNotes;
  } else if (Array.isArray(info.releaseNotes)) {
    releaseNotes = info.releaseNotes
      .map((n) => (typeof n === 'string' ? n : n?.note || ''))
      .filter(Boolean)
      .join('\n');
  } else if (info.releaseName) {
    releaseNotes = String(info.releaseName);
  }
  return {
    version,
    releaseNotes,
    releaseDate: info.releaseDate || null,
    releaseUrl: info.path || info.files?.[0]?.url || null,
  };
}

function compareSemver(a, b) {
  const left = String(a || '0.0.0').replace(/^v/i, '').split('.').map((n) => Number(n) || 0);
  const right = String(b || '0.0.0').replace(/^v/i, '').split('.').map((n) => Number(n) || 0);
  const len = Math.max(left.length, right.length, 3);
  for (let i = 0; i < len; i += 1) {
    const delta = (left[i] || 0) ? (right[i] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

module.exports = {
  createDesktopElectronUpdater,
  normalizeUpdateInfo,
  compareSemver,
};
