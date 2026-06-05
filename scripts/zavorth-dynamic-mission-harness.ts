#!/usr/bin/env node
import type { ZavorthDepthModeId, ZavorthMissionEffect, ZavorthMissionPattern } from '../src/contracts/ZavorthDepthModeContract.js';
import { ZavorthDynamicMissionHarnessService } from '../src/services/ZavorthDynamicMissionHarnessService.js';

const args = process.argv.slice(2);

main();

function main(): void {
  const service = new ZavorthDynamicMissionHarnessService();
  const snapshot = service.buildPreview({
    objective: readFlag('--objective') || readFlag('--base-prompt') || 'Review a complex task and create a safe mission plan.',
    mode: normalizeMode(readFlag('--mode')),
    requestedEffects: readList('--effects').map(normalizeEffect).filter((effect): effect is ZavorthMissionEffect => Boolean(effect)),
    patternHints: readList('--patterns').map(normalizePattern).filter((pattern): pattern is ZavorthMissionPattern => Boolean(pattern)),
    contextArtifacts: readList('--context'),
    requestedCaps: {
      maxAgents: readNumber('--max-agents'),
      maxTokens: readNumber('--max-tokens'),
      maxCostUsd: readNumber('--max-cost-usd'),
      maxDurationMinutes: readNumber('--max-duration-minutes'),
    },
  });

  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log([
    'Zavorth Dynamic Mission Harness',
    '',
    `status: ${snapshot.status}`,
    `mode: ${snapshot.mode.mode}`,
    `patterns: ${snapshot.workflow.patterns.join(', ')}`,
    `tasks: ${snapshot.workflow.tasks.length}`,
    `approval: ${snapshot.approval.required ? snapshot.approval.reasons.join(', ') : 'not required'}`,
    '',
    'tasks:',
    ...snapshot.workflow.tasks.map((task) => `- ${task.role}: ${task.title} (${task.checkpointId})`),
  ].join('\n'));
}

function readFlag(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1).trim() || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() || null : null;
}

function readList(name: string): string[] {
  const value = readFlag(name);
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : [];
}

function readNumber(name: string): number | undefined {
  const value = readFlag(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
