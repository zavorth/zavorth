#!/usr/bin/env node
import process from 'node:process';

import type {
  RemoteMeshNotebookDockerControlPreviewPayload,
  RemoteMeshNotebookDockerControlReceiptPayload,
  RemoteMeshNotebookProjectFileReadPreviewPayload,
  RemoteMeshNotebookProjectFileReadReceiptPayload,
} from '../src/contracts/RemoteMeshNotebookScopedMcpServerContract.js';
import type { RemoteMeshNotebookApprovalUxSnapshot } from '../src/contracts/RemoteMeshNotebookApprovalUxContract.js';
import { RemoteMeshNotebookApprovalUxService } from '../src/services/RemoteMeshNotebookApprovalUxService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const requirePass = args.includes('--require-pass');

main();

function main(): void {
  const snapshot = new RemoteMeshNotebookApprovalUxService().buildSnapshot({
    fixtures: [
      { source: dockerPreviewFixture(), surface: 'mobile' },
      { source: dockerReceiptFixture(), surface: 'zavorthControl' },
      { source: projectFilePreviewFixture(), surface: 'mobile' },
      { source: projectFileReceiptFixture(), surface: 'zavorthControl' },
    ],
  });
  const failures = validate(snapshot);

  if (json) {
    process.stdout.write(`${JSON.stringify({ ...snapshot, validation: { failures } }, null, 2)}\n`);
  } else {
    process.stdout.write(render(snapshot, failures));
  }

  if (requirePass && failures.length > 0) {
    process.exitCode = 1;
  }
}

function validate(snapshot: RemoteMeshNotebookApprovalUxSnapshot): string[] {
  const failures: string[] = [];
  if (snapshot.status !== 'ready') {
    failures.push('R11 approval UX snapshot is not ready');
  }
  if (!snapshot.summary.mobileReady || !snapshot.summary.zavorthControlReady) {
    failures.push('R11 must produce both mobile and ZavorthControl projections');
  }
  if (snapshot.summary.rawJsonRequiredFromUser !== false) {
    failures.push('R11 must not require raw JSON from the user');
  }
  if (snapshot.summary.rawCommandSerialized !== false || snapshot.summary.secretValuesSerialized !== false) {
    failures.push('R11 must not serialize raw commands or secrets');
  }
  if (snapshot.cards.some((card) => card.approval?.rawJsonRequiredFromUser !== false && card.state === 'approval-required')) {
    failures.push('Approval cards must provide structured apply arguments instead of raw JSON');
  }
  if (snapshot.cards.some((card) => !card.safety.noRawJsonCopyRequired || !card.safety.noRawShell)) {
    failures.push('Approval cards must keep no-raw-json and no-shell safety flags');
  }
  return failures;
}

function render(snapshot: RemoteMeshNotebookApprovalUxSnapshot, failures: string[]): string {
  const lines = [
    `Zavorth Remote Mesh R11 Approval UX: ${snapshot.status}`,
    `cards=${snapshot.summary.cards} approvals=${snapshot.summary.approvalCards} receipts=${snapshot.summary.receiptCards}`,
    `mobile=${snapshot.summary.mobileReady} zavorthControl=${snapshot.summary.zavorthControlReady}`,
    '',
  ];
  for (const card of snapshot.cards) {
    lines.push(`[${card.surface}] ${card.title}: ${card.targetLabel}`);
    if (card.approval) {
      lines.push(`  approve: ${card.approval.approvalPhrase}`);
      lines.push(`  apply: ${card.approval.applyToolName}`);
    }
    if (card.receipt) {
      lines.push(`  receipt: ${card.receipt.summary}`);
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

function dockerPreviewFixture(): RemoteMeshNotebookDockerControlPreviewPayload {
  return {
    schemaVersion: 1,
    generatedAt: '2026-05-05T19:00:00.000Z',
    toolName: 'notebook.docker.preview_control',
    approvalId: 'zdc-r11-preview',
    approvalPhrase: 'APPROVE DOCKER RESTART zavorth-app',
    expiresAt: '2026-05-05T19:02:00.000Z',
    container: 'zavorth-app',
    action: 'restart',
    risk: 'medium',
    reversible: true,
    templateLabel: 'docker-container-lifecycle',
    expectedEffect: 'Restart allowlisted Docker container zavorth-app.',
    requiresApproval: true,
    processSpawned: false,
    dockerMutationPerformed: false,
    rawCommandSerialized: false,
  };
}

function dockerReceiptFixture(): RemoteMeshNotebookDockerControlReceiptPayload {
  return {
    schemaVersion: 1,
    generatedAt: '2026-05-05T19:01:00.000Z',
    toolName: 'notebook.docker.apply_control',
    receiptId: 'zdr-r11-receipt',
    approvalId: 'zdc-r11-preview',
    container: 'zavorth-app',
    action: 'restart',
    status: 'executed',
    templateLabel: 'docker-container-lifecycle',
    processSpawned: true,
    dockerMutationPerformed: true,
    filesystemMutationPerformed: false,
    rawCommandSerialized: false,
  };
}

function projectFilePreviewFixture(): RemoteMeshNotebookProjectFileReadPreviewPayload {
  return {
    schemaVersion: 1,
    generatedAt: '2026-05-05T19:03:00.000Z',
    toolName: 'notebook.project_files.preview_read',
    approvalId: 'zfr-r11-preview',
    approvalPhrase: 'APPROVE FILE READ zavorth/README.md',
    expiresAt: '2026-05-05T19:05:00.000Z',
    project: 'zavorth',
    relativePath: 'README.md',
    sizeBytes: 2048,
    maxBytes: 65536,
    contentRisk: 'normal',
    readOnly: true,
    requiresApproval: true,
    resolvedPathLabel: 'allowlisted-project-root',
    processSpawned: false,
    filesystemMutationPerformed: false,
    rawPathSerialized: false,
    rawCommandSerialized: false,
  };
}

function projectFileReceiptFixture(): RemoteMeshNotebookProjectFileReadReceiptPayload {
  return {
    schemaVersion: 1,
    generatedAt: '2026-05-05T19:04:00.000Z',
    toolName: 'notebook.project_files.apply_read',
    receiptId: 'zfrc-r11-receipt',
    approvalId: 'zfr-r11-preview',
    project: 'zavorth',
    relativePath: 'README.md',
    encoding: 'utf8',
    content: '# Zavorth\n\nA local-first agent runtime.',
    sizeBytes: 38,
    truncated: false,
    lineCount: 2,
    readOnly: true,
    processSpawned: false,
    filesystemMutationPerformed: false,
    rawPathSerialized: false,
    rawCommandSerialized: false,
  };
}
