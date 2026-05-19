#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { ReleaseTrainService } from '../src/services/ReleaseTrainService.js';
import {
  HOTFIX_PLAYBOOK,
  RELEASE_CANDIDATE_CHECKLIST,
  RELEASE_TRAIN_CALENDAR,
  RELEASE_TRAIN_VERSION_POLICIES,
  type ReleaseTrainArtifactResult,
} from '../src/contracts/ReleaseTrainContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const shouldWritePlan = argv.includes('--plan') || requirePass;
const shouldWriteChecklist = argv.includes('--checklist') || requirePass;
const shouldWriteHotfix = argv.includes('--hotfix') || requirePass;
const projectRoot = process.cwd();
const websiteRoot = resolveWebsiteRoot();
const artifactDir = resolveArtifactDir();
const planPath = path.join(artifactDir, 'release-train-plan.json');
const checklistPath = path.join(artifactDir, 'release-candidate-checklist.json');
const hotfixPath = path.join(artifactDir, 'hotfix-playbook.json');

async function main(): Promise<void> {
  fs.mkdirSync(artifactDir, { recursive: true });

  if (shouldWritePlan) {
    writeJson(planPath, buildPlanArtifact());
  }
  if (shouldWriteChecklist) {
    writeJson(checklistPath, buildChecklistArtifact());
  }
  if (shouldWriteHotfix) {
    writeJson(hotfixPath, buildHotfixArtifact());
  }

  const service = new ReleaseTrainService({
    projectRoot,
    websiteRoot,
    artifactDir,
    planPath,
    checklistPath,
    hotfixPath,
    requireArtifacts: requirePass || shouldWritePlan || shouldWriteChecklist || shouldWriteHotfix,
  });
  const snapshot = service.buildSnapshot();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderReport(snapshot)}\n`);
  }

  if (requirePass && !snapshot.summary.ok) {
    process.exitCode = 1;
  }
}

function resolveWebsiteRoot(): string {
  const inline = argv.find((arg) => arg.startsWith('--website-root='));
  const cliValue = inline ? inline.split('=').slice(1).join('=').trim() : '';
  const envValue = String(process.env.ZAVORTH_WEBSITE_REPO_ROOT || '').trim();
  return path.resolve(cliValue || envValue || path.join(projectRoot, '..', '..', 'zavorth-website'));
}

function resolveArtifactDir(): string {
  const inline = argv.find((arg) => arg.startsWith('--artifact-dir='));
  const cliValue = inline ? inline.split('=').slice(1).join('=').trim() : '';
  return path.resolve(cliValue || path.join(projectRoot, '.qa', 'release-train'));
}

function buildPlanArtifact() {
  const results: ReleaseTrainArtifactResult[] = RELEASE_TRAIN_VERSION_POLICIES.map((policy) => ({
    id: policy.lane,
    status: policy.requiresRollback && policy.gates.length > 0 ? 'pass' : 'fail',
    evidence: [
      policy.versionPattern,
      policy.purpose,
      `gates=${policy.gates.join(', ')}`,
    ],
  }));

  return {
    schemaVersion: '1.0.0',
    stage: '59',
    generatedAt: new Date().toISOString(),
    ok: results.every((result) => result.status === 'pass'),
    baseline: 'v1.0.0',
    calendar: RELEASE_TRAIN_CALENDAR,
    results,
  };
}

function buildChecklistArtifact() {
  const results: ReleaseTrainArtifactResult[] = RELEASE_CANDIDATE_CHECKLIST.map((item) => ({
    id: item.id,
    status: item.required && item.evidence.trim() ? 'pass' : 'fail',
    evidence: [item.command || '<manual>', item.evidence],
  }));

  return {
    schemaVersion: '1.0.0',
    stage: '59',
    generatedAt: new Date().toISOString(),
    ok: results.every((result) => result.status === 'pass'),
    mode: 'release-candidate',
    results,
  };
}

function buildHotfixArtifact() {
  const results: ReleaseTrainArtifactResult[] = HOTFIX_PLAYBOOK.map((step) => ({
    id: step.id,
    status: step.rollback.trim() && step.evidence.trim() ? 'pass' : 'fail',
    evidence: [step.command || '<manual>', step.rollback, step.evidence],
  }));

  return {
    schemaVersion: '1.0.0',
    stage: '59',
    generatedAt: new Date().toISOString(),
    ok: results.every((result) => result.status === 'pass'),
    lane: 'v1.0.x',
    results,
  };
}

function writeJson(target: string, value: unknown): void {
  assertInside(artifactDir, target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertInside(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`recusando tocar caminho fora do artifactDir: ${target}`);
  }
}

main().catch((error) => {
  console.error('[release-train] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
