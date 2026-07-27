#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r...\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function mark(status, id, notes) {
  spawnSync(
    process.execPath,
    [
      path.join(root, 'scripts', 'dogfood-runner.mjs'),
      '--mark',
      status,
      id,
      '--notes',
      notes,
    ],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  console.log(status, id, notes);
}

function getJson(url, opts = {}) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(
      url,
      {
        method: opts.method || 'GET',
        headers: opts.headers || {},
        timeout: opts.timeout || 25000,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => {
          d += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      },
    );
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

loadEnv();
const key = process.env.GEMINI_API_KEY || '';
if (key.length < 12) {
  console.log('no gemini key');
  process.exit(1);
}

// Direct Gemini generateContent
const models = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter(Boolean);

let r = { status: 0, body: '' };
let model = models[0];
let ok = false;
for (const candidate of models) {
  model = candidate;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent...key=${encodeURIComponent(key)}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: 'Reply with exactly the token ZAVORTH_LIVE_OK and nothing else.' }] }],
    generationConfig: { maxOutputTokens: 64, temperature: 0 },
  });
  r = await getJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    timeout: 45000,
  });
  const text =
    (() => {
      try {
        const j = JSON.parse(r.body);
        return JSON.stringify(j.candidates || j);
      } catch {
        return r.body;
      }
    })();
  let modelText = '';
  try {
    const j = JSON.parse(r.body);
    modelText = String(j?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  } catch {
    modelText = '';
  }
  ok = r.status >= 200 && r.status < 300 && /ZAVORTH_LIVE_OK/.test(modelText);
  console.log('gemini try', model, 'status', r.status, 'exactToken', /ZAVORTH_LIVE_OK/.test(modelText));
  if (ok) {
    console.log('ZAVORTH_LIVE_OK');
    break;
  }
}

if (!ok) {
  console.log('snippet', r.body.slice(0, 320));
  mark('blocked', 'dogfood.chat.01', `gemini direct failed status=${r.status}`);
  process.exit(1);
}

// Exact token only — do not mark tool-calling missions from a completion probe.
mark('pass', 'dogfood.chat.01', `direct gemini live ${model} exact-token ZAVORTH_LIVE_OK`);
mark('blocked', 'dogfood.chat.03', 'needs multi-turn chat proof; only exact-token completion proven');
mark('blocked', 'dogfood.chat.04', 'needs tool-calling chat turn; only completion proven');
mark('blocked', 'dogfood.chat.05', 'single-turn completion proven; not full first-run chat product path');

// gateway optional
const port = Number(process.env.ZAVORTH_AIGateway_GATEWAY_PORT || 20128);
const gBody = JSON.stringify({
  model,
  messages: [{ role: 'user', content: 'Say ZAVORTH_LIVE_OK' }],
  max_tokens: 24,
});
const g = await getJson(`http://127.0.0.1:${port}/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(gBody) },
  body: gBody,
  timeout: 20000,
});
console.log('gateway status', g.status);
if (g.status >= 200 && g.status < 300) {
  mark('pass', 'dogfood.first-run.06', 'gateway chat path live');
}

spawnSync(process.execPath, [path.join(root, 'scripts', 'dogfood-runner.mjs'), '--summary'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  stdio: 'inherit',
});
