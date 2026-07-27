/**
 * Phase 7 — Installer code-signing configuration helpers.
 *
 * electron-builder reads standard env vars at package time:
 *   Windows: CSC_LINK / CSC_KEY_PASSWORD (or WIN_CSC_LINK)
 *   macOS:   CSC_LINK + Apple notarization (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID)
 *
 * This module never invents certificates — it only reports whether shipping
 * signing is configured and documents the expected layout for CI.
 */

function resolveSigningStatus(env = process.env) {
  const winLink = firstEnv(env, ['WIN_CSC_LINK', 'CSC_LINK']);
  const winPassword = firstEnv(env, ['WIN_CSC_KEY_PASSWORD', 'CSC_KEY_PASSWORD']);
  const macLink = firstEnv(env, ['CSC_LINK', 'MAC_CSC_LINK']);
  const appleId = firstEnv(env, ['APPLE_ID']);
  const applePassword = firstEnv(env, ['APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_PASSWORD']);
  const appleTeam = firstEnv(env, ['APPLE_TEAM_ID']);
  const autoDiscovery = String(env.CSC_IDENTITY_AUTO_DISCOVERY || 'true').toLowerCase() !== 'false';

  const windows = {
    platform: 'win32',
    configured: Boolean(winLink),
    hasPassword: Boolean(winPassword),
    autoDiscovery,
    readyToSign: Boolean(winLink && (winPassword || !needsPassword(winLink))),
    timestampServer: env.RFC3161_TIMESTAMP_URL
      || 'http://timestamp.digicert.com',
    notes: winLink ? 'Windows authenticode cert path/base64 present (CSC_LINK / WIN_CSC_LINK).'
      : 'No Windows cert configured. electron-builder will produce unsigned installers.',
  };

  const notarizeReady = Boolean(appleId && applePassword && appleTeam);
  const mac = {
    platform: 'darwin',
    configured: Boolean(macLink) || autoDiscovery,
    notarizeReady,
    appleIdConfigured: Boolean(appleId),
    teamIdConfigured: Boolean(appleTeam),
    readyToSign: Boolean(macLink) || autoDiscovery,
    notes: notarizeReady ? 'macOS signing + notarization env present.'
      : (macLink || autoDiscovery ? 'macOS identity may sign; set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID to notarize.'
        : 'No macOS signing identity configured.'),
  };

  const shippingReady = windows.readyToSign || (Boolean(macLink) && notarizeReady);
  return {
    contractVersion: 'desktop-update-signing/1',
    shippingReady,
    windows,
    mac,
    electronBuilderHints: {
      publishProvider: 'github',
      env: [
        'GH_TOKEN or GITHUB_TOKEN — publish artifacts to GitHub Releases',
        'CSC_LINK / CSC_KEY_PASSWORD — code sign (pfx/p12 path or base64)',
        'WIN_CSC_LINK — Windows-only cert override',
        'APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID — notarize',
        'ZAVORTH_UPDATE_FEED_URL — optional generic feed instead of GitHub provider',
        'ZAVORTH_UPDATE_DISABLE_ELECTRON_UPDATER=true — force GitHub-manual channel',
      ],
      packageScripts: {
        dir: 'npm run package:dir',
        publishNever: 'npm run package:release',
        publishAlways: 'npm run package:publish',
      },
    },
    message: shippingReady ? 'At least one platform has signing material configured for installer builds.'
      : 'Signing not configured — installers will be unsigned (OK for local smoke; required for shipping).',
  };
}

function firstEnv(env, keys) {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function needsPassword(link) {
  // File paths to .pfx/.p12 typically need a password; pure identity names may not.
  const value = String(link || '').toLowerCase();
  return value.includes('.pfx') || value.includes('.p12') || value.length > 200;
}

function buildElectronBuilderSigningFields() {
  // Static config fragments for package.json documentation / merge helpers.
  // electron-builder 26+: Windows signtool fields live under signtoolOptions
  return {
    win: {
      signExecutable: false,
      signtoolOptions: {
        signingHashAlgorithms: ['sha256'],
        rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      },
    },
    mac: {
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: 'build/entitlements.mac.plist',
      entitlementsInherit: 'build/entitlements.mac.plist',
    },
    publish: [
      {
        provider: 'github',
        owner: 'zavorth',
        repo: 'zavorth',
        releaseType: 'release',
      },
    ],
  };
}

// CLI: node electron/desktop-update-signing.cjs
if (require.main === module) {
  const status = resolveSigningStatus(process.env);
  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
}

module.exports = {
  resolveSigningStatus,
  buildElectronBuilderSigningFields,
};
