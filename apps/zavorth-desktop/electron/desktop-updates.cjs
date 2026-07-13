/**
 * Local-first update channel for Zavorth Desktop.
 *
 * Priority:
 * 1. electron-updater (Phase 7) — when packaged installers + service enabled
 * 2. Optional custom manifest (ZAVORTH_UPDATE_MANIFEST_URL) — only if you host one later
 * 3. GitHub Releases for the repo (default: zavorth/zavorth) — no website required
 *
 * electron-updater downloads signed installers in-app (user-triggered).
 * GitHub/manual path never silently executes installers — opens browser/Setup.
 */
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { shell } = require('electron');
const { isAllowedExternalUrl } = require('./api-path.cjs');

const DEFAULT_GITHUB_REPO = 'zavorth/zavorth';

function compareSemver(a, b) {
  const left = String(a || '0.0.0').replace(/^v/i, '').split('.').map(n => Number(n) || 0);
  const right = String(b || '0.0.0').replace(/^v/i, '').split('.').map(n => Number(n) || 0);
  const len = Math.max(left.length, right.length, 3);
  for (let i = 0; i < len; i += 1) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function stateFile(homeDir) {
  return path.join(homeDir, 'desktop-update-state.json');
}

function readState(homeDir) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(homeDir), 'utf8'));
  } catch {
    return {
      deferredUntil: null,
      downloadedVersion: null,
      rollbackVersion: null,
      lastCheckedAt: null,
      lastManifest: null,
    };
  }
}

function writeState(homeDir, state) {
  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(stateFile(homeDir), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return state;
}

function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs || 12000;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Zavorth-Desktop-Update-Check',
    ...(options.headers || {}),
  };
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, error: 'Invalid update URL.' });
      return;
    }
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.get(parsed, { timeout: timeoutMs, headers }, (res) => {
      // Follow one redirect (GitHub sometimes redirects).
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location, options).then(resolve);
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            data: JSON.parse(text),
            status: res.statusCode,
          });
        } catch {
          resolve({ ok: false, error: 'Update response is not valid JSON.', status: res.statusCode });
        }
      });
    });
    req.on('error', error => resolve({ ok: false, error: error.message || 'Update check failed.' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Update check timed out.' });
    });
  });
}

function resolveGithubRepo(input = {}) {
  const raw = String(
    process.env.ZAVORTH_UPDATE_GITHUB_REPO
    || input.githubRepo
    || DEFAULT_GITHUB_REPO,
  ).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) {
    return DEFAULT_GITHUB_REPO;
  }
  return raw;
}

function githubReleasesUrl(repo) {
  return `https://github.com/${repo}/releases`;
}

function githubLatestApiUrl(repo) {
  return `https://api.github.com/repos/${repo}/releases/latest`;
}

function normalizeReleaseVersion(tag) {
  return String(tag || '')
    .trim()
    .replace(/^v/i, '')
    .replace(/^zavorth[-_]?desktop[-_@]?/i, '')
    .replace(/^desktop[-_@]?/i, '');
}

function pickReleaseAsset(assets, platform = process.platform) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const names = assets.map(a => ({
    name: String(a.name || '').toLowerCase(),
    url: a.browser_download_url || a.url || null,
  })).filter(a => a.url);

  const prefer = platform === 'win32'
    ? [/\.msi$/i, /\.exe$/i, /win/i, /windows/i]
    : platform === 'darwin'
      ? [/\.dmg$/i, /\.pkg$/i, /mac/i, /darwin/i]
      : [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i, /linux/i];

  for (const pattern of prefer) {
    const hit = names.find(a => pattern.test(a.name));
    if (hit) return hit.url;
  }
  // Prefer anything that looks like a desktop package over source tarballs.
  const packageHit = names.find(a => !/source|\.tar\.gz$|\.zip$/i.test(a.name) || /desktop|setup|installer/i.test(a.name));
  return packageHit?.url || names[0]?.url || null;
}

function truncateChangelog(text, max = 1800) {
  const value = String(text || '').trim();
  if (!value) return 'No release notes on GitHub for this tag.';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

async function fetchGithubLatestRelease(input = {}) {
  const repo = resolveGithubRepo(input);
  const token = String(process.env.ZAVORTH_UPDATE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const fetchImpl = typeof input.fetchJson === 'function' ? input.fetchJson : fetchJson;
  const result = await fetchImpl(githubLatestApiUrl(repo), { headers });
  if (!result.ok || !result.data) {
    // 404 usually means "no releases published yet" — still a valid GitHub channel.
    if (result.status === 404) {
      return {
        ok: true,
        repo,
        hasRelease: false,
        latestVersion: null,
        changelog: 'No published GitHub releases yet. Watch the repository Releases page for updates.',
        downloadUrl: null,
        releaseUrl: githubReleasesUrl(repo),
        tagName: null,
        error: null,
      };
    }
    return {
      ok: false,
      repo,
      hasRelease: false,
      latestVersion: null,
      changelog: '',
      downloadUrl: null,
      releaseUrl: githubReleasesUrl(repo),
      tagName: null,
      error: result.error || `GitHub release check failed (HTTP ${result.status || '?'}).`,
    };
  }

  const data = result.data;
  const tagName = String(data.tag_name || data.name || '').trim();
  const latestVersion = normalizeReleaseVersion(tagName) || null;
  const downloadUrl = pickReleaseAsset(data.assets) || data.html_url || githubReleasesUrl(repo);
  return {
    ok: true,
    repo,
    hasRelease: true,
    latestVersion,
    changelog: truncateChangelog(data.body || data.name || `GitHub release ${tagName}`),
    downloadUrl,
    releaseUrl: data.html_url || githubReleasesUrl(repo),
    tagName,
    error: null,
  };
}

async function checkUpdates(input = {}) {
  const currentVersion = String(input.currentVersion || '0.1.0');
  const homeDir = input.homeDir;
  const state = homeDir ? readState(homeDir) : {};
  const manifestUrl = String(process.env.ZAVORTH_UPDATE_MANIFEST_URL || input.manifestUrl || '').trim();
  const channel = String(process.env.ZAVORTH_UPDATE_CHANNEL || 'github');

  // Phase 7: prefer electron-updater for packaged Desktop when the bridge is provided.
  const electronUpdater = input.electronUpdater || null;
  if (electronUpdater && typeof electronUpdater.isEnabled === 'function' && electronUpdater.isEnabled()) {
    const eu = await electronUpdater.checkForUpdates();
    if (eu && eu.ok) {
      if (homeDir) {
        writeState(homeDir, {
          ...state,
          lastCheckedAt: new Date().toISOString(),
          lastManifest: {
            latestVersion: eu.latestVersion,
            changelog: eu.changelog,
            downloadUrl: eu.downloadUrl || null,
            releaseUrl: eu.releaseUrl || null,
            channel: 'electron-updater',
            source: 'electron-updater',
            engine: 'electron-updater',
            githubRepo: resolveGithubRepo(input),
          },
        });
      }
      const deferredUntil = state.deferredUntil || null;
      const hasUpdate = Boolean(eu.hasUpdate);
      const deferredActive = Boolean(deferredUntil && hasUpdate && new Date(deferredUntil).getTime() > Date.now());
      return {
        ok: true,
        hasUpdate,
        version: eu.version || currentVersion,
        latestVersion: eu.latestVersion || currentVersion,
        changelog: eu.changelog || '',
        channel: 'electron-updater',
        source: 'electron-updater',
        engine: 'electron-updater',
        githubRepo: resolveGithubRepo(input),
        downloadUrl: eu.downloadUrl || null,
        releaseUrl: eu.releaseUrl || githubReleasesUrl(resolveGithubRepo(input)),
        providerConfigured: true,
        downloaded: Boolean(eu.downloaded || (typeof electronUpdater.isDownloaded === 'function' && electronUpdater.isDownloaded())),
        deferredUntil: deferredActive ? deferredUntil : null,
        rollbackVersion: state.rollbackVersion || null,
        error: null,
        message: eu.message,
      };
    }
    // Fall through to GitHub/manual when electron-updater check fails.
  }

  let latestVersion = currentVersion;
  let changelog = '';
  let downloadUrl = null;
  let releaseUrl = null;
  let providerConfigured = false;
  let source = 'none';
  let error = null;
  let githubRepo = resolveGithubRepo(input);

  const fetchImpl = typeof input.fetchJson === 'function' ? input.fetchJson : fetchJson;

  if (manifestUrl) {
    providerConfigured = true;
    source = 'manifest';
    const result = await fetchImpl(manifestUrl);
    if (!result.ok || !result.data) {
      error = result.error || 'Could not load update manifest.';
    } else {
      const data = result.data;
      latestVersion = String(data.latestVersion || data.version || currentVersion);
      changelog = Array.isArray(data.changelog)
        ? data.changelog.join('\n')
        : String(data.changelog || data.releaseNotes || changelog);
      downloadUrl = data.downloadUrl || data.url || null;
      releaseUrl = data.releaseUrl || data.html_url || downloadUrl;
    }
  } else {
    // Default product path: GitHub Releases (no custom website required).
    providerConfigured = true;
    source = 'github';
    const gh = await fetchGithubLatestRelease({ ...input, fetchJson: fetchImpl });
    githubRepo = gh.repo;
    releaseUrl = gh.releaseUrl;
    if (!gh.ok) {
      error = gh.error;
      changelog = 'Could not reach GitHub Releases. You can still open the Releases page manually.';
    } else if (!gh.hasRelease || !gh.latestVersion) {
      latestVersion = currentVersion;
      changelog = gh.changelog;
      downloadUrl = null;
    } else {
      latestVersion = gh.latestVersion;
      changelog = gh.changelog;
      downloadUrl = gh.downloadUrl;
    }
  }

  if (homeDir && !error) {
    writeState(homeDir, {
      ...state,
      lastCheckedAt: new Date().toISOString(),
      lastManifest: {
        latestVersion,
        changelog,
        downloadUrl,
        releaseUrl,
        channel,
        source,
        githubRepo,
      },
    });
  }

  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
  const deferredUntil = state.deferredUntil || null;
  const deferredActive = Boolean(deferredUntil && hasUpdate && new Date(deferredUntil).getTime() > Date.now());
  const downloaded = Boolean(state.downloadedVersion && compareSemver(state.downloadedVersion, currentVersion) > 0);

  let message;
  if (error) {
    message = error;
  } else if (source === 'github' && !hasUpdate) {
    message = compareSemver(latestVersion, currentVersion) === 0
      ? `Desktop ${currentVersion} matches the latest GitHub release. Open Releases if you want the source/install notes.`
      : `No newer GitHub release than Desktop ${currentVersion}. Channel: github.com/${githubRepo}.`;
  } else if (hasUpdate) {
    message = source === 'github'
      ? `GitHub release ${latestVersion} is available (you are on ${currentVersion}). Open Releases or the package link to upgrade.`
      : `Version ${latestVersion} is available.`;
  } else {
    message = `Zavorth Desktop ${currentVersion} is up to date.`;
  }

  return {
    ok: !error,
    hasUpdate,
    version: currentVersion,
    latestVersion,
    changelog,
    channel: source === 'github' ? 'github' : channel,
    source,
    engine: source === 'github' ? 'github-releases' : source === 'manifest' ? 'manifest' : 'none',
    githubRepo,
    downloadUrl,
    releaseUrl: releaseUrl || githubReleasesUrl(githubRepo),
    providerConfigured,
    downloaded,
    deferredUntil: deferredActive ? deferredUntil : null,
    rollbackVersion: state.rollbackVersion || null,
    error,
    message,
  };
}

function packageMarkerPath(homeDir, version) {
  return path.join(homeDir, 'packages', `desktop-${String(version || 'unknown').replace(/[^\w.-]+/g, '_')}.json`);
}

async function openExternalUrl(url, input = {}) {
  const target = String(url || '').trim();
  if (!isAllowedExternalUrl(target)) {
    return;
  }
  if (typeof input.openExternal === 'function') {
    await input.openExternal(target);
    return;
  }
  await shell.openExternal(target);
}

async function downloadUpdate(input = {}) {
  const homeDir = input.homeDir;
  if (!homeDir) return { ok: false, error: 'Update home is not configured.' };
  const state = readState(homeDir);
  const electronUpdater = input.electronUpdater || null;

  // Phase 7: in-app download via electron-updater when enabled.
  if (electronUpdater && typeof electronUpdater.isEnabled === 'function' && electronUpdater.isEnabled()) {
    const dl = await electronUpdater.downloadUpdate();
    if (dl.ok) {
      writeState(homeDir, {
        ...state,
        downloadedVersion: dl.latestVersion || state.downloadedVersion,
        lastCheckedAt: new Date().toISOString(),
        lastManifest: {
          ...(state.lastManifest || {}),
          latestVersion: dl.latestVersion || state.lastManifest?.latestVersion || null,
          channel: 'electron-updater',
          source: 'electron-updater',
          engine: 'electron-updater',
        },
      });
      return {
        ok: true,
        mode: dl.mode || 'electron-updater-download',
        engine: 'electron-updater',
        latestVersion: dl.latestVersion || null,
        message: dl.message,
        progress: dl.progress || null,
      };
    }
    // Fall through to GitHub open if electron-updater download failed.
  }

  const check = await checkUpdates({ ...input, electronUpdater: null });

  const packagesDir = path.join(homeDir, 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });

  // Always allow opening the GitHub Releases page even when hasUpdate is false.
  const openUrl = check.downloadUrl || check.releaseUrl || githubReleasesUrl(resolveGithubRepo(input));
  const targetVersion = check.hasUpdate ? check.latestVersion : check.latestVersion || check.version;

  const marker = {
    version: targetVersion,
    channel: check.channel,
    source: check.source,
    downloadUrl: check.downloadUrl || null,
    releaseUrl: check.releaseUrl || null,
    changelog: check.changelog,
    preparedAt: new Date().toISOString(),
    mode: check.downloadUrl && check.hasUpdate ? 'opened-download' : 'opened-github-releases',
  };
  fs.writeFileSync(packageMarkerPath(homeDir, targetVersion || 'latest'), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');

  await openExternalUrl(openUrl, input);
  writeState(homeDir, {
    ...state,
    downloadedVersion: check.hasUpdate ? check.latestVersion : state.downloadedVersion,
    lastCheckedAt: new Date().toISOString(),
    lastManifest: {
      latestVersion: check.latestVersion,
      changelog: check.changelog,
      downloadUrl: check.downloadUrl,
      releaseUrl: check.releaseUrl,
      channel: check.channel,
      source: check.source,
      githubRepo: check.githubRepo,
    },
    packageMarker: packageMarkerPath(homeDir, targetVersion || 'latest'),
  });

  return {
    ok: true,
    mode: marker.mode,
    engine: check.engine || check.source,
    latestVersion: check.latestVersion,
    releaseUrl: check.releaseUrl,
    packageMarker: packageMarkerPath(homeDir, targetVersion || 'latest'),
    message: check.hasUpdate
      ? `Opened GitHub package/release for ${check.latestVersion}. Install from the browser, then use Setup if needed.`
      : `Opened GitHub Releases (${check.githubRepo}). Review tags and install notes there.`,
  };
}

function deferUpdate(input = {}) {
  const homeDir = input.homeDir;
  if (!homeDir) return { ok: false, error: 'Update home is not configured.' };
  const days = Math.max(1, Number(input.days || 7));
  const deferredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const state = readState(homeDir);
  writeState(homeDir, { ...state, deferredUntil });
  return { ok: true, deferredUntil, message: `Update deferred until ${deferredUntil}.` };
}

async function installUpdate(input = {}) {
  const homeDir = input.homeDir;
  const state = homeDir ? readState(homeDir) : {};
  const currentVersion = String(input.currentVersion || '0.1.0');
  const electronUpdater = input.electronUpdater || null;

  // Phase 7: quitAndInstall when electron-updater has a downloaded package.
  if (
    electronUpdater
    && typeof electronUpdater.isEnabled === 'function'
    && electronUpdater.isEnabled()
    && typeof electronUpdater.isDownloaded === 'function'
    && electronUpdater.isDownloaded()
  ) {
    const installed = electronUpdater.quitAndInstall(false, true);
    if (installed.ok) {
      writeState(homeDir, {
        ...state,
        rollbackVersion: currentVersion,
        downloadedVersion: null,
      });
      return {
        ok: true,
        mode: installed.mode || 'electron-updater-install',
        engine: 'electron-updater',
        message: installed.message,
        rollbackVersion: currentVersion,
        latestVersion: installed.latestVersion || state.downloadedVersion || null,
      };
    }
  }

  const target = state.downloadedVersion || state.lastManifest?.latestVersion || null;
  const allowSetupFallback = Boolean(input.allowSetupFallback);
  const releaseUrl = state.lastManifest?.releaseUrl
    || state.lastManifest?.downloadUrl
    || githubReleasesUrl(resolveGithubRepo(input));

  if ((!target || compareSemver(target, currentVersion) <= 0) && !allowSetupFallback) {
    // Still open GitHub so the user can upgrade manually — honest path without a website.
    await openExternalUrl(releaseUrl, input);
    return {
      ok: true,
      mode: 'github-releases',
      message: `No staged package ready. Opened GitHub Releases so you can install manually: ${releaseUrl}`,
      releaseUrl,
      latestVersion: target,
    };
  }

  const installTarget = target && compareSemver(target, currentVersion) > 0 ? target : null;

  if (typeof input.startSetup === 'function') {
    // Also surface the GitHub release for users who install from the repo.
    try {
      await openExternalUrl(releaseUrl, input);
    } catch {
      // ignore
    }
    const setup = await input.startSetup({
      latestVersion: installTarget,
      packageMarker: state.packageMarker || null,
      downloadUrl: state.lastManifest?.downloadUrl || releaseUrl,
    });
    writeState(homeDir, {
      ...state,
      rollbackVersion: installTarget ? currentVersion : (state.rollbackVersion || null),
      downloadedVersion: installTarget ? null : state.downloadedVersion,
    });
    return {
      ok: Boolean(setup?.ok !== false),
      mode: 'setup+github',
      message: setup?.message
        || (installTarget
          ? `Opened GitHub release and Setup for ${installTarget}. Rollback reference: ${currentVersion}.`
          : 'Opened GitHub Releases and Setup for guided upgrade.'),
      rollbackVersion: installTarget ? currentVersion : (state.rollbackVersion || null),
      latestVersion: installTarget,
      releaseUrl,
      command: setup?.command || null,
    };
  }

  await openExternalUrl(releaseUrl, input);
  writeState(homeDir, {
    ...state,
    rollbackVersion: installTarget ? currentVersion : (state.rollbackVersion || null),
    downloadedVersion: installTarget ? null : state.downloadedVersion,
  });
  return {
    ok: true,
    mode: 'github-releases',
    message: installTarget
      ? `Opened GitHub for ${installTarget}. Install from the release assets, then relaunch Desktop.`
      : 'Opened GitHub Releases for manual upgrade.',
    rollbackVersion: installTarget ? currentVersion : (state.rollbackVersion || null),
    latestVersion: installTarget,
    releaseUrl,
  };
}

function rollbackUpdate(input = {}) {
  const homeDir = input.homeDir;
  if (!homeDir) return { ok: false, error: 'Update home is not configured.' };
  const state = readState(homeDir);
  if (!state.rollbackVersion) {
    return { ok: false, error: 'No rollback version is recorded on this machine.' };
  }
  return {
    ok: true,
    rollbackVersion: state.rollbackVersion,
    releaseUrl: state.lastManifest?.releaseUrl || githubReleasesUrl(resolveGithubRepo(input)),
    message: `Rollback target is ${state.rollbackVersion}. Reinstall that package from GitHub Releases or your previous installer.`,
  };
}

async function openGithubReleases(input = {}) {
  const repo = resolveGithubRepo(input);
  const url = githubReleasesUrl(repo);
  await openExternalUrl(url, input);
  return {
    ok: true,
    repo,
    releaseUrl: url,
    message: `Opened GitHub Releases: ${url}`,
  };
}

module.exports = {
  checkUpdates,
  downloadUpdate,
  deferUpdate,
  installUpdate,
  rollbackUpdate,
  openGithubReleases,
  compareSemver,
  resolveGithubRepo,
  normalizeReleaseVersion,
  pickReleaseAsset,
  readState,
  writeState,
  DEFAULT_GITHUB_REPO,
};
