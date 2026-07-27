const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('uses a transparent title bar overlay without the Windows frame fallback', () => {
  const source = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');

  assert.match(source, /TITLEBAR_OVERLAY_COLOR\s*=\s*'rgba\(1, 0, 0, 0\)'/);
  assert.match(source, /color:\s*TITLEBAR_OVERLAY_COLOR/);
  assert.doesNotMatch(source, /color:\s*'#00000000'/);
});
