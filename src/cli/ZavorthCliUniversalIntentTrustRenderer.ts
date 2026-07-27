import {
  AgentRunService,
  UniversalIntentTrustEnforcementService,
  type UniversalAgentRun,
  type UniversalIntentTrustEnforcementSnapshot,
} from '../runtime/agent/index.js';

export function resolveUniversalIntentTrustCliText(args: string): string {
  const tokens = splitCliWords(String(args || '').trim());
  const commandAliases = new Set(['uni', 'universal-intent', 'intent', 'trust-slider', 'trust-policy', 'trust', 'run', 'status', 'latest', 'preview']);
  const first = String(tokens[0] || '').toLowerCase();
  const withoutCommand = commandAliases.has(first) ? tokens.slice(1) : tokens;
  return trimMatchingQuotes(withoutCommand.join(' ').trim());
}

export function buildUniversalIntentTrustCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): UniversalIntentTrustEnforcementSnapshot {
  const text = input.text || 'Apply a patch to src/app.ts.';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:44:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['write_file'],
    metadata: {
      trustMode: 'collaborator',
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      targetPath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\app.ts',
      hostScopeRequested: false,
      cliIntentText: text,
    },
  });
  run.summary = 'UNI / Trust Slider evaluated without running tools.';
  return buildUniversalIntentTrustSnapshotFromRun(run);
}

export function buildUniversalIntentTrustSnapshotFromRun(
  run: UniversalAgentRun,
): UniversalIntentTrustEnforcementSnapshot {
  return new UniversalIntentTrustEnforcementService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatUniversalIntentTrustSnapshot(
  snapshot: UniversalIntentTrustEnforcementSnapshot,
): string {
  const lines = [
    'UNI / Trust Slider Enforcement - Channel mesh4',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- intent: ${snapshot.summary.intent}`,
    `- risk: ${snapshot.summary.risk}`,
    `- trust: ${snapshot.summary.trustLevel} -> ${snapshot.summary.trustDecision}`,
    `- posture: ${snapshot.summary.posture}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Permission',
  ];

  if (snapshot.permission.required) {
    lines.push(
      `- type: ${snapshot.permission.kind}`,
      `- scope: ${snapshot.permission.scope}`,
      `- preview: ${snapshot.permission.previewRequired ? 'yes' : 'no'}`,
      `- approval: ${snapshot.permission.approvalRequired ? 'yes' : 'no'}`,
      `- prompt: ${snapshot.permission.prompt || 'n/a'}`,
    );
  } else {
    lines.push('- no conversational permission required');
  }

  lines.push('', 'Clarification');
  if (snapshot.clarification.required) {
    lines.push(
      `- question: ${snapshot.clarification.question || 'confirm before acting'}`,
      `- missing: ${snapshot.clarification.missing.join(', ') || 'n/a'}`,
    );
  } else {
    lines.push('- no question required');
  }

  lines.push('', 'Gates');
  for (const gate of snapshot.gates) {
    lines.push(`- ${gate.status}: ${gate.label} (${gate.source})`, `  ${gate.detail}`);
  }

  lines.push('', 'Policy');
  lines.push('- UniversalIntentService is the source of classification');
  lines.push('- Trust Slider is applied before the executor');
  lines.push('- natural language does not bypass permission, preview, or approval');
  lines.push('- entire host requires Overlord with owner/operator and kill switch');
  lines.push('- workspace boundary continues global enforcement');
  lines.push('- no tool was executed by the snapshot');
  lines.push('- secrets were not serialized');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Trust: ${snapshot.surface.trustHint}`);
  lines.push(`- Permission: ${snapshot.surface.permissionHint}`);

  return lines.join('\n');
}

function splitCliWords(value: string): string[] {
  const words: string[] = [];
  let current = '';
  for (const char of value) {
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (current) {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) {
    words.push(current);
  }
  return words;
}

function trimMatchingQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const first = value.charAt(0);
  const last = value.charAt(value.length - 1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim();
  }
  return value;
}
