import {
  ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthNativeEngineAbsorptionContract.js';
import { ZavorthNativeEngineAbsorptionService } from '../../src/services/ZavorthNativeEngineAbsorptionService.js';

describe('ZavorthNativeEngineAbsorptionService Preview engine', () => {
  it('publishes the native engine absorption snapshot after Intent model readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T20:15:00.000Z',
      contractVersion: ZAVORTH_NATIVE_ENGINE_ABSORPTION_CONTRACT_VERSION,
      status: 'native-engine-ready',
      planId: 'Zavorth External Runtime Integration',
      stage: 'native-engine-absorption',
      previousContractLayerStatus: 'contract-layer-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      features: 5,
      receipts: 5,
      sourceRuntimeDependency: false,
      executionPerformed: false,
      toolsExecuted: false,
      memoryWritesPerformed: false,
      skillMutationsPerformed: false,
    }));
    expect(snapshot.commands.nextAction).toBe('Approval gate - Sidecar Adapter');
  });

  it('defines the five native Zavorth engine features without source runtime dependency', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.features.map((entry) => entry.id)).toEqual([
      'error-recovery-classifier',
      'tool-call-argument-repair',
      'safe-tool-parallelism',
      'procedural-memory-signal',
      'skill-library-curation',
    ]);
    expect(snapshot.features.every((entry) => (
      entry.observability.emitsReceipt
      && entry.observability.noSourceRuntimeDependency
      && entry.acceptanceGate.length > 0
    ))).toBe(true);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      sourceRuntimeCodeExecuted: false,
      sidecarsStarted: false,
      toolExecutionPerformed: false,
      providerCallsPerformed: false,
      memoryWritesPerformed: false,
      skillMutationsPerformed: false,
      approvalBypassAllowed: false,
    }));
  });

  it('classifies errors into recovery strategies without retrying or calling providers', () => {
    const service = createService();

    expect(service.classifyError({ text: '429 rate limit: too many requests' })).toEqual(expect.objectContaining({
      category: 'rate_limit',
      strategy: 'retry_with_backoff',
      retryAllowed: true,
      approvalRequired: false,
      safety: expect.objectContaining({ noProviderCall: true }),
    }));
    expect(service.classifyError({ text: 'Remove-Item -Recurse -Force dist' })).toEqual(expect.objectContaining({
      category: 'destructive_intent',
      strategy: 'block_and_require_approval',
      retryAllowed: false,
      approvalRequired: true,
      safety: expect.objectContaining({ noAutoApproval: true }),
    }));
  });

  it('repairs malformed tool arguments parser-first without adding authority or executing tools', () => {
    const receipt = createService().repairToolArguments({
      toolName: 'workspace.shell.preview',
      rawArguments: '```json\n{"command":"npm test",}\n```',
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'repaired',
      repairedArguments: { command: 'npm test' },
      repairsApplied: ['strip-code-fence', 'remove-trailing-commas'],
      authorityAdded: false,
      parserFirst: true,
      safety: expect.objectContaining({
        noToolExecution: true,
        noApprovalBypass: true,
        noNewAuthorityAdded: true,
      }),
    }));

    const dangerous = createService().repairToolArguments({
      toolName: 'workspace.shell.preview',
      rawArguments: '{"command":"sudo rm -rf dist"}',
    });
    expect(dangerous.status).toBe('valid');
    expect(dangerous.dangerousIntentDetected).toBe(true);
    expect(dangerous.approvalRequiredForLive).toBe(true);
  });

  it('serializes conflicting write sets while allowing independent reads in parallel', () => {
    const receipt = createService().planToolParallelism({
      tasks: [
        { id: 'read-a', toolName: 'read_file', resourceRefs: [{ kind: 'file', ref: 'src/a.ts', access: 'read' }] },
        { id: 'read-b', toolName: 'read_file', resourceRefs: [{ kind: 'file', ref: 'src/b.ts', access: 'read' }] },
        { id: 'write-a', toolName: 'apply_patch', resourceRefs: [{ kind: 'file', ref: 'src/a.ts', access: 'write' }] },
        { id: 'write-a-again', toolName: 'format', resourceRefs: [{ kind: 'file', ref: 'src/a.ts', access: 'write' }] },
      ],
    });

    expect(receipt.status).toBe('planned');
    expect(receipt.batches[0]).toEqual(expect.objectContaining({
      mode: 'parallel',
      taskIds: expect.arrayContaining(['read-a', 'read-b']),
    }));
    expect(receipt.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        leftTaskId: 'read-a',
        rightTaskId: 'write-a',
        reason: 'same-resource-write-conflict',
      }),
      expect.objectContaining({
        leftTaskId: 'write-a',
        rightTaskId: 'write-a-again',
        reason: 'same-resource-write-conflict',
      }),
    ]));
    expect(receipt.safety.noToolExecution).toBe(true);
  });

  it('creates procedural memory signals with redaction and no memory write', () => {
    const receipt = createService().buildProceduralMemorySignal({
      command: 'npm test TOKEN=abc123',
      outcome: 'workaround',
      lesson: 'Use API_KEY=secret as a secret ref, not inline.',
      evidence: ['tests/services/ZavorthNativeEngineAbsorptionService.test.ts'],
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'ready',
      shouldStore: true,
      retentionHint: 'long',
      sanitizedCommand: 'npm test TOKEN=[REDACTED]',
      lesson: 'Use API_KEY=[REDACTED] as a secret ref, not inline.',
      safety: expect.objectContaining({
        provenanceRequired: true,
        secretValuesRedacted: true,
        noMemoryWritePerformed: true,
      }),
    }));
  });

  it('produces skill curation dry-run proposals without mutating the skill library', () => {
    const receipt = createService().previewSkillCuration({
      skills: [
        { id: 'a', name: 'read file helper', filePath: 'skill-library/a/SKILL.md', description: 'Reads one file.', usageCount: 1, failureCount: 0, pinned: false, tags: ['read'] },
        { id: 'b', name: 'read file helper', filePath: 'skill-library/b/SKILL.md', description: 'Reads a file and summarizes it.', usageCount: 0, failureCount: 0, pinned: false, tags: ['read'] },
        { id: 'c', name: 'operator approvals', filePath: 'skill-library/c/SKILL.md', description: 'Pinned approval rules.', usageCount: 0, failureCount: 0, pinned: true, tags: ['policy'] },
      ],
    });

    expect(receipt.status).toBe('preview-ready');
    expect(receipt.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'merge', skillIds: ['a', 'b'], approvalRequired: true, rollbackRequired: true }),
      expect.objectContaining({ action: 'archive', skillIds: ['b'], approvalRequired: true, rollbackRequired: true }),
      expect.objectContaining({ action: 'keep', skillIds: ['c'], approvalRequired: false }),
    ]));
    expect(receipt.safety).toEqual(expect.objectContaining({
      dryRunOnly: true,
      noSkillMutationPerformed: true,
      approvalRequiredBeforeMutation: true,
      rollbackSnapshotRequired: true,
    }));
  });

  it('blocks Preview engine if Intent model contract layer is not ready', () => {
    const snapshot = createService().buildSnapshot({ contractLayerStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousContractLayerStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'contract-layer-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for the native engine pack', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Native Engine Absorption - Preview engine');
    expect(text).toContain('Status: native-engine-ready');
    expect(text).toContain('Features: 5');
    expect(text).toContain('Tool execution performed: false');
    expect(text).toContain('Next: Approval gate - Sidecar Adapter');
  });
});

function createService(): ZavorthNativeEngineAbsorptionService {
  return new ZavorthNativeEngineAbsorptionService({
    now: () => new Date('2026-05-11T20:15:00.000Z'),
    contractLayerStatus: 'contract-layer-ready',
  });
}
