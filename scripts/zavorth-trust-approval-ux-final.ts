#!/usr/bin/env tsx
import { ZavorthTrustApprovalUxFinalService } from '../src/services/ZavorthTrustApprovalUxFinalService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const command = args.find((arg) => !arg.startsWith('--')) || 'status';
const service = new ZavorthTrustApprovalUxFinalService();

if (command === 'revoke-all') {
  const result = service.revokeAll({
    confirm: args.includes('--confirm-revoke-all'),
    reason: readFlag(args, 'reason') || 'Owner revoked all persistent approval policies from Trust UX CLI.',
  });
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(result.snapshot)}\n${result.revokeResult.reason}\n`);
  }
  process.exit(result.revokeResult.allowed ? 0 : 1);
}

const snapshot = service.buildSnapshot({
  limit: Number(readFlag(args, 'limit') || 8),
});

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(service.renderText(snapshot));
}

function readFlag(values: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = values.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = values.indexOf(`--${name}`);
  if (index >= 0 && values[index + 1] && !values[index + 1].startsWith('--')) {
    return values[index + 1];
  }
  return null;
}
