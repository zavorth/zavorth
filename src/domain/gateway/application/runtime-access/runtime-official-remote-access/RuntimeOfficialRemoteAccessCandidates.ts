import path from 'path';
import { config } from '../../../../../config/index.js';
import type { LocalCloudflareRolloutSnapshot } from '../../../../../services/LocalCloudflareRolloutService.js';
import type { OracleCloudflareRolloutSnapshot } from '../../../../../services/OracleCloudflareRolloutService.js';
import type { RuntimeOfficialRemoteRolloutCandidate } from './RuntimeOfficialRemoteAccessTypes.js';

export function buildRemoteRolloutCandidates(
  localSnapshot: LocalCloudflareRolloutSnapshot,
  oracleSnapshot: OracleCloudflareRolloutSnapshot,
): RuntimeOfficialRemoteRolloutCandidate[] {
  return [
    buildLocalCloudflareCandidate(localSnapshot),
    buildOracleCloudflareCandidate(oracleSnapshot),
  ].sort(compareCandidates);
}

function buildLocalCloudflareCandidate(
  snapshot: LocalCloudflareRolloutSnapshot,
): RuntimeOfficialRemoteRolloutCandidate {
  const steps = Array.isArray(snapshot?.steps) ? snapshot.steps : [];
  const doneSteps = steps.filter((step) => step.status === 'done').length;
  return {
    id: 'local-cloudflare',
    label: 'Cloudflare no host local',
    ready: Boolean(snapshot?.readyForPlanB),
    summary: String(snapshot?.summary || 'Plano B local ainda pendente.'),
    command: 'npm run ops:local-cloudflare',
    guide: String(snapshot?.helpers?.guide || path.join(config.projectRoot, 'docs', '35-windows-cloudflare-gemma.md')),
    doneSteps,
    totalSteps: steps.length,
    pendingHighlights: steps
      .filter((step) => step.status !== 'done')
      .slice(0, 3)
      .map((step) => `${step.title}: ${step.detail}`),
  };
}

function buildOracleCloudflareCandidate(
  snapshot: OracleCloudflareRolloutSnapshot,
): RuntimeOfficialRemoteRolloutCandidate {
  const steps = Array.isArray(snapshot?.steps) ? snapshot.steps : [];
  const doneSteps = steps.filter((step) => step.status === 'done').length;
  return {
    id: 'oracle-cloudflare',
    label: 'Oracle + Cloudflare + Gemini/Gemma',
    ready: Boolean(snapshot?.readyForRemoteRollout),
    summary: String(snapshot?.summary || 'Rollout Oracle ainda pendente.'),
    command: 'npm run ops:oracle-cloudflare',
    guide: snapshot?.templates?.oracleSystemd
      ? path.join(path.dirname(snapshot.templates.oracleSystemd), '..', '..', 'docs', '34-oracle-cloudflare-gemma.md')
      : path.join(config.projectRoot, 'docs', '34-oracle-cloudflare-gemma.md'),
    doneSteps,
    totalSteps: steps.length,
    pendingHighlights: steps
      .filter((step) => step.status !== 'done')
      .slice(0, 3)
      .map((step) => `${step.title}: ${step.detail}`),
  };
}

function compareCandidates(
  left: RuntimeOfficialRemoteRolloutCandidate,
  right: RuntimeOfficialRemoteRolloutCandidate,
): number {
  const leftScore = (left.ready ? 100 : 0) + left.doneSteps * 5 - left.pendingHighlights.length;
  const rightScore = (right.ready ? 100 : 0) + right.doneSteps * 5 - right.pendingHighlights.length;
  return rightScore - leftScore;
}

