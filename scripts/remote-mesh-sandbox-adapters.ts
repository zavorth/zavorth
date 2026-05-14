#!/usr/bin/env node
import process from 'node:process';

import type { RemoteMeshSandboxAdapterSnapshot } from '../src/contracts/RemoteMeshSandboxAdapterContract.js';
import { RemoteMeshSandboxAdapterDryRunService } from '../src/services/RemoteMeshSandboxAdapterDryRunService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');

const snapshot = new RemoteMeshSandboxAdapterDryRunService().buildSnapshot();
const failures = validateSnapshot(snapshot);

if (json) {
  process.stdout.write(`${JSON.stringify({ ...snapshot, validation: { failures } }, null, 2)}\n`);
} else {
  process.stdout.write(render(snapshot, failures));
}

if (requirePass && failures.length > 0) {
  process.exitCode = 1;
}

function validateSnapshot(snapshot: RemoteMeshSandboxAdapterSnapshot): string[] {
  const failures: string[] = [];

  if (snapshot.status !== 'adapter-dry-run-ready') {
    failures.push(`snapshot status is ${snapshot.status}`);
  }
  if (snapshot.summary.remoteExecutionPerformed !== false) {
    failures.push('R3 must not execute remote actions');
  }
  if (snapshot.summary.liveNetworkCallPerformed !== false) {
    failures.push('R3 must not perform live network calls');
  }
  if (snapshot.summary.remoteProcessSpawned !== false) {
    failures.push('R3 must not spawn remote processes');
  }
  if (snapshot.summary.filesystemMutationPerformed !== false) {
    failures.push('R3 must not mutate filesystem');
  }
  if (snapshot.summary.rawCommandSerialized !== false) {
    failures.push('R3 must not serialize raw commands');
  }
  if (snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R3 must not serialize secrets');
  }

  if (snapshot.summary.mcpDryRuns < 1) {
    failures.push('R3 must include at least one MCP dry-run binding');
  }
  if (snapshot.summary.sshWrapperDryRuns < 1) {
    failures.push('R3 must include at least one SSH wrapper dry-run binding');
  }
  if (snapshot.summary.termuxProotDryRuns < 1) {
    failures.push('R3 must include at least one Termux/PRoot dry-run binding');
  }

  for (const binding of snapshot.bindings) {
    if (binding.preview.rawCommand !== null || binding.preview.adapterCall.rawCommand !== null) {
      failures.push(`${binding.id} exposes a raw command`);
    }
    if (binding.receipt.rawCommandSerialized !== false) {
      failures.push(`${binding.id} receipt serializes raw command`);
    }
    if (binding.receipt.mutationPerformed) {
      failures.push(`${binding.id} reports mutation`);
    }
    if (!binding.guards.noLiveNetworkCall || !binding.guards.noRemoteProcessSpawn || !binding.guards.noFilesystemMutation) {
      failures.push(`${binding.id} is missing dry-run guards`);
    }
    if (binding.adapter === 'ssh-wrapper-dry-run' && !binding.commandTemplateId) {
      failures.push(`${binding.id} SSH wrapper lacks commandTemplateId`);
    }
    if (binding.adapter === 'mcp-dry-run' && !binding.mcpToolName) {
      failures.push(`${binding.id} MCP dry-run lacks mcpToolName`);
    }
  }

  const serialized = JSON.stringify(snapshot);
  if (/sk-[A-Za-z0-9_-]{12,}/.test(serialized) || /xox[baprs]-[A-Za-z0-9-]{12,}/.test(serialized)) {
    failures.push('snapshot contains secret-looking values');
  }

  return failures;
}

function render(snapshot: RemoteMeshSandboxAdapterSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R3: ${snapshot.status}`,
    `bindings=${snapshot.summary.bindings} ready=${snapshot.summary.ready} approvals=${snapshot.summary.approvalRequired} blocked=${snapshot.summary.blocked}`,
    `mcp=${snapshot.summary.mcpDryRuns} sshWrapper=${snapshot.summary.sshWrapperDryRuns} termux=${snapshot.summary.termuxProotDryRuns} policyBlocks=${snapshot.summary.policyBlocks}`,
    '',
  ];

  for (const binding of snapshot.bindings) {
    lines.push(`[${binding.status}] ${binding.adapter} ${binding.actionId} -> ${binding.preview.adapterCall.name}`);
  }

  if (failures.length > 0) {
    lines.push('', 'Failures:');
    failures.forEach((failure) => lines.push(`- ${failure}`));
  } else {
    lines.push('', 'Validation: passed');
  }

  return `${lines.join('\n')}\n`;
}
