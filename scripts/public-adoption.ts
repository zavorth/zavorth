#!/usr/bin/env node
import path from 'path';
import { PublicAdoptionReadinessService } from '../src/services/PublicAdoptionReadinessService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const websiteRoot = resolveWebsiteRoot();

const service = new PublicAdoptionReadinessService({ websiteRoot });
const snapshot = service.buildSnapshot();

if (asJson) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(`${service.renderReport(snapshot)}\n`);
}

if (requirePass && !snapshot.summary.ok) {
  process.exitCode = 1;
}

function resolveWebsiteRoot(): string {
  const inline = argv.find((arg) => arg.startsWith('--website-root='));
  const cliValue = inline ? inline.split('=').slice(1).join('=').trim() : '';
  const envValue = String(process.env.ZAVORTH_WEBSITE_REPO_ROOT || '').trim();
  return path.resolve(cliValue || envValue || path.join(process.cwd(), '..', '..', 'zavorth-website'));
}
