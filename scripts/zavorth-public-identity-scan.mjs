import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const failures = [];
const RETIRED_IDENTITY_TERMS = [
  ['Basi', 'lisk'],
  ['basi', 'lisk'],
  ['BASI', 'LISK'],
  ['Aster', 'lyn'],
  ['aster', 'lyn'],
  ['ASTER', 'LYN'],
].map((parts) => parts.join(''));
const RETIRED_PATH_TERMS = [
  ['basi', 'lisk'],
  ['aster', 'lyn'],
].map((parts) => parts.join(''));
const LEGACY_IDENTITY_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9])(${RETIRED_IDENTITY_TERMS.join('|')})(?=$|[^A-Za-z0-9])`,
);
const LEGACY_PATH_PATTERN = new RegExp(`(^|[\\\\/._-])(${RETIRED_PATH_TERMS.join('|')})(?=$|[\\\\/._-])`, 'i');
const RETIRED_EXECUTOR_TERMS = [
  ['ope', 'nclaw'],
].map((parts) => parts.join(''));
const ACTIVE_RETIRED_EXECUTOR_PATTERN = new RegExp(
  `\\b(${RETIRED_EXECUTOR_TERMS.join('|')})\\b|(${RETIRED_EXECUTOR_TERMS.join('|')})[_-]|[_-](${RETIRED_EXECUTOR_TERMS.join('|')})\\b`,
  'i',
);
// Launch-facing surfaces after Control moved under ai-gateway (S8: keep list real).
const LAUNCH_FACING_RETIRED_EXECUTOR_FILES = [
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

const packageJson = readJson(packagePath);

assertPackageIdentity(packageJson);
assertPackageContracts(packageJson);
assertNoLegacyTrackedPaths();
assertNoRetiredExecutorInLaunchFacingRuntimeFiles();
scanPublicPaths(resolvePublicIdentityPaths(packageJson));

if (failures.length > 0) {
  console.error('[zavorth-public-identity] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[zavorth-public-identity] ok: public identity surfaces are Zavorth-native.');

function assertPackageIdentity(manifest) {
  if (manifest.name !== 'zavorth') {
    failures.push(`package.json:name must be "zavorth", found ${JSON.stringify(manifest.name)}`);
  }

  if (!String(manifest.description || '').includes('Zavorth')) {
    failures.push('package.json:description must identify the product as Zavorth');
  }

  const binNames = Object.keys(manifest.bin || {});
  if (binNames.length !== 1 || binNames[0] !== 'zavorth') {
    failures.push(`package.json:bin must expose only "zavorth", found ${binNames.join(', ') || '<none>'}`);
  }

  for (const filePath of manifest.files || []) {
    if (LEGACY_PATH_PATTERN.test(filePath)) {
      failures.push(`package.json:files contains legacy public path ${filePath}`);
    }
  }
}

function assertPackageContracts(manifest) {
  for (const [scriptName, scriptValue] of Object.entries(manifest.scripts || {})) {
    if (LEGACY_PATH_PATTERN.test(scriptName) || LEGACY_IDENTITY_PATTERN.test(String(scriptValue || ''))) {
      failures.push(`package.json:scripts contains legacy identity in ${scriptName}`);
    }
  }

  const dependencyGroups = [
    ['dependencies', manifest.dependencies || {}],
    ['devDependencies', manifest.devDependencies || {}],
    ['optionalDependencies', manifest.optionalDependencies || {}],
    ['peerDependencies', manifest.peerDependencies || {}],
  ];
  for (const [groupName, entries] of dependencyGroups) {
    for (const dependencyName of Object.keys(entries)) {
      if (LEGACY_PATH_PATTERN.test(dependencyName)) {
        failures.push(`package.json:${groupName} contains legacy dependency ${dependencyName}`);
      }
    }
  }
}

function assertNoLegacyTrackedPaths() {
  for (const relativePath of listTrackedFiles()) {
    if (LEGACY_PATH_PATTERN.test(relativePath)) {
      failures.push(`tracked path contains legacy identity: ${relativePath}`);
    }
  }
}

function assertNoRetiredExecutorInLaunchFacingRuntimeFiles() {
  for (const relativePath of LAUNCH_FACING_RETIRED_EXECUTOR_FILES) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath}: launch-facing identity file missing`);
      continue;
    }

    const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (ACTIVE_RETIRED_EXECUTOR_PATTERN.test(line)) {
        failures.push(`${relativePath}:${index + 1}: launch-facing runtime surface contains retired executor naming`);
      }
    });
  }
}

function resolvePublicIdentityPaths(manifest) {
  const paths = new Set([
    'package.json',
    'package-lock.json',
    '.env.example',
    'README.md',
    'BOOTSTRAP.md',
    'IDENTITY.md',
    'AGENTS.md',
    'ops/recovery/DisasterRecoveryPlan.md',
    'scripts/command-catalog.json',
    'docs/product-direction.md',
    'docs/README.md',
    'src/zavorth-cli.ts',
    'scripts/setup-v3.ts',
    'scripts/install-zavorth.ps1',
    'scripts/install-zavorth.sh',
    // Control lives under ai-gateway (paths updated for S8 identity scan).
    'src/ai-gateway/app/(zavorthControl)/control/page.tsx',
    'src/ai-gateway/shared/constants/cliTools.ts',
    'src/ai-gateway/shared/services/cli-runtime/cliRuntimeTools.ts',
    'src/ai-gateway/app/api/cli-tools/_shared/externalExecutorSettingsRoute.ts',
    'src/ai-gateway/lib/acp/registry.ts',
  ]);

  for (const entry of manifest.files || []) {
    if (isTextualPublicFile(entry)) {
      paths.add(entry);
    }
  }

  addTextFilesUnder(paths, [
    'config',
    'deploy',
    'distribution',
    'examples',
    'specs',
    'third_party',
  ]);

  return [...paths].sort();
}

function scanPublicPaths(paths) {
  for (const relativePath of paths) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (LEGACY_IDENTITY_PATTERN.test(line) && !isAllowedHistoricalLine(line)) {
        failures.push(`${relativePath}:${index + 1}: legacy identity appears as active public copy`);
      }
    });
  }
}

function addTextFilesUnder(paths, directories) {
  for (const directory of directories) {
    const absoluteDirectory = path.join(root, directory);
    if (!fs.existsSync(absoluteDirectory) || !fs.statSync(absoluteDirectory).isDirectory()) {
      continue;
    }
    for (const relativePath of walkTextFiles(absoluteDirectory)) {
      paths.add(relativePath);
    }
  }
}

function walkTextFiles(absoluteDirectory) {
  const results = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...walkTextFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && isTextualPublicFile(relativePath)) {
      results.push(relativePath);
    }
  }
  return results;
}

function isTextualPublicFile(relativePath) {
  return /\.(json|md|txt|ts|tsx|js|mjs|cjs|sh|ps1)$/i.test(relativePath)
    && !relativePath.startsWith('dist/')
    && !relativePath.startsWith('dist-ops/');
}

function isAllowedHistoricalLine(line) {
  return [
    /alias/i,
    /blueprint/i,
    /codename/i,
    /histor/i,
    /legacy/i,
    /legad/i,
    /deprecia/i,
    /deprecated/i,
    /compat/i,
    /audit/i,
    /changelog/i,
    /external/i,
    /externo/i,
    /fallback/i,
    /migra/i,
    /previous/i,
    /retired/i,
    /retained/i,
    /retido/i,
  ].some((pattern) => pattern.test(line));
}

function listTrackedFiles() {
  const raw = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  return raw
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
