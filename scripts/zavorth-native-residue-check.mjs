import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const notes = [];
const legacyGatewayBaseUrlMarker = ['OMNI', 'ROUTE_BASE_URL'].join('');
const maxRepoWideScanBytes = 512 * 1024;

const rawSkillLibraryPrefixes = [
  'skill-library/.raw/',
  'skill-library/imported-raw/',
  'skill-library/native-raw/',
  'skill-library/review/',
];

const forbiddenPatterns = [
  { label: 'Antigravity', pattern: /antigravity/i },
  { label: '9router', pattern: /9router/i },
  { label: 'sk_zavorthBridge', pattern: /sk_zavorthBridge/i },
  { label: 'legacy gateway base url env', pattern: new RegExp(legacyGatewayBaseUrlMarker, 'i') },
  { label: 'x-zavorth-bridge-source', pattern: /x-zavorth-bridge-source/i },
];

const historicalProvenanceFiles = new Map();

const scanExtensions = new Set([
  '.cjs',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const skippedPathParts = new Set([
  '.agents',
  '.git',
  '.next',
  '.superpowers',
  'artifacts',
  'coverage',
  'dist',
  'dist-ops',
  'dist-remote-transport',
  'dist-smoke',
  'node_modules',
]);

const retiredExecutorTerms = [
  ['ope', 'nclaw'],
].map((parts) => parts.join(''));

const launchFacingRetiredExecutorFiles = [
  '.env.example',
  'config/platform-registry.json',
  'src/capabilities/BuiltinCapabilities.ts',
  'src/services/IdentityContainmentService.ts',
  'src/services/ZavorthCapabilityOsService.ts',
  'src/execution/ExternalExecutor.ts',
  'src/execution/execution-gateway/ExecutionGatewayAliases.ts',
  'src/ai-gateway/shared/constants/cliTools.ts',
  'src/ai-gateway/shared/services/cli-runtime/cliRuntimeTools.ts',
  'src/ai-gateway/app/api/cli-tools/_shared/externalExecutorSettingsRoute.ts',
  'src/ai-gateway/lib/acp/registry.ts',
  'src/domain/platform-ecosystem/infrastructure/integration-registry/catalog-local.ts',
  'src/domain/platform-ecosystem/infrastructure/integration-registry/IntegrationRegistryCatalogLocalRuntime.ts',
];

const activeRetiredExecutorPattern = new RegExp(
  `\\b(${retiredExecutorTerms.join('|')})\\b|(${retiredExecutorTerms.join('|')})[_-]|[_-](${retiredExecutorTerms.join('|')})\\b`,
  'i',
);

checkCrossSurfaceScript();
checkFixtureResidues();
checkSharedSurfaceAliases();
checkLaunchFacingRetiredExecutorResidues();
checkRepoWideLegacyResidues();

if (failures.length > 0) {
  console.error('[native-residue] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[native-residue] ok: cross-surface test script, fixtures, shared-surface aliases, and repo-wide legacy residue policy passed.');
for (const note of notes) {
  console.log(`[native-residue] ${note}`);
}

function checkCrossSurfaceScript() {
  const packageJsonPath = abs('package.json');
  const testPath = 'tests/integration/CrossSurfaceContinuity.test.ts';
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const script = packageJson.scripts?.['test:cross-surface'];

  if (!script) {
    failures.push('package.json: missing scripts.test:cross-surface');
    return;
  }

  if (/passWithNoTests/i.test(script)) {
    failures.push('package.json: test:cross-surface must not use --passWithNoTests');
  }

  if (!script.includes(testPath)) {
    failures.push(`package.json: test:cross-surface must target ${testPath}`);
  }

  const absoluteTestPath = abs(testPath);
  if (!fs.existsSync(absoluteTestPath)) {
    failures.push(`${testPath}: missing cross-surface continuity test`);
    return;
  }

  const source = fs.readFileSync(absoluteTestPath, 'utf8');
  expectIncludes(testPath, source, [
    'WebAppConversationService',
    'BotGateway',
    'processChatSend',
    'processTextMessage',
    'shared commands',
  ]);

  if (!/\b(?:it|test)\s*\(/.test(source)) {
    failures.push(`${testPath}: must execute at least one real Jest test`);
  }
}

function checkFixtureResidues() {
  const fixturePath = 'tests/services/ZavorthGovernanceControlPlaneService.test.ts';
  const source = readIfExists(fixturePath);
  if (!source) return;

  if (/id:\s*['"]zavorthBridge['"]/i.test(source)) {
    failures.push(`${fixturePath}: fixture id must not use legacy zavorthBridge identity`);
  }
}

function checkSharedSurfaceAliases() {
  // Free-text natural transport pack was deleted (agent-first).
  // Keep slash shared-surface free of legacy zavorthBridge product naming.
  const aliasPath = 'src/domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.ts';
  const source = readIfExists(aliasPath);
  if (!source) return;

  if ((new RegExp('github-' + 'open' + 'claw' + '|' + 'open' + 'claw' + '\\s+inspired', 'i')).test(source)) {
    failures.push(`${aliasPath}: shared-surface must not reintroduce competitor brand hardcoding`);
  }
}

function checkLaunchFacingRetiredExecutorResidues() {
  for (const filePath of launchFacingRetiredExecutorFiles) {
    const source = readIfExists(filePath);
    if (!source) continue;
    source.split(/\r...\n/).forEach((line, index) => {
      if (activeRetiredExecutorPattern.test(line)) {
        failures.push(`${filePath}:${index + 1}: launch-facing runtime surface contains retired executor naming`);
      }
    });
  }
}

function checkRepoWideLegacyResidues() {
  const files = listGitVisibleFiles()
    .map(normalize)
    .filter((filePath) => shouldScan(filePath));

  let scanned = 0;
  let historicalHits = 0;
  let policyBoundaryHits = 0;
  let skippedLargeFiles = 0;

  for (const filePath of files) {
    const absolutePath = abs(filePath);
    if (!fs.existsSync(absolutePath)) continue;
    const stat = fs.statSync(absolutePath);
    if (stat.size > maxRepoWideScanBytes) {
      skippedLargeFiles += 1;
      continue;
    }

    const source = fs.readFileSync(absolutePath, 'utf8');
    const lines = source.split(/\r...\n/);
    const historicalMarker = historicalProvenanceFiles.get(filePath);
    const isHistoricalProvenance = Boolean(historicalMarker);
    const isPolicyBoundary = /^scripts\/zavorth-(native|identity|auth|transport|cli).*\.mjs$/.test(filePath);

    if (isHistoricalProvenance && !source.includes(historicalMarker)) {
      failures.push(`${filePath}: historical legacy residue boundary must include "${historicalMarker}"`);
    }

    scanned += 1;
    lines.forEach((line, index) => {
      for (const forbidden of forbiddenPatterns) {
        if (!forbidden.pattern.test(line)) continue;

        if (isHistoricalProvenance) {
          historicalHits += 1;
          return;
        }

        if (isPolicyBoundary) {
          policyBoundaryHits += 1;
          return;
        }

        failures.push(`${filePath}:${index + 1}: forbidden runtime/product legacy residue "${forbidden.label}"`);
      }
    });
  }

  notes.push(`scanned ${scanned} git-visible text file(s) for forbidden runtime/product legacy residues`);
  notes.push('ignored raw skill-library staging prefixes during repo-wide legacy residue scan');
  if (skippedLargeFiles > 0) {
    notes.push(`skipped ${skippedLargeFiles} large text file(s) above ${maxRepoWideScanBytes} bytes`);
  }
  if (historicalHits > 0) {
    notes.push(`allowed ${historicalHits} historical provenance residue(s) in explicitly marked docs`);
  }
  if (policyBoundaryHits > 0) {
    notes.push(`allowed ${policyBoundaryHits} legacy token definition(s) inside native hygiene guard policy scripts`);
  }
}

function listGitVisibleFiles() {
  const args = ['ls-files', '--cached', '--others', '--exclude-standard'];
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return result.stdout.split(/\r...\n/).filter(Boolean);
  }

  const gitDir = path.join(root, '.git');
  if (fs.existsSync(gitDir)) {
    const workTreeResult = spawnSync('git', [`--git-dir=${gitDir}`, `--work-tree=${root}`, ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    if (workTreeResult.status === 0) {
      notes.push('used explicit --git-dir/--work-tree for git-visible file scan');
      return workTreeResult.stdout.split(/\r...\n/).filter(Boolean);
    }
  }

  failures.push(`git ls-files failed: ${result.stderr || result.status}`);
  return [];
}

function shouldScan(filePath) {
  if (rawSkillLibraryPrefixes.some((prefix) => filePath.startsWith(prefix))) return false;

  const parts = filePath.split('/');
  if (parts.some((part) => skippedPathParts.has(part))) return false;

  const basename = path.basename(filePath);
  if (basename === '.env.example') return true;

  return scanExtensions.has(path.extname(filePath));
}

function expectIncludes(filePath, source, snippets) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${filePath}: expected to include ${snippet}`);
    }
  }
}

function readIfExists(filePath) {
  const absolutePath = abs(filePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${filePath}: missing`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function abs(filePath) {
  return path.join(root, filePath);
}

function normalize(filePath) {
  return filePath.replace(/\\/g, '/');
}
