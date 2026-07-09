const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  sanitizeApiPath,
  isAllowedNavigationUrl,
  isAllowedExternalUrl,
  validateRendererUrl,
} = require('./api-path.cjs');

test('sanitizeApiPath accepts local API paths', () => {
  assert.equal(sanitizeApiPath('/api/experience/home'), '/api/experience/home');
  assert.equal(sanitizeApiPath('/api/v2/providers'), '/api/v2/providers');
});

test('sanitizeApiPath rejects non-api and unsafe paths', () => {
  assert.throws(() => sanitizeApiPath('/control'), /Only local Zavorth API paths/);
  assert.throws(() => sanitizeApiPath('https://evil.example/api/x'), /Only local Zavorth API paths/);
  assert.throws(() => sanitizeApiPath('/api/../secret'), /Unsafe local API path/);
  assert.throws(() => sanitizeApiPath('/api/win\\path'), /Unsafe local API path/);
  // colon scheme detection only applies at the start of the path string
  assert.throws(() => sanitizeApiPath('javascript:alert(1)'), /Only local Zavorth API paths/);
  assert.throws(() => sanitizeApiPath('http://localhost/api/x'), /Only local Zavorth API paths/);
});

test('isAllowedNavigationUrl allows local loopback http(s) only', () => {
  assert.equal(isAllowedNavigationUrl('http://127.0.0.1:5173/'), true);
  assert.equal(isAllowedNavigationUrl('http://localhost:5173/'), true);
  assert.equal(isAllowedNavigationUrl('https://example.com'), false);
  assert.equal(isAllowedNavigationUrl('not a url'), false);
  assert.equal(isAllowedNavigationUrl('javascript:alert(1)'), false);
});

test('isAllowedNavigationUrl restricts file: to allowedFileRoots', () => {
  const distRoot = path.resolve('/app/dist');
  const inside = pathToFileURL(path.join(distRoot, 'index.html')).href;
  const outside = pathToFileURL(path.resolve('/tmp/evil.html')).href;

  // Without roots — deny all file:
  assert.equal(isAllowedNavigationUrl(inside), false);
  assert.equal(isAllowedNavigationUrl('file:///C:/app/index.html'), false);

  assert.equal(
    isAllowedNavigationUrl(inside, { allowedFileRoots: [distRoot] }),
    true,
  );
  assert.equal(
    isAllowedNavigationUrl(outside, { allowedFileRoots: [distRoot] }),
    false,
  );
  // Path traversal outside roots
  const traversal = pathToFileURL(path.join(distRoot, '..', 'secret.txt')).href;
  assert.equal(
    isAllowedNavigationUrl(traversal, { allowedFileRoots: [distRoot] }),
    false,
  );
});

test('isAllowedExternalUrl allows only http(s) and mailto', () => {
  assert.equal(isAllowedExternalUrl('https://example.com/docs'), true);
  assert.equal(isAllowedExternalUrl('http://example.com'), true);
  assert.equal(isAllowedExternalUrl('mailto:user@example.com'), true);
  assert.equal(isAllowedExternalUrl('file:///C:/Windows/System32/cmd.exe'), false);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('data:text/html,hi'), false);
  assert.equal(isAllowedExternalUrl('ms-windows-store://pdp/?productid=x'), false);
  assert.equal(isAllowedExternalUrl(''), false);
  assert.equal(isAllowedExternalUrl('not a url'), false);
});

test('validateRendererUrl accepts localhost and rejects remote hosts', () => {
  assert.equal(validateRendererUrl(''), '');
  assert.match(validateRendererUrl('http://127.0.0.1:5173'), /^http:\/\/127\.0\.0\.1:5173\/?$/);
  assert.throws(() => validateRendererUrl('https://evil.example'), /must point to localhost/);
});
