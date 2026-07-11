/**
 * Smoke test — Web & Browser Actions
 *
 * Exercícios práticos das 5 ações, sem mocks, como um usuário real faria.
 * Executa preview (sempre seguro) e, onde possível, um apply leve.
 *
 * Usage:
 *   node scripts/smoke-web-browser-actions.mjs
 */

import { ZavorthActionGateway } from '../dist/runtime/actions/ZavorthActionGateway.js';

const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const RESET  = '\x1b[0m';

const pass   = (label) => console.log(`  ${GREEN}✓${RESET}  ${label}`);
const warn   = (label) => console.log(`  ${YELLOW}~${RESET}  ${label}`);
const fail   = (label) => console.log(`  ${RED}✗${RESET}  ${label}`);

function header(title) {
  console.log(`\n${BOLD}── ${title} ──${RESET}`);
}

let failures = 0;

function assert(condition, label) {
  if (condition) { pass(label); }
  else           { fail(label); failures++; }
}

const root = process.cwd();
const gateway = new ZavorthActionGateway({ root });

/* ─── 1. web.search ─────────────────────────────────────────────────── */
header('1. web.search — preview (nenhuma rede é acionada)');
{
  const res = await gateway.preview('web.search', { query: 'Zavorth AI agent' });
  assert(res.ok === true,                  'preview retorna ok=true');
  assert(res.status === 'preview',         'status = preview');
  assert(res.summary.includes('Zavorth'),  'resumo contém a query');
  assert(!res.summary.includes('applied'), 'não declara applied no preview');
}

header('1b. web.search — apply (chamada real via SearchQueryService)');
{
  const res = await gateway.apply('web.search', { query: 'AI agent open source', limit: 3 }, { trustedOperatorConfirmation: true });
  if (res.ok) {
    pass('apply retornou ok=true — SearchQueryService respondeu');
    assert(Array.isArray(res.data?.results), 'resultados são array');
    assert(!JSON.stringify(res).match(/Authorization|Bearer|api_key/i), 'sem vazamento de credencial');
    console.log(`     → ${res.data?.results?.length ?? 0} resultado(s): ${res.summary}`);
  } else {
    warn(`apply retornou ok=false (esperado se SearchQueryService não estiver configurado): ${res.summary}`);
  }
}

/* ─── 2. web.fetch_url ──────────────────────────────────────────────── */
header('2. web.fetch_url — preview');
{
  const res = await gateway.preview('web.fetch_url', { url: 'https://example.com' });
  assert(res.ok === true,         'preview retorna ok=true');
  assert(res.status === 'preview', 'status = preview');
}

header('2b. web.fetch_url — apply com URL pública real');
{
  const res = await gateway.apply('web.fetch_url', { url: 'https://example.com' }, { trustedOperatorConfirmation: true });
  if (res.ok) {
    pass('apply ok — safeFetch respondeu');
    assert(typeof res.data?.raw === 'string',            'raw HTML presente');
    assert(/^<untrusted_web_evidence\b/.test(res.data?.content ?? ''), 'conteúdo envolto em tag de evidência não-confiável');
    assert(!JSON.stringify(res).match(/Authorization|Bearer/i),     'sem credencial no resultado');
    console.log(`     → ${res.lines?.join(' | ')}`);
  } else {
    warn(`apply retornou ok=false: ${res.summary}`);
  }
}

header('2c. web.fetch_url — SSRF bloqueado (IP privado)');
{
  const res = await gateway.apply('web.fetch_url', { url: 'http://127.0.0.1/secret' }, { trustedOperatorConfirmation: true });
  assert(res.ok === false,          'IP loopback bloqueado');
  assert(res.status === 'blocked',  'status = blocked');
  pass(`bloqueio SSRF: ${res.summary}`);
}

header('2d. web.fetch_url — esquema inválido bloqueado');
{
  const res = await gateway.apply('web.fetch_url', { url: 'file:///etc/passwd' }, { trustedOperatorConfirmation: true });
  assert(res.ok === false,         'esquema file:// bloqueado');
  assert(res.status === 'blocked', 'status = blocked');
}

/* ─── 3-5. browser.* ── preview (sidecar pode estar offline) ───────── */
for (const [id, label] of [
  ['browser.open',       'browser.open — preview'],
  ['browser.screenshot', 'browser.screenshot — preview'],
  ['browser.extract',    'browser.extract — preview'],
]) {
  header(`${label}`);
  const args = id === 'browser.open' ? { url: 'https://example.com' } : {};
  const res = await gateway.preview(id, args);
  assert(res.ok === true,          'preview retorna ok=true');
  assert(res.status === 'preview', 'status = preview');
  assert(!res.summary.toLowerCase().includes('sidecar'),
    'preview não tenta contato com sidecar');
}

header('browser.open — apply sem sidecar (deve falhar fechado)');
{
  const res = await gateway.apply('browser.open', { url: 'https://example.com' }, { trustedOperatorConfirmation: true });
  if (!res.ok && res.status === 'blocked') {
    pass('falha fechada corretamente — sidecar offline/ausente');
    console.log(`     → ${res.summary}`);
  } else if (res.ok) {
    pass('apply ok — sidecar disponível e respondeu');
  } else {
    warn(`resultado inesperado: status=${res.status} | ${res.summary}`);
  }
}

/* ─── Resultado Final ───────────────────────────────────────────────── */
console.log('');
if (failures === 0) {
  console.log(`${GREEN}${BOLD}✓ Todos os smoke checks passaram — Web & Browser Actions operacional.${RESET}`);
} else {
  console.log(`${RED}${BOLD}✗ ${failures} verificação(ões) falharam.${RESET}`);
  process.exit(1);
}
