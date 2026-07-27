#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PublicDocsRecipesService } from '../src/services/PublicDocsRecipesService.js';
import {
  PUBLIC_DOCS_NO_SECRETS_MATRIX,
  PUBLIC_DOCS_RECIPES,
  PUBLIC_DOCS_TROUBLESHOOTING,
  type PublicDocsRecipesFixtureResult,
} from '../src/contracts/PublicDocsRecipesContract.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const shouldRunFixtureSmoke = argv.includes('--fixture-smoke') || requirePass;
const projectRoot = process.cwd();
const websiteRoot = resolveWebsiteRoot();
const artifactDir = resolveArtifactDir();
const fixtureSmokePath = path.join(artifactDir, 'recipes-fixture-smoke.json');

async function main(): Promise<void> {
  fs.mkdirSync(artifactDir, { recursive: true });

  if (shouldRunFixtureSmoke) {
    writeJson(fixtureSmokePath, buildFixtureSmokeArtifact());
  }

  const service = new PublicDocsRecipesService({
    projectRoot,
    websiteRoot,
    artifactDir,
    fixtureSmokePath,
    requireArtifacts: requirePass || shouldRunFixtureSmoke,
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
  return path.resolve(cliValue || path.join(projectRoot, '.qa', 'public-docs-recipes'));
}

function buildFixtureSmokeArtifact() {
  const results: PublicDocsRecipesFixtureResult[] = PUBLIC_DOCS_RECIPES.map((recipe) => {
    const issues: string[] = [];
    if (!recipe.fixtureMode) {
      issues.push('recipe without fixtureMode');
    }
    if (recipe.requiresSecrets) {
      issues.push('recipe requires secrets');
    }
    if (recipe.commands.length === 0) {
      issues.push('recipe without comandos');
    }
    if (recipe.risk !== 'low' && !recipe.previewFirst) {
      issues.push('recipe de risk without preview-first');
    }
    return {
      id: recipe.id,
      status: issues.length === 0 ? 'pass' : 'fail',
      mode: 'fixture',
      commandsChecked: recipe.commands,
      requiresSecrets: recipe.requiresSecrets,
      mutatesHost: false,
      evidence: issues.length === 0 ? recipe.evidence : issues,
    };
  });

  return {
    schemaVersion: '1.0.0',
    stage: '56',
    generatedAt: new Date().toISOString(),
    mode: 'fixture',
    ok: results.every((result) => result.status === 'pass' && !result.requiresSecrets && !result.mutatesHost),
    results,
    troubleshooting: PUBLIC_DOCS_TROUBLESHOOTING,
    noSecretsMatrix: PUBLIC_DOCS_NO_SECRETS_MATRIX,
    safety: {
      mutatesHost: false,
      networkRequired: false,
      secretsRequired: false,
      writesOnlyArtifact: fixtureSmokePath,
    },
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
    throw new Error(`recusando tocar path outside do artifactDir: ${target}`);
  }
}

main().catch((error) => {
  console.error('[public-docs-recipes] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
