#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import {
  ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE,
  ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION,
  ZavorthPersistentApprovalPolicyService,
  type ZavorthPersistentApprovalRisk,
} from '../src/services/ZavorthPersistentApprovalPolicyService.js';

const args = process.argv.slice(2);
const service = new ZavorthPersistentApprovalPolicyService();
const action = String(args[0] || 'list').trim().toLowerCase();

try {
  if (['grant', 'allow', 'permit', 'permito-sempre'].includes(action)) {
    const policy = service.grant({
      surface: readFlag(args, 'surface') || 'skill-curator-live-loop',
      label: readFlag(args, 'label') || undefined,
      actions: readListFlag(args, 'action'),
      maxRisk: (readFlag(args, 'max-risk') || 'low') as ZavorthPersistentApprovalRisk,
      allowDestructivePreview: args.includes('--allow-destructive-preview'),
      ttlDays: args.includes('--no-expiry') ? null : Number(readFlag(args, 'ttl-days') || 30),
      createdBy: readFlag(args, 'created-by') || 'owner',
      reason: readFlag(args, 'reason') || 'Reusable approval granted by owner.',
    });
    output(policy);
  } else if (['break-glass', 'modo-extremo', 'responsabilidade-total'].includes(action)) {
    const policy = service.grantBreakGlass({
      surface: readFlag(args, 'surface') || 'operator-break-glass',
      label: readFlag(args, 'label') || undefined,
      actions: readListFlag(args, 'action'),
      maxRisk: (readFlag(args, 'max-risk') || 'high') as ZavorthPersistentApprovalRisk,
      allowDestructivePreview: !args.includes('--no-destructive-preview'),
      ttlHours: Number(readFlag(args, 'ttl-hours') || 24),
      createdBy: readFlag(args, 'created-by') || 'owner',
      reason: readFlag(args, 'reason') || 'Governed break glass mode activated by owner.',
      confirmationPhrase: readFlag(args, 'confirm-phrase') || '',
      secondConfirmation: readFlag(args, 'confirm-again') || '',
      acknowledgeHardStops: args.includes('--acknowledge-hard-stops'),
    });
    output(policy);
  } else if (['revoke', 'disable'].includes(action)) {
    const policyId = readFlag(args, 'id') || args[1] || '';
    const revoked = service.revoke(policyId);
    output({ surface: 'persistent-approval-policy', action: 'revoke', policyId, revoked });
    if (!revoked) process.exitCode = 1;
  } else {
    output(service.buildSnapshot());
  }
} catch (error: unknown) {
  const err = asErrorLike(error);
  console.error('[zavorth-persistent-approval-policy] failed');
  console.error(error instanceof Error ? error.message : String(error));
  if (['break-glass', 'modo-extremo', 'responsabilidade-total'].includes(action)) {
    console.error(`Required --confirm-phrase "${ZAVORTH_BREAK_GLASS_CONFIRMATION_PHRASE}"`);
    console.error(`Required --confirm-again "${ZAVORTH_BREAK_GLASS_SECOND_CONFIRMATION}"`);
    console.error('Required --acknowledge-hard-stops');
  }
  process.exitCode = 1;
}

function output(value: unknown): void {
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (value && typeof value === 'object' && 'policies' in value) {
    process.stdout.write(service.renderText(value as any));
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function readListFlag(argv: string[], name: string): string[] {
  const values: string[] = [];
  const prefix = `--${name}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith(prefix)) {
      values.push(...arg.slice(prefix.length).split(','));
    } else if (arg === `--${name}` && argv[index + 1]) {
      values.push(...argv[index + 1].split(','));
      index += 1;
    }
  }
  return values.map((value) => value.trim()).filter(Boolean);
}
