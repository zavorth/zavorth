#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { IntegrationShowcaseService } from '../src/services/IntegrationShowcaseService.js';
import {
  INTEGRATION_CAPABILITY_MATRIX,
  INTEGRATION_SHOWCASE_ITEMS,
  PARTNER_SURFACE_POLICY,
  type IntegrationShowcaseSmokeResult,
} from '../src/contracts/IntegrationShowcaseContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const shouldWriteSmoke = argv.includes('--smoke') || requirePass;
const shouldWriteMatrix = argv.includes('--matrix') || requirePass;
const shouldWritePartnerSurface = argv.includes('--partner') || requirePass;
const projectRoot = process.cwd();
const websiteRoot = resolveWebsiteRoot();
const artifactDir = resolveArtifactDir();
const smokePath = path.join(artifactDir, 'integration-smoke.json');
const matrixPath = path.join(artifactDir, 'capability-matrix.json');
const partnerSurfacePath = path.join(artifactDir, 'partner-surface.json');

async function main(): Promise<void> {
  fs.mkdirSync(artifactDir, { recursive: true });

  if (shouldWriteSmoke) {
    writeJson(smokePath, buildSmokeArtifact());
  }
  if (shouldWriteMatrix) {
    writeJson(matrixPath, buildMatrixArtifact());
  }
  if (shouldWritePartnerSurface) {
    writeJson(partnerSurfacePath, buildPartnerSurfaceArtifact());
  }

  const service = new IntegrationShowcaseService({
    projectRoot,
    websiteRoot,
    artifactDir,
    smokePath,
    matrixPath,
    partnerSurfacePath,
    requireArtifacts: requirePass || shouldWriteSmoke || shouldWriteMatrix || shouldWritePartnerSurface,
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
  return path.resolve(cliValue || path.join(projectRoot, '.qa', 'integration-showcase'));
}

function buildSmokeArtifact() {
  const results: IntegrationShowcaseSmokeResult[] = INTEGRATION_SHOWCASE_ITEMS.map((item) => {
    const issues: string[] = [];
    if (!item.fixtureAvailable || !item.modes.includes('fixture')) {
      issues.push('fixture mode ausente');
    }
    if (!item.safeDegradation.trim()) {
      issues.push('degradacao segura ausente');
    }
    if (item.trustPlaneControls.length < 2) {
      issues.push('Trust Plane insuficiente');
    }
    return {
      id: item.id,
      vendor: item.vendor,
      status: issues.length === 0 ? 'pass' : 'fail',
      mode: 'fixture',
      networkRequired: false,
      secretsRequired: false,
      mutatesExternalSystems: false,
      degradedSafely: issues.length === 0,
      evidence: issues.length === 0 ? [item.safeDegradation, ...item.evidence] : issues,
    };
  });

  return {
    schemaVersion: '1.0.0',
    phase: '58',
    generatedAt: new Date().toISOString(),
    mode: 'fixture',
    ok: results.every((result) => (
      result.status === 'pass'
      && !result.networkRequired
      && !result.secretsRequired
      && !result.mutatesExternalSystems
      && result.degradedSafely
    )),
    results,
    safety: {
      networkRequired: false,
      secretsRequired: false,
      mutatesExternalSystems: false,
      writesOnlyArtifact: smokePath,
    },
  };
}

function buildMatrixArtifact() {
  return {
    schemaVersion: '1.0.0',
    phase: '58',
    generatedAt: new Date().toISOString(),
    ok: INTEGRATION_CAPABILITY_MATRIX.length >= INTEGRATION_SHOWCASE_ITEMS.length,
    matrix: INTEGRATION_CAPABILITY_MATRIX,
  };
}

function buildPartnerSurfaceArtifact() {
  return {
    schemaVersion: '1.0.0',
    phase: '58',
    generatedAt: new Date().toISOString(),
    ok: PARTNER_SURFACE_POLICY.registryRequiredForFormalClaim,
    formalPartnersRegistered: INTEGRATION_SHOWCASE_ITEMS.filter((item) => item.formalPartnerRegistered).length,
    compatibleSurfaces: INTEGRATION_SHOWCASE_ITEMS.map((item) => ({
      id: item.id,
      vendor: item.vendor,
      partnerStatus: item.partnerStatus,
      formalPartnerRegistered: item.formalPartnerRegistered,
      publicClaim: item.partnerClaim,
    })),
    policy: PARTNER_SURFACE_POLICY,
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
  console.error('[integration-showcase] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
