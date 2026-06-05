import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

for (const file of [
  'assets/zavorth-control/index.html',
  'assets/zavorth-control/scripts/app.js',
  'assets/zavorth-control/styles/chat.css',
]) {
  if (!existsSync(path.join(root, file))) {
    throw new Error(`missing ${file}`);
  }
}

const html = readFileSync(path.join(root, 'assets/zavorth-control/index.html'), 'utf8');
const app = readFileSync(path.join(root, 'assets/zavorth-control/scripts/app.js'), 'utf8');
const css = readFileSync(path.join(root, 'assets/zavorth-control/styles/chat.css'), 'utf8');

for (const marker of [
  'data-profile="business"',
  'data-mission="business-audit"',
  'Run audit',
  'Use Business mode and run a governed audit.',
]) {
  if (!html.includes(marker)) {
    throw new Error(`business flow html marker missing: ${marker}`);
  }
}

for (const marker of [
  'shouldHandleBusinessAuditFlow',
  'renderBusinessAuditFlow',
  'buildBusinessAuditCards',
  'Business audit receipt',
  'Primary approval channel: ZavorthControl inbox.',
  'TTL',
  'Blocked actions',
  'Approver',
  'policy summary, scope, TTL, blocked actions, decision trace',
  'Business approval channel confirmed',
]) {
  if (!app.includes(marker)) {
    throw new Error(`business flow app marker missing: ${marker}`);
  }
}

for (const marker of [
  '.business-flow-grid',
  '.business-flow-card',
  '.business-flow-actions',
  '.business-flow-facts',
  '.business-flow-receipt',
]) {
  if (!css.includes(marker)) {
    throw new Error(`business flow style marker missing: ${marker}`);
  }
}

console.log('[zavorth-business-flow-check] ok');
