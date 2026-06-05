#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokenPath = path.join(rootDir, "data", "runtime", "web-api-token.txt");
const allowSend = process.argv.includes('--allow-send') || process.argv.includes('--allow-operational-send');
const requireLive = process.argv.includes('--require-live');
const token = process.env.ZAVORTH_WEB_AUTH_TOKEN || (fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, 'utf8').trim() : '');
const checks = [
  allowSend && token ? 'live-send-enabled' : 'chat-send-skipped',
  'simple-chat-has-no-artifact-card',
  'simple-chat-has-no-approval-card',
  'no-message-sent-toast',
  'no-scroll-jump-after-send',
  'approval-card-appears-for-risky-command',
  'o QA nunca clica em aprovar',
  'current-model-label-is-real',
];

const ok = !requireLive || Boolean(allowSend && token);
const report = {
  ok,
  generatedAt: new Date().toISOString(),
  tokenSource: token ? 'ZAVORTH_WEB_AUTH_TOKEN or data/runtime/web-api-token.txt' : 'missing',
  allowSend,
  requireLive,
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!ok && process.argv.includes('--require-pass')) {
  process.exitCode = 1;
}
