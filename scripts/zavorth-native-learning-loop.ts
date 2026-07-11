import { ZavorthNativeLearningLoopService } from '../src/services/ZavorthNativeLearningLoopService.js';
import {
  ZavorthLearningPlaneService,
  type LearningPlaneActionId,
} from '../src/services/ZavorthLearningPlaneService.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const positionalArgs = readPositionalArgs(args);

function readFlag(name: string): string | null {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function readPositionalArgs(values: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value || value === '--json') continue;
    if (value.startsWith('--')) {
      if (!value.includes('=') && values[index + 1] && !values[index + 1].startsWith('--')) {
        index += 1;
      }
      continue;
    }
    result.push(value);
  }
  return result;
}

async function main(): Promise<void> {
  const command = String(positionalArgs[0] || '').trim();
  const actionId = normalizeLearningActionId(command);
  if (command === 'candidates' || actionId) {
    const learningPlane = new ZavorthLearningPlaneService();
    if (command === 'candidates') {
      const snapshot = learningPlane.buildSnapshot({
        workspace: readFlag('--workspace') || null,
      });
      if (json) {
        console.log(JSON.stringify(snapshot, null, 2));
        return;
      }
      console.log(formatLearningCandidates(snapshot));
      return;
    }

    const candidateId = positionalArgs.slice(1).join(' ').trim();
    if (!candidateId) {
      throw new Error('Uso: zavorth learn <approve|reject|forget|promote|promote-skill|promote-procedure> <candidateId>.');
    }
    const execution = await learningPlane.executeAction({
      candidateId,
      actionId,
    });
    if (json) {
      console.log(JSON.stringify(execution, null, 2));
      return;
    }
    console.log(formatLearningAction(execution));
    return;
  }

  const service = new ZavorthNativeLearningLoopService();
  const originalLog = console.log;
  console.log = () => undefined;
  let snapshot;
  try {
    snapshot = await service.buildSnapshot({
      query: readFlag('--query'),
      observation: readFlag('--observe') || readFlag('--observation'),
      userId: readFlag('--user') || 'zavorth-runtime',
      sessionId: readFlag('--session'),
      workspace: readFlag('--workspace') || process.cwd(),
      sourceSurface: readFlag('--surface') || 'cli',
      limit: Number(readFlag('--limit') || 0) || undefined,
    });
  } finally {
    console.log = originalLog;
  }

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log(service.formatSnapshotText(snapshot));
}

function normalizeLearningActionId(value: string): LearningPlaneActionId | null {
  const normalized = value.trim().replace(/_/g, '-').toLowerCase();
  if (normalized === 'approve' || normalized === 'reject' || normalized === 'promote' || normalized === 'forget') {
    return normalized;
  }
  if (normalized === 'promote-procedure' || normalized === 'promoteprocedure') {
    return 'promoteProcedure';
  }
  if (normalized === 'promote-skill' || normalized === 'promoteskill') {
    return 'promoteSkill';
  }
  return null;
}

function formatLearningCandidates(snapshot: ReturnType<ZavorthLearningPlaneService['buildSnapshot']>): string {
  const lines = [
    'Zavorth Learn Candidates',
    '',
    snapshot.narrative.headline,
    snapshot.narrative.operatorSummary,
    '',
    `Total: ${snapshot.summary.total} | pending: ${snapshot.summary.pending} | approved: ${snapshot.summary.approved} | quarantined: ${snapshot.summary.quarantined}`,
  ];
  for (const candidate of snapshot.candidates.slice(0, 10)) {
    lines.push(
      '',
      `- ${candidate.id}`,
      `  ${candidate.title}`,
      `  kind=${candidate.kind} score=${candidate.score.toFixed(2)} review=${candidate.reviewState} lifecycle=${candidate.lifecycle}`,
      `  approve: zavorth learn approve ${candidate.id}`,
      `  reject: zavorth learn reject ${candidate.id}`,
      `  forget: zavorth learn forget ${candidate.id}`,
      `  promote skill: zavorth learn promote-skill ${candidate.id}`,
      `  promote procedure: zavorth learn promote-procedure ${candidate.id}`,
    );
  }
  return lines.join('\n');
}

function formatLearningAction(execution: ReturnType<ZavorthLearningPlaneService['executeAction']>): string {
  return [
    'Zavorth Learn Action',
    '',
    execution.summary,
    `Status: ${execution.status}`,
    `OK: ${execution.ok}`,
    `Candidate: ${execution.candidateId}`,
    `Action: ${execution.actionId}`,
    ...execution.details.map((detail) => `- ${detail}`),
  ].join('\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
