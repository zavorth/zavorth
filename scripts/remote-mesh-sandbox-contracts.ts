#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxContractSnapshot } from '../src/contracts/RemoteMeshSandboxContract.js';
import { RemoteMeshSandboxContractService } from '../src/services/RemoteMeshSandboxContractService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');

const snapshot = new RemoteMeshSandboxContractService().buildSnapshot();
const failures = validateSnapshot(snapshot);

if (json) {
  process.stdout.write(`${JSON.stringify({ ...snapshot, validation: { failures } }, null, 2)}\n`);
} else {
  process.stdout.write(render(snapshot, failures));
}

if (requirePass && failures.length > 0) {
  process.exitCode = 1;
}

function validateSnapshot(snapshot: RemoteMeshSandboxContractSnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.status !== 'contract-ready') {
    failures.push(`snapshot status is ${snapshot.status}`);
  }
  if (snapshot.summary.remoteExecutionPerformed !== false) {
    failures.push('R1 snapshot must not perform remote execution');
  }
  if (snapshot.summary.freeformShellAllowed !== false) {
    failures.push('R1 snapshot must deny freeform shell');
  }
  if (snapshot.summary.unauthenticatedMcpAllowed !== false) {
    failures.push('R1 snapshot must deny unauthenticated MCP');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R1 snapshot must not serialize secrets');
  }

  for (const node of snapshot.nodes) {
    if (node.authorityBoundary.sudoAllowed) {
      failures.push(`${node.id} allows sudo`);
    }
    if (node.authorityBoundary.freeformShellAllowed) {
      failures.push(`${node.id} allows freeform shell`);
    }
    if (node.authorityBoundary.unauthenticatedMcpAllowed) {
      failures.push(`${node.id} allows unauthenticated MCP`);
    }
  }

  for (const tool of snapshot.tools) {
    if (tool.freeformShellAllowed || tool.rawCommandAllowed || tool.sudoAllowed) {
      failures.push(`${tool.id} violates authority boundaries`);
    }
    if (!tool.audit.receiptRequired) {
      failures.push(`${tool.id} does not require receipts`);
    }
  }

  for (const receipt of snapshot.receipts) {
    if (!receipt.noSecretsSerialized) {
      failures.push(`${receipt.id} serializes secrets`);
    }
    if (receipt.rawCommandSerialized !== false) {
      failures.push(`${receipt.id} serializes raw commands`);
    }
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxContractSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R1: ${snapshot.status}`,
    `nodes=${snapshot.summary.nodes} tools=${snapshot.summary.tools} actions=${snapshot.summary.sampleActions} decisions=${snapshot.summary.policyDecisions} receipts=${snapshot.summary.receipts}`,
    `remoteExecutionPerformed=${snapshot.summary.remoteExecutionPerformed} freeformShellAllowed=${snapshot.summary.freeformShellAllowed}`,
    '',
  ];

  snapshot.policyDecisions.forEach((decision) => {
    lines.push(`[${decision.status}] ${decision.actionId}: ${decision.safeNextAction}`);
  });

  if (failures.length > 0) {
    lines.push('', 'Failures:');
    failures.forEach((failure) => lines.push(`- ${failure}`));
  } else {
    lines.push('', 'Validation: passed');
  }

  return `${lines.join('\n')}\n`;
}
