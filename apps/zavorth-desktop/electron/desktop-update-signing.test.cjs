const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveSigningStatus,
  buildElectronBuilderSigningFields,
} = require('./desktop-update-signing.cjs');

test('signing status is honest when no certs are configured', () => {
  const status = resolveSigningStatus({});
  assert.equal(status.contractVersion, 'desktop-update-signing/1');
  assert.equal(status.shippingReady, false);
  assert.equal(status.windows.configured, false);
  assert.match(status.message, /unsigned|not configured/i);
  assert.ok(status.electronBuilderHints.env.length >= 4);
});

test('windows ready when CSC_LINK + password present', () => {
  const status = resolveSigningStatus({
    CSC_LINK: 'C:\\certs\\code-sign.pfx',
    CSC_KEY_PASSWORD: 'secret',
  });
  assert.equal(status.windows.readyToSign, true);
  assert.equal(status.shippingReady, true);
});

test('mac notarize ready requires Apple credentials', () => {
  const partial = resolveSigningStatus({
    CSC_LINK: '/certs/dev-id.p12',
    CSC_KEY_PASSWORD: 'x',
  });
  assert.equal(partial.mac.notarizeReady, false);

  const full = resolveSigningStatus({
    CSC_LINK: '/certs/dev-id.p12',
    CSC_KEY_PASSWORD: 'x',
    APPLE_ID: 'dev@example.com',
    APPLE_APP_SPECIFIC_PASSWORD: 'aaaa-bbbb-cccc-dddd',
    APPLE_TEAM_ID: 'TEAM123',
  });
  assert.equal(full.mac.notarizeReady, true);
  assert.equal(full.shippingReady, true);
});

test('electron-builder signing fields include github publish + entitlements', () => {
  const fields = buildElectronBuilderSigningFields();
  assert.equal(fields.publish[0].provider, 'github');
  assert.equal(fields.mac.entitlements, 'build/entitlements.mac.plist');
  assert.deepEqual(fields.win.signtoolOptions.signingHashAlgorithms, ['sha256']);
});
