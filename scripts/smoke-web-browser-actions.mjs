/**
 * Smoke test for Web and Browser Actions.
 *
 * Exercises the actions without mocks. Preview is always safe; apply is only
 * used where the gateway already supports a safe, bounded real call.
 *
 * Usage:
 *   node scripts/smoke-web-browser-actions.mjs
 */

import { ZavorthActionGateway } from '../dist/runtime/actions/ZavorthActionGateway.js';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const pass = (label) => console.log(`  ${GREEN}OK${RESET}  ${label}`);
const warn = (label) => console.log(`  ${YELLOW}~${RESET}  ${label}`);
const fail = (label) => console.log(`  ${RED}FAIL${RESET}  ${label}`);

function header(title) {
  console.log(`\n${BOLD}-- ${title} --${RESET}`);
}

let failures = 0;

function assert(condition, label) {
  if (condition) {
    pass(label);
  } else {
    fail(label);
    failures++;
  }
}

const root = process.cwd();
const gateway = new ZavorthActionGateway({ root });

header('1. web.search - preview');
{
  const res = await gateway.preview('web.search', { query: 'Zavorth AI agent' });
  assert(res.ok === true, 'preview returns ok=true');
  assert(res.status === 'preview', 'status = preview');
  assert(res.summary.includes('Zavorth'), 'summary contains the query');
  assert(!res.summary.includes('applied'), 'does not declare applied in preview');
}

header('1b. web.search - apply through SearchQueryService');
{
  const res = await gateway.apply('web.search', { query: 'AI agent open source', limit: 3 }, { trustedOperatorConfirmation: true });
  if (res.ok) {
    pass('apply returned ok=true; SearchQueryService responded');
    assert(Array.isArray(res.data?.results), 'results are an array');
    assert(!JSON.stringify(res).match(/Authorization|Bearer|api_key/i), 'no credential leak');
    console.log(`     -> ${res.data?.results?.length ?? 0} result(s): ${res.summary}`);
  } else {
    warn(`apply returned ok=false, expected when SearchQueryService is not configured: ${res.summary}`);
  }
}

header('2. web.fetch_url - preview');
{
  const res = await gateway.preview('web.fetch_url', { url: 'https://example.com' });
  assert(res.ok === true, 'preview returns ok=true');
  assert(res.status === 'preview', 'status = preview');
}

header('2b. web.fetch_url - apply with a real public URL');
{
  const res = await gateway.apply('web.fetch_url', { url: 'https://example.com' }, { trustedOperatorConfirmation: true });
  if (res.ok) {
    pass('apply ok; safeFetch responded');
    assert(typeof res.data?.raw === 'string', 'raw HTML present');
    assert(/^<untrusted_web_evidence\b/.test(res.data?.content ?? ''), 'content is wrapped in an untrusted evidence tag');
    assert(!JSON.stringify(res).match(/Authorization|Bearer/i), 'no credential in result');
    console.log(`     -> ${res.lines?.join(' | ')}`);
  } else {
    warn(`apply returned ok=false: ${res.summary}`);
  }
}

header('2c. web.fetch_url - private IP blocked');
{
  const res = await gateway.apply('web.fetch_url', { url: 'http://127.0.0.1:1' }, { trustedOperatorConfirmation: true });
  assert(res.ok === false, 'private IP is blocked');
}

for (const [action, title] of [
  ['browser.open', 'browser.open - preview'],
  ['browser.screenshot', 'browser.screenshot - preview'],
  ['browser.extract', 'browser.extract - preview'],
]) {
  header(title);
  const res = await gateway.preview(action, { url: 'https://example.com' });
  assert(res.status === 'preview', `${action} stays in preview`);
}

header('browser.open - apply without sidecar');
{
  const res = await gateway.apply('browser.open', { url: 'https://example.com' }, { trustedOperatorConfirmation: true });
  if (!res.ok) {
    pass('failed closed correctly; sidecar offline or absent');
    console.log(`     -> ${res.summary}`);
  } else {
    warn('browser sidecar is online; apply succeeded');
  }
}

header('Final result');
if (failures === 0) {
  console.log(`${GREEN}${BOLD}OK All smoke checks passed for Web and Browser Actions.${RESET}`);
} else {
  console.error(`${RED}${BOLD}FAIL ${failures} smoke check(s) failed.${RESET}`);
  process.exitCode = 1;
}
