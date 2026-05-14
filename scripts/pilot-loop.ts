#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PilotLoopService } from '../src/services/PilotLoopService.js';
import {
  PILOT_DASHBOARD_METRICS,
  PILOT_FEEDBACK_TEMPLATES,
  PILOT_LEDGER_ENTRIES,
  PILOT_SUPPORT_POLICY,
  PILOT_TRIAGE_RULES,
} from '../src/contracts/PilotLoopContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const shouldWritePreview = argv.includes('--preview') || requirePass;
const shouldWriteLedger = argv.includes('--ledger') || requirePass;
const shouldWriteDashboard = argv.includes('--dashboard') || requirePass;
const projectRoot = process.cwd();
const websiteRoot = resolveWebsiteRoot();
const artifactDir = resolveArtifactDir();
const feedbackPreviewPath = path.join(artifactDir, 'feedback-preview-redacted.json');
const pilotLedgerPath = path.join(artifactDir, 'pilot-ledger.json');
const dashboardPath = path.join(artifactDir, 'support-dashboard.json');

async function main(): Promise<void> {
  fs.mkdirSync(artifactDir, { recursive: true });

  if (shouldWritePreview) {
    writeJson(feedbackPreviewPath, buildFeedbackPreview());
  }
  if (shouldWriteLedger) {
    writeJson(pilotLedgerPath, buildPilotLedger());
  }
  if (shouldWriteDashboard) {
    writeJson(dashboardPath, buildDashboard());
  }

  const service = new PilotLoopService({
    projectRoot,
    websiteRoot,
    artifactDir,
    feedbackPreviewPath,
    pilotLedgerPath,
    dashboardPath,
    requireArtifacts: requirePass || shouldWritePreview || shouldWriteLedger || shouldWriteDashboard,
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
  return path.resolve(cliValue || path.join(projectRoot, '.qa', 'pilot-loop'));
}

function buildFeedbackPreview() {
  return {
    schemaVersion: '1.0.0',
    phase: '57',
    generatedAt: new Date().toISOString(),
    ok: true,
    telemetry: 'disabled-by-default',
    sendsData: false,
    consent: 'not-granted',
    templateIds: PILOT_FEEDBACK_TEMPLATES.map((template) => template.id),
    redactions: ['tokens', 'secrets', 'paths pessoais', 'payload bruto', 'logs sensiveis', 'workspace privado'],
    sample: {
      area: 'install',
      severity: 'high',
      command: 'npm run doctor',
      summary: 'Install failed in fixture-safe path after dependency check.',
      payload: '<redacted>',
    },
  };
}

function buildPilotLedger() {
  return {
    schemaVersion: '1.0.0',
    phase: '57',
    generatedAt: new Date().toISOString(),
    ok: true,
    entries: PILOT_LEDGER_ENTRIES,
    supportPolicy: PILOT_SUPPORT_POLICY,
    triageRules: PILOT_TRIAGE_RULES,
    privacy: {
      capturesWorkspacePayload: false,
      storesSecrets: false,
      allowedData: ['area', 'severity', 'public command', 'redacted summary', 'follow-up'],
    },
  };
}

function buildDashboard() {
  const metricValues = PILOT_DASHBOARD_METRICS.map((metric) => ({
    ...metric,
    value: metric.id === 'pilot-status' ? { planned: PILOT_LEDGER_ENTRIES.length, active: 0, complete: 0 } : 0,
  }));
  return {
    schemaVersion: '1.0.0',
    phase: '57',
    generatedAt: new Date().toISOString(),
    ok: true,
    containsPayload: false,
    metrics: metricValues,
    aggregationOnly: true,
    notes: [
      'Dashboard agrega area, severidade, status e follow-ups.',
      'Nenhum payload bruto, token, secret ou path pessoal entra no artifact.',
    ],
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
  console.error('[pilot-loop] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
