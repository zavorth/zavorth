#!/usr/bin/env node
import { ZavorthNativeAutonomySpineService } from '../src/services/ZavorthNativeAutonomySpineService.js';
import type { MnemosDreamMemoryKind } from '../src/contracts/MnemosDreamCycleContract.js';
import type { ZavorthDepthModeId, ZavorthMissionEffect, ZavorthMissionPattern } from '../src/contracts/ZavorthDepthModeContract.js';

const args = process.argv.slice(2);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const service = new ZavorthNativeAutonomySpineService();
  const snapshot = await service.buildSnapshot({
    turn: {
      turnId: readFlag('--turn-id') || 'sample-turn',
      sessionId: readFlag('--session-id') || 'sample-session',
      userId: readFlag('--user-id') || 'sample-user',
      outcome: readFlag('--outcome') === 'failure' ? 'failure' : readFlag('--outcome') === 'interrupted' ? 'interrupted' : 'success',
      userMessage: readFlag('--base-prompt') || 'Prefer 3 bullets for short summaries.',
      assistantResponse: readFlag('--assistant-response') || 'Done.',
      toolReceipts: [
        { id: 'receipt-sample', kind: 'message', status: 'done', summary: 'Sample receipt.' },
      ],
      toolCallCount: Number(readFlag('--tool-calls') || '6'),
      sourceSurface: readFlag('--surface') || 'cli',
      recallQuery: readFlag('--recall'),
    },
    channel: {
      channelId: readFlag('--channel') || 'telegram',
      configured: true,
      proofResults: allChannelProofs(),
    },
    backend: {
      backendId: readFlag('--backend') || 'docker',
      configured: true,
      command: readFlag('--command') || 'npm test',
      mutationRequested: args.includes('--mutation'),
      approvalId: args.includes('--approval') ? 'cli-approval' : null,
      proofResults: allBackendProofs(),
    },
    mission: buildMissionInput(),
    dreamCycle: buildDreamCycleInput(),
  });

  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(renderText(snapshot));
  }
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}

function allChannelProofs() {
  return {
    handshake: true,
    inboundEcho: true,
    outboundEcho: true,
    progressSignal: true,
    stopCommand: true,
    approvalCard: true,
    fileSend: true,
    receiptRecorded: true,
  };
}

function allBackendProofs() {
  return {
    doctor: true,
    prepareWorkspace: true,
    run: true,
    stream: true,
    upload: true,
    download: true,
    snapshot: true,
    hibernate: true,
    resume: true,
    cleanup: true,
    costEstimate: true,
  };
}

function renderText(snapshot: Awaited<ReturnType<ZavorthNativeAutonomySpineService['buildSnapshot']>>): string {
  return [
    'Zavorth Native Autonomy Spine',
    '',
    `status: ${snapshot.status}`,
    `organic learning: ${snapshot.summary.organicLearningReady ? 'ready' : 'review'}`,
    `skill forge: ${snapshot.summary.skillForgeReady ? 'ready' : 'review'}`,
    `dynamic mission: ${snapshot.summary.dynamicMissionReady ? 'ready' : 'review'}`,
    `dream cycle: ${snapshot.summary.dreamCycleReady ? 'ready' : 'review'}`,
    `channel live: ${snapshot.summary.liveChannelReady ? 'ready' : 'review'}`,
    `backend provider: ${snapshot.summary.backendProviderReady ? 'ready' : 'review'}`,
    '',
    'stages:',
    ...snapshot.stages.map((stage) => `- ${stage.id}: ${stage.status} ? ${stage.summary}`),
    '',
    'review center:',
    ...snapshot.reviewCenter.actions.map((action) => `- ${action}`),
  ].join('\n');
}

function buildMissionInput() {
  const objective = readFlag('--mission-objective');
  if (!objective) return null;
  return {
    objective,
    mode: normalizeMode(readFlag('--mission-mode')),
    requestedEffects: readList('--mission-effects').map(normalizeEffect).filter((effect): effect is ZavorthMissionEffect => Boolean(effect)),
    patternHints: readList('--mission-patterns').map(normalizePattern).filter((pattern): pattern is ZavorthMissionPattern => Boolean(pattern)),
    contextArtifacts: readList('--mission-context'),
  };
}

function buildDreamCycleInput() {
  const observation = readFlag('--dream-observation');
  if (!observation) return null;
  return {
    storeId: readFlag('--dream-store') || 'mnemos-main',
    existingMemories: [],
    sessions: [
      {
        sessionId: readFlag('--dream-session') || 'sample-dream-session',
        createdAt: new Date().toISOString(),
        summary: readFlag('--dream-summary') || observation,
        observations: [
          {
            id: 'sample-dream-observation',
            kind: normalizeDreamKind(readFlag('--dream-kind')) || 'preference',
            text: observation,
            evidenceRefs: ['sample-turn'],
            updatedAt: new Date().toISOString(),
            confidence: 0.82,
          },
        ],
      },
    ],
  };
}

function readList(name: string): string[] {
  const value = readFlag(name);
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

function normalizeMode(value: string | null): ZavorthDepthModeId | null {
  if (value === 'normal' || value === 'deep' || value === 'mission' || value === 'adversarial') {
    return value;
  }
  return null;
}

function normalizeEffect(value: string): ZavorthMissionEffect | null {
  if (value === 'read' || value === 'write' || value === 'shell' || value === 'network' || value === 'external-send' || value === 'provider-change') {
    return value;
  }
  return null;
}

function normalizePattern(value: string): ZavorthMissionPattern | null {
  if (
    value === 'classify-and-act'
    || value === 'fanout-and-synthesize'
    || value === 'adversarial-verification'
    || value === 'generate-and-filter'
    || value === 'tournament'
    || value === 'loop-until-done'
  ) {
    return value;
  }
  return null;
}

function normalizeDreamKind(value: string | null): MnemosDreamMemoryKind | null {
  if (
    value === 'preference'
    || value === 'procedure'
    || value === 'project-fact'
    || value === 'user-model'
    || value === 'policy'
  ) {
    return value;
  }
  return null;
}
