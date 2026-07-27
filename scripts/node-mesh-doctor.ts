#!/usr/bin/env node

import type { NodeMeshDoctorIssue, NodeMeshRecoveryAction } from '../src/contracts/NodeMeshContract.js';
import { ZavorthNodeMeshService } from '../src/services/ZavorthNodeMeshService.js';
import { NodeCapabilityService } from '../src/services/NodeCapabilityService.js';
import { NodeInvokeService } from '../src/services/NodeInvokeService.js';
import { NodeInvocationStoreService } from '../src/services/NodeInvocationStoreService.js';
import { NodePairingService } from '../src/services/NodePairingService.js';
import { NodeRegistryService } from '../src/services/NodeRegistryService.js';
import { NodeMeshRecoveryService } from '../src/services/NodeMeshRecoveryService.js';

function getOptionValue(argv: string[], name: string): string | null {
  const directPrefix = `${name}=`;
  const direct = argv.find((entry) => entry.startsWith(directPrefix));
  if (direct) {
    return direct.slice(directPrefix.length);
  }

  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0) {
    return argv[index + 1] || null;
  }

  return null;
}

function mapIssueToRecoverKind(issue: NodeMeshDoctorIssue | null | undefined): NodeMeshRecoveryAction['kind'] | null {
  if (issue?.recoverKind) {
    return issue.recoverKind;
  }
  switch (issue?.kind) {
    case 'expired-pairing-draft':
      return 'regenerate-pairing-draft';
    case 'stale-claimed-queue':
    case 'stale-queue-debt':
      return 'release-stale-claims';
    default:
      return null;
  }
}

function createRecoveryService(): NodeMeshRecoveryService {
  const registryService = new NodeRegistryService();
  const capabilityService = new NodeCapabilityService();
  const nodeInvokeService = new NodeInvokeService({
    registryService,
    capabilityService,
  });
  const nodePairingService = new NodePairingService({
    registryService,
    capabilityService,
  });
  const nodeMeshService = new ZavorthNodeMeshService({
    registryService,
    capabilityService,
    invokeService: nodeInvokeService,
  });

  return new NodeMeshRecoveryService({
    nodeMeshService,
    nodePairingService,
    nodeInvokeService,
  });
}

function buildPrunePreview(
  registryService: NodeRegistryService,
  nodeInvokeService: NodeInvokeService,
  olderThanMs: number,
  requestedNodeId?: string | null,
) {
  const nowMs = Date.now();
  const requested = String(requestedNodeId || '').trim().toLowerCase() || null;
  const candidates = registryService.listNodes()
    .filter((entry) => !requested || entry.id === requested)
    .filter((entry) => entry.pairingStatus === 'revoked')
    .filter((entry) => entry.paired !== true)
    .filter((entry) => entry.status === 'blocked' || entry.status === 'offline')
    .filter((entry) => !entry.lastSeenAt)
    .map((entry) => {
      const referenceAt = Date.parse(entry.updatedAt || entry.createdAt || '');
      const ageMs = Number.isFinite(referenceAt)
        ? Math.max(0, nowMs - referenceAt)
        : Number.POSITIVE_INFINITY;
      const queue = nodeInvokeService.summarizeNodeQueue(entry.id);
      const eligible = ageMs >= olderThanMs && queue.pending === 0 && queue.claimed === 0;
      const blockedReason = ageMs < olderThanMs ? 'recent'
        : ((queue.pending > 0 || queue.claimed > 0) ? 'active-queue' : null);
      return {
        id: entry.id,
        label: entry.label,
        ageMs,
        queue,
        eligible,
        blockedReason,
      };
    });

  return {
    checkedAt: new Date().toISOString(),
    thresholdDays: Math.max(1, Math.floor(olderThanMs / (1000 * 60 * 60 * 24))),
    eligible: candidates.filter((entry) => entry.eligible),
    blocked: candidates.filter((entry) => !entry.eligible),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const runRepair = argv.includes('--repair');
  const runRepairAll = argv.includes('--repair-all');
  const runPruneHistory = argv.includes('--prune-history') || argv.includes('--prune-revoked-history');
  const recoveryService = createRecoveryService();
  const report = recoveryService.runDoctor();
  const registryService = new NodeRegistryService();
  const invocationStoreService = new NodeInvocationStoreService();
  const nodeInvokeService = new NodeInvokeService({
    registryService,
    invocationStoreService,
  });

  const requestedKind = String(getOptionValue(argv, '--kind') || '').trim() || null;
  const requestedNodeId = String(getOptionValue(argv, '--node-id') || '').trim() || null;
  const requestedProfileId = String(getOptionValue(argv, '--profile-id') || '').trim() || null;
  const requestedLabel = String(getOptionValue(argv, '--label') || '').trim() || null;
  const requestedLimit = Number(getOptionValue(argv, '--limit') || '10') || 10;
  const maxAgeDays = Math.max(1, Number(getOptionValue(argv, '--max-age-days') || '7') || 7);
  const prunePreview = buildPrunePreview(
    registryService,
    nodeInvokeService,
    maxAgeDays * 24 * 60 * 60 * 1000,
    requestedNodeId,
  );

  const firstRecoverableIssue = report.issues.find((issue) => issue.recoverable) || null;
  const resolvedKind = requestedKind || mapIssueToRecoverKind(firstRecoverableIssue);
  const resolvedNodeId = requestedNodeId || firstRecoverableIssue?.nodeId || report.selectedNodeId || null;

  const recover = runRepair && resolvedKind
    ? recoveryService.recover({
      kind: resolvedKind,
      nodeId: resolvedNodeId,
      limit: requestedLimit,
      profileId: requestedProfileId,
      label: requestedLabel,
    })
    : null;
  const recoverAll = runRepairAll
    ? report.issues
      .filter((issue) => issue.recoverable && mapIssueToRecoverKind(issue))
      .map((issue) => ({
        issue,
        recover: recoveryService.recover({
          kind: mapIssueToRecoverKind(issue),
          nodeId: issue.nodeId,
          limit: requestedLimit,
          profileId: requestedProfileId,
          label: requestedLabel,
        }),
      }))
    : [];
  const prune = runPruneHistory
    ? (() => {
      const eligibleNodeIds = prunePreview.eligible.map((entry) => entry.id);
      const registry = registryService.removeNodes(eligibleNodeIds);
      const invocations = invocationStoreService.pruneByNodeIds(eligibleNodeIds, {
        keepActive: true,
      });
      return {
        ok: true,
        thresholdDays: maxAgeDays,
        preview: prunePreview,
        registry,
        invocations,
      };
    })()
    : null;

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ report, recover, recoverAll, prunePreview, prune }, null, 2)}\n`);
    if (report.status === 'attention') {
      process.exitCode = 1;
    }
    return;
  }

  console.log('[nodes] doctor');
  console.log(`[nodes] summary: ${report.summary}`);
  console.log(`[nodes] status: ${report.status}`);
  console.log(`[nodes] selected: ${report.selectedNodeId || 'n/d'}`);
  console.log(`[nodes] prune-preview elegiveis: ${prunePreview.eligible.length}`);
  console.log(`[nodes] prune-preview blocked: ${prunePreview.blocked.length}`);
  for (const issue of report.issues) {
    console.log(
      `[nodes] ${issue.nodeId}: ${issue.kind} | recoverable=${issue.recoverable ? 'yes' : 'no'} | ${issue.summary}`,
    );
    if (issue.actionHint) {
      console.log(`[nodes] ${issue.nodeId} hint: ${issue.actionHint}`);
    }
  }

  if (runRepair) {
    if (!resolvedKind) {
      console.log('[nodes] repair: no automatic recovery found for the current state.');
    } else {
      console.log(`[nodes] repair kind: ${resolvedKind}`);
      console.log(`[nodes] repair node: ${resolvedNodeId || 'n/d'}`);
      console.log(`[nodes] repair ok: ${recover?.ok ? 'yes' : 'no'}`);
      if (recover?.action?.summary) {
        console.log(`[nodes] repair summary: ${recover.action.summary}`);
      }
      if (recover?.result) {
        console.log(`[nodes] repair result: ${JSON.stringify(recover.result, null, 2)}`);
      }
    }
  }

  if (runRepairAll) {
    console.log(`[nodes] repair-all items: ${recoverAll.length}`);
    for (const item of recoverAll) {
      console.log(`[nodes] repair-all ${item.issue.nodeId}: ${item.issue.recoverKind || mapIssueToRecoverKind(item.issue) || 'n/d'} | ok=${item.recover.ok ? 'yes' : 'no'}`);
    }
  }

  if (runPruneHistory) {
    console.log(`[nodes] prune-history threshold-days: ${maxAgeDays}`);
    console.log(`[nodes] prune-history removed-nodes: ${prune?.registry.removedEntries || 0}`);
    console.log(`[nodes] prune-history removed-invocations: ${prune?.invocations.removedEntries || 0}`);
    if (prune?.invocations.blockedNodeIds?.length) {
      console.log(`[nodes] prune-history blocked-by-active-queue: ${prune.invocations.blockedNodeIds.join(', ')}`);
    }
  } else if (prunePreview.eligible.length > 0) {
    console.log('[nodes] hint: use --prune-revoked-history para limpar drafts revogados antigos without tocar no host active.');
  }

  if (report.status === 'attention') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[nodes] doctor failed: ${error.message || error}`);
  process.exitCode = 1;
});
