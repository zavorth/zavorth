import { describe, expect, it } from '@jest/globals';

import { AgentRunCanonicalContextService } from '../../../src/runtime/agent/AgentRunCanonicalContextService.js';
import { AgentRunFactory } from '../../../src/runtime/agent/AgentRunFactory.js';
import { AgentRunLlmRequestBuilder } from '../../../src/runtime/agent/AgentRunLlmRequestBuilder.js';
import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy.js';

describe('AgentRun kernel snapshot binding', () => {
  it('attaches Capability Passport metadata and injects the canonical LLM block', () => {
    const factory = new AgentRunFactory({
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      idFactory: createIdFactory(),
      toolPolicy: new ToolExposurePolicy(),
      canonicalContextService: new AgentRunCanonicalContextService(),
      defaultProviderLabel: 'Gemini',
      defaultModelLabel: 'gemini-2.5-flash',
      profileManifestService: {
        compileProfileById: () => null,
      },
      agentKernelSnapshotService: {
        buildSnapshotSync: () => kernelSnapshotStub(),
      },
    });
    const run = factory.createRun({
      userId: 'operator',
      channel: 'cli',
      text: 'mude o skill governance para governed',
    });
    const builder = new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => 'Never invent tool execution.',
    });

    const messages = builder.buildMessages(run, {
      userId: 'operator',
      channel: 'cli',
      text: 'mude o skill governance para governed',
    });

    expect(run.metadata.agentKernelSnapshot).toMatchObject({
      surface: 'agent-kernel-snapshot',
    });
    expect(run.metadata.capabilityPassport).toMatchObject({
      status: 'ready',
    });
    expect(messages[0].content).toContain('Agent Kernel Snapshot');
    expect(messages[0].content).toContain('Capability Passport is active');
    expect(messages[0].content).toContain('prefer the stricter safety boundary');
  });
});

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function kernelSnapshotStub(): any {
  return {
    contractVersion: '2026-06-02.agent-kernel-snapshot.v1',
    schemaVersion: 1,
    surface: 'agent-kernel-snapshot',
    generatedAt: '2026-06-02T12:00:00.000Z',
    status: 'ready',
    projectRoot: process.cwd(),
    activeProfile: null,
    capabilityPassport: {
      status: 'ready',
      activeProfile: {
        id: 'personal',
      },
    },
    intentDecision: {
      kind: 'zavorth_action',
      requiresPreview: true,
      requiresApproval: true,
    },
    performanceMemory: {
      recommendations: [],
      sampleCount: 0,
    },
    quietAutonomy: {
      mode: 'quiet-staging',
      interruptMode: 'daily-digest',
    },
    cleanInstallCertification: {
      status: 'ready',
      checks: [],
      command: 'npm run qa:zavorth-agent-kernel --silent',
    },
    llmContextBlock: [
      'Agent Kernel Snapshot (canonical install/runtime context; context only, not proof of execution):',
      '- Capability Passport is active.',
      '- routing rule: choose direct response, zavorth_action, memory, background task, swarm, sandbox, channel or approval by task nature.',
    ].join('\n'),
  };
}
