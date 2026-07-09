const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeApiPath,
  isAllowedNavigationUrl,
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

test('isAllowedNavigationUrl allows local and file urls only', () => {
  assert.equal(isAllowedNavigationUrl('http://127.0.0.1:5173/'), true);
  assert.equal(isAllowedNavigationUrl('http://localhost:5173/'), true);
  assert.equal(isAllowedNavigationUrl('file:///C:/app/index.html'), true);
  assert.equal(isAllowedNavigationUrl('https://example.com'), false);
  assert.equal(isAllowedNavigationUrl('not a url'), false);
});

test('validateRendererUrl accepts localhost and rejects remote hosts', () => {
  assert.equal(validateRendererUrl(''), '');
  assert.match(validateRendererUrl('http://127.0.0.1:5173'), /^http:\/\/127\.0\.0\.1:5173\/?$/);
  assert.throws(() => validateRendererUrl('https://evil.example'), /must point to localhost/);
});
