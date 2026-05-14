#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxPolicySnapshot } from '../src/contracts/RemoteMeshSandboxPolicyContract.js';
import { RemoteMeshSandboxPolicyService } from '../src/services/RemoteMeshSandboxPolicyService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');

const snapshot = new RemoteMeshSandboxPolicyService().buildSnapshot();
const failures = validateSnapshot(snapshot);

if (json) {
  process.stdout.write(`${JSON.stringify({ ...snapshot, validation: { failures } }, null, 2)}\n`);
} else {
  process.stdout.write(render(snapshot, failures));
}

if (requirePass && failures.length > 0) {
  process.exitCode = 1;
}

function validateSnapshot(snapshot: RemoteMeshSandboxPolicySnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.status !== 'policy-ready') {
    failures.push(`snapshot status is ${snapshot.status}`);
  }
  if (snapshot.summary.remoteExecutionPerformed !== false) {
    failures.push('R2 must not execute remote actions');
  }
  if (snapshot.summary.freeformShellAllowed !== false) {
    failures.push('R2 must deny freeform shell');
  }
  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R2 must not serialize raw commands');
  }
  if (snapshot.summary.unauthenticatedMcpAllowed !== false) {
    failures.push('R2 must deny unauthenticated MCP');
  }

  const ruleToolIds = new Set(snapshot.catalog.rules.map((rule) => rule.toolId));
  for (const tool of snapshot.tools) {
    if (!ruleToolIds.has(tool.id)) {
      failures.push(`${tool.id} has no policy rule`);
    }
    if (tool.freeformShellAllowed || tool.rawCommandAllowed || tool.sudoAllowed) {
      failures.push(`${tool.id} exposes unsafe authority`);
    }
  }

  for (const rule of snapshot.catalog.rules) {
    if (rule.parameterMode !== 'schema-only') {
      failures.push(`${rule.id} is not schema-only`);
    }
    if (!rule.receiptRequired) {
      failures.push(`${rule.id} does not require receipts`);
    }
  }

  for (const template of snapshot.catalog.commandTemplates) {
    if (!template.rawShellForbidden || !template.shellEscapingRequired || !template.dryRunOnlyInR2) {
      failures.push(`${template.id} is not a safe R2 template`);
    }
  }

  for (const binding of snapshot.catalog.mcpBindings) {
    if (!binding.requiresAuth || !binding.schemaLocked) {
      failures.push(`${binding.toolId} MCP binding is not authenticated/schema-locked`);
    }
  }

  for (const evaluation of snapshot.evaluations) {
    if (evaluation.preview.rawCommand !== null) {
      failures.push(`${evaluation.id} exposes a raw command preview`);
    }
    if (!evaluation.policy.noRemoteExecutionInPolicyEvaluation) {
      failures.push(`${evaluation.id} does not assert no remote execution`);
    }
    if (evaluation.status === 'allowed' && evaluation.violations.some((item) => item.severity === 'blocker')) {
      failures.push(`${evaluation.id} is allowed despite blocker violations`);
    }
  }

  for (const receipt of snapshot.receipts) {
    if (receipt.rawCommandSerialized !== false) {
      failures.push(`${receipt.id} serializes a raw command`);
    }
    if (!receipt.noSecretsSerialized) {
      failures.push(`${receipt.id} serializes secrets`);
    }
    if (receipt.mutationPerformed) {
      failures.push(`${receipt.id} reports mutation during R2`);
    }
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxPolicySnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R2: ${snapshot.status}`,
    `rules=${snapshot.summary.rules} templates=${snapshot.summary.commandTemplates} mcpBindings=${snapshot.summary.mcpBindings}`,
    `allowed=${snapshot.summary.allowed} approvals=${snapshot.summary.requiresApproval} clarification=${snapshot.summary.needsClarification} denied=${snapshot.summary.denied}`,
    '',
  ];

  for (const evaluation of snapshot.evaluations) {
    lines.push(`[${evaluation.status}] ${evaluation.actionId}: ${evaluation.safeNextAction}`);
    for (const violation of evaluation.violations.filter((item) => item.severity !== 'info')) {
      lines.push(`  ${violation.severity}: ${violation.code} ${violation.message}`);
    }
  }

  if (failures.length > 0) {
    lines.push('', 'Failures:');
    failures.forEach((failure) => lines.push(`- ${failure}`));
  } else {
    lines.push('', 'Validation: passed');
  }

  return `${lines.join('\n')}\n`;
}
