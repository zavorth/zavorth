import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type FileSnapshot = {
  relativePath: string;
  absolutePath: string;
  lines: number;
  anyCount: number;
};

type RuleSnapshot = {
  id: string;
  label: string;
  status: 'passed' | 'failed';
  observed: string;
  target: string;
  violations: string[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const workspaceRoot = process.cwd();
const sourceRoot = path.join(workspaceRoot, 'src');
const testsRoot = path.join(workspaceRoot, 'tests');

const MAX_SOURCE_LINES = 1500;
const MAX_SERVICES_TEST_LINES = 1900;
const MAX_LARGE_TEST_LINES = 1500;
const MAX_PUBLIC_PACKAGE_SCRIPTS = 350;
const MAX_NEW_SOURCE_FILE_LINES = 800;
const MAX_NEW_TEST_FILE_LINES = 1300;
const MAX_COMPOSITION_ROOT_IMPORTS = 35;
const SERVICES_TEST_README = 'tests/services/README.md';
const SKIPPED_SOURCE_DIRECTORIES = new Set([
  '.next',
  'coverage',
  'dist',
  'node_modules',
]);
const FORBIDDEN_NEW_SERVICES_TEST_PATTERNS = [
  /ZavorthControlService/i,
  /SharedSurfaceCommandService/i,
  /WebAppRuntimeRouteService/i,
  /WebAppSurfaceRouteService/i,
];

const LEGACY_LARGE_TEST_ALLOWLIST = new Set([
  'tests/cli/ZavorthCli.test.ts',
  'tests/integration/CrossSurfaceContinuity.test.ts',
  'tests/orchestrator/RealZavorthBridgeWatcher.test.ts',
  'tests/runtime/agent/AgentRunService.test.ts',
  'tests/services/RuntimeAccessReadinessService.test.ts',
  'tests/services/WorkspaceRoutingAdvisor.test.ts',
  'tests/domain/surface/SharedSurfaceCommandService.planes.test.ts',
]);

const LEGACY_LARGE_SOURCE_ALLOWLIST = new Set([
  'src/zavorth-control/app/(zavorthControl)/control/HomePageClient.tsx',
  'src/zavorth-control/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
  'src/zavorth-control/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
  'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.ts',
  'src/cli/ZavorthCliFlowHelpers.ts',
  'src/cli/ZavorthCliLiveNamespaces.ts',
  'src/cli/ZavorthCliRegistry.ts',
  'src/cli/ZavorthCliSurfaceHelpers.ts',
  'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
  'src/runtime/actions/ZavorthActionCatalog.ts',
  'src/runtime/agent/AgentRunService.ts',
  'src/services/WebAppConversationService.ts',
  'src/services/experience/ExperienceCoreService.ts',
  'src/agents/SwarmV2Service.ts',
  'src/services/ZavorthControlCoreRouteService.ts',
  'src/services/ZavorthRuntimeStateBusService.ts',
  'src/autonomy/ZavorthSpeculativeAutonomyService.ts',
  'src/zavorth-cli.ts',
]);

const NEW_FILE_LINE_ALLOWLIST = new Set([
  'src/agents/SwarmV2Service.ts',
  'src/agents/ZavorthSubagentRuntimeService.ts',
  'src/autonomy/ZavorthSpeculativeAutonomyService.ts',
  'src/canvas/CanvasWorkspaceService.ts',
  'src/domain/execution/infrastructure/SwarmScalePlaneService.ts',
  'src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack.ts',
  'src/hardware/ZavorthAndroidAdbBridgeService.ts',
  'src/hardware/ZavorthHardwareActionPlaneService.ts',
  'src/mesh/RemoteMeshNotebookScopedMcpServerService.ts',
  'src/mesh/ZavorthFederatedMeshControlPlaneService.ts',
  'src/runtime/zavorth-runtime-adapters/RuntimeAdapterPluginCommandHttpFixtures.ts',
  'src/runtime/zavorth-runtime-adapters/RuntimeAdapterProviderCapabilityFixtures.ts',
  'src/services/providers/ZavorthProviderRouterService.ts',
  'src/services/ZavorthControlHostPowerRoutes.ts',
  'src/services/ZavorthControlHostCommandsRoutes.ts',
  'src/services/ZavorthControlWorkspaceApprovalsRoutes.ts',
  'src/skills/SkillCuratorPlaneService.ts',
  'src/skills/ZavorthSkillCuratorLiveLoopService.ts',
  'src/skills/ZavorthSkillEvolutionService.ts',
  'src/zavorth-control/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.ts',
  'src/zavorth-control/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
  'src/zavorth-control/app/(dashboard)/control/command-center/components/CommandCenterOperationsPanel.tsx',
  'src/zavorth-control/app/(dashboard)/control/command-center/components/CommandCenterOverviewSector.tsx',
  'src/zavorth-control/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterObservabilityContracts.ts',
  'src/zavorth-control/app/(dashboard)/control/command-center/fixtures/dashboardCommandCenterFixtures.ts',
  'src/zavorth-control/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.ts',
  'src/zavorth-control/app/(dashboard)/control/command-center/projections/zavorthCommandCenterAssimilationProjection.ts',
  'src/zavorth-control/app/(dashboard)/dashboard/onboarding/page.tsx',
  'src/zavorth-control/app/(zavorthControl)/control/TerminalInboxSector.tsx',
  'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.ts',
  'src/zavorth-control/app/api/v1/models/catalog.ts',
]);

const LARGE_TEST_ALLOWED_PREFIXES = [
  'tests/telegram/controllers/',
];

const anyBudgets = [
  {
    id: 'bootstrap-any-budget',
    label: 'bootstrap any budget',
    target: 'src/bootstrap must remain free of any occurrences',
    max: 0,
    include: (file: FileSnapshot) => file.relativePath.startsWith('src/bootstrap/'),
  },
  {
    id: 'telegram-any-budget',
    label: 'Telegram any budget',
    target: 'src/telegram must stay at or below 303 any occurrences',
    max: 303,
    include: (file: FileSnapshot) => file.relativePath.startsWith('src/telegram/'),
  },
  {
    id: 'surface-any-budget',
    label: 'surface domain any budget',
    target: 'src/domain/surface must stay at or below 673 any occurrences during controlled migration',
    max: 673,
    include: (file: FileSnapshot) => file.relativePath.startsWith('src/domain/surface/'),
  },
  {
    id: 'services-root-any-budget',
    label: 'root services any budget',
    target: 'src/services/*.ts must stay at or below 1043 any occurrences during controlled migration',
    max: 1043,
    include: (file: FileSnapshot) => /^src\/services\/[^/]+\.tsx?$/.test(file.relativePath),
  },
];

const sourceFiles = readSnapshots(sourceRoot, 'src');
const testFiles = readSnapshots(testsRoot, 'tests');
const rules = [
  buildPackageScriptSurfaceRule(),
  buildSourceLineRule(sourceFiles),
  buildNewFileLineRule([...sourceFiles, ...testFiles]),
  buildServicesTestBoundaryRule(testFiles),
  buildBootstrapBarrelRule(sourceFiles),
  buildCompositionRootDependencyRule(sourceFiles),
  buildServicesTestRule(testFiles),
  buildLargeTestOwnershipRule(testFiles),
  ...anyBudgets.map((budget) => buildAnyBudgetRule(sourceFiles, budget)),
];
const failedRules = rules.filter((rule) => rule.status === 'failed');

const snapshot = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: failedRules.length > 0 ? 'failed' : 'passed',
    rules: rules.length,
    failedRules: failedRules.length,
    sourceFiles: sourceFiles.length,
    testFiles: testFiles.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[architecture-hardening] checking hardening thresholds');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[architecture-hardening] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const violation of rule.violations.slice(0, 8)) {
      console.log(`  - ${violation}`);
    }
  }
}

if (failedRules.length > 0) {
  process.exitCode = 1;
}

function buildSourceLineRule(files: FileSnapshot[]): RuleSnapshot {
  const violations = files
    .filter((file) => file.lines > MAX_SOURCE_LINES)
    .filter((file) => !LEGACY_LARGE_SOURCE_ALLOWLIST.has(file.relativePath))
    .map((file) => `${file.relativePath}: ${file.lines} lines`);
  return {
    id: 'source-line-limit',
    label: 'source file size limit',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${violations.length} file(s) above ${MAX_SOURCE_LINES} lines`,
    target: `0 file(s) in src above ${MAX_SOURCE_LINES} lines`,
    violations,
  };
}

function buildPackageScriptSurfaceRule(): RuleSnapshot {
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scriptNames = Object.keys(packageJson.scripts || {});
  const publicScriptNames = scriptNames.filter((scriptName) => !isInternalPackageScript(scriptName));
  const violations = publicScriptNames.length > MAX_PUBLIC_PACKAGE_SCRIPTS
    ? [`package.json: ${publicScriptNames.length} user-visible public scripts (${scriptNames.length} total)`]
    : [];
  return {
    id: 'package-script-surface-limit',
    label: 'public script surface',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${publicScriptNames.length} user-visible public script(s) in package.json (${scriptNames.length} total)`,
    target: `up to ${MAX_PUBLIC_PACKAGE_SCRIPTS} user-visible public scripts during transition; internal gates must stay out of the public count`,
    violations,
  };
}

function buildNewFileLineRule(files: FileSnapshot[]): RuleSnapshot {
  const newPaths = readNewWorkspacePaths();
  const violations = files
    .filter((file) => newPaths.has(file.relativePath))
    .filter((file) => !NEW_FILE_LINE_ALLOWLIST.has(file.relativePath))
    .filter((file) => {
      const maxLines = file.relativePath.startsWith('tests/')
        ? MAX_NEW_TEST_FILE_LINES
        : MAX_NEW_SOURCE_FILE_LINES;
      return file.lines > maxLines;
    })
    .map((file) => {
      const maxLines = file.relativePath.startsWith('tests/')
        ? MAX_NEW_TEST_FILE_LINES
        : MAX_NEW_SOURCE_FILE_LINES;
      return `${file.relativePath}: ${file.lines} lines in new file; limit ${maxLines}`;
    });

  return {
    id: 'new-file-line-limit',
    label: 'new file size limit',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${newPaths.size} new file(s) tracked by git`,
    target: `new src files <= ${MAX_NEW_SOURCE_FILE_LINES} lines; new test files <= ${MAX_NEW_TEST_FILE_LINES} lines`,
    violations,
  };
}

function buildServicesTestBoundaryRule(files: FileSnapshot[]): RuleSnapshot {
  const newPaths = readNewWorkspacePaths();
  const readmePath = path.join(workspaceRoot, SERVICES_TEST_README);
  const violations = !fs.existsSync(readmePath)
    ? [`${SERVICES_TEST_README}: local policy missing`]
    : [];

  const forbiddenNewServicesTests = files
    .filter((file) => newPaths.has(file.relativePath))
    .filter((file) => file.relativePath.startsWith('tests/services/'))
    .filter((file) =>
      FORBIDDEN_NEW_SERVICES_TEST_PATTERNS.some((pattern) => pattern.test(path.basename(file.relativePath))),
    )
    .map((file) => `${file.relativePath}: new surface/zavorthControl tests must start in tests/domain/surface`);

  violations.push(...forbiddenNewServicesTests);

  return {
    id: 'services-test-boundary',
    label: 'tests/services as compatibility zone',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${forbiddenNewServicesTests.length} forbidden new test(s) in tests/services`,
    target: `${SERVICES_TEST_README} present and new surface/zavorthControl tests outside tests/services`,
    violations,
  };
}

function buildBootstrapBarrelRule(files: FileSnapshot[]): RuleSnapshot {
  const barrel = files.find((file) => file.relativePath === 'src/bootstrap/bootstrapSurface.ts');
  const exportOnly = barrel
    ? fs.readFileSync(barrel.absolutePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .every((line) => line.startsWith('export '))
    : false;
  const violations = !barrel
    ? ['src/bootstrap/bootstrapSurface.ts not found']
    : barrel.lines > 20 || !exportOnly
      ? [`src/bootstrap/bootstrapSurface.ts must remain a thin barrel; current: ${barrel.lines} lines, exportOnly=${exportOnly}`]
      : [];
  return {
    id: 'bootstrap-surface-barrel',
    label: 'bootstrapSurface thin barrel',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: barrel ? `${barrel.lines} lines` : 'missing',
    target: 'up to 20 lines and exports only',
    violations,
  };
}

function buildCompositionRootDependencyRule(files: FileSnapshot[]): RuleSnapshot {
  const compositionRoots = [
    'src/bootstrap/bootstrapSurfaceComposition.ts',
    'src/bootstrap/bootstrapTelegramSurface.ts',
    'src/bootstrap/bootstrapRuntime.ts',
    'src/bootstrap/bootstrapToolRuntime.ts',
  ];
  const violations: string[] = [];

  for (const relativePath of compositionRoots) {
    const file = files.find((candidate) => candidate.relativePath === relativePath);
    if (!file) {
      violations.push(`${relativePath}: composition root missing`);
      continue;
    }

    const imports = fs
      .readFileSync(file.absolutePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^import\s/.test(line.trim())).length;
    if (imports > MAX_COMPOSITION_ROOT_IMPORTS) {
      violations.push(`${relativePath}: ${imports} direct imports; limit ${MAX_COMPOSITION_ROOT_IMPORTS}`);
    }
  }

  return {
    id: 'composition-root-dependency-limit',
    label: 'composition root dependencies',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${compositionRoots.length} composition root(s) audited`,
    target: `composition roots <= ${MAX_COMPOSITION_ROOT_IMPORTS} direct imports`,
    violations,
  };
}

function buildServicesTestRule(files: FileSnapshot[]): RuleSnapshot {
  const violations = files
    .filter((file) => file.relativePath.startsWith('tests/services/'))
    .filter((file) => file.lines > MAX_SERVICES_TEST_LINES)
    .map((file) => `${file.relativePath}: ${file.lines} lines`);
  return {
    id: 'services-test-size-limit',
    label: 'tests/services without new mega suites',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${violations.length} suite(s) above ${MAX_SERVICES_TEST_LINES} lines in tests/services`,
    target: `0 suite(s) in tests/services above ${MAX_SERVICES_TEST_LINES} lines`,
    violations,
  };
}

function buildLargeTestOwnershipRule(files: FileSnapshot[]): RuleSnapshot {
  const violations = files
    .filter((file) => file.lines > MAX_LARGE_TEST_LINES)
    .filter((file) => !isAllowedLargeTest(file.relativePath))
    .map((file) => `${file.relativePath}: ${file.lines} lines without ownership/allowlist`);
  return {
    id: 'large-test-ownership',
    label: 'large suite ownership',
    status: violations.length > 0 ? 'failed' : 'passed',
    observed: `${violations.length} large suite(s) without explicit owner`,
    target: `0 suite(s) above ${MAX_LARGE_TEST_LINES} lines outside a bounded context or allowlist`,
    violations,
  };
}

function buildAnyBudgetRule(
  files: FileSnapshot[],
  budget: {
    id: string;
    label: string;
    target: string;
    max: number;
    include(file: FileSnapshot): boolean;
  },
): RuleSnapshot {
  const matching = files.filter((file) => budget.include(file));
  const total = matching.reduce((sum, file) => sum + file.anyCount, 0);
  const offenders = matching
    .filter((file) => file.anyCount > 0)
    .sort((left, right) => right.anyCount - left.anyCount)
    .slice(0, 8)
    .map((file) => `${file.relativePath}: ${file.anyCount}`);
  return {
    id: budget.id,
    label: budget.label,
    status: total > budget.max ? 'failed' : 'passed',
    observed: `${total} any occurrence(s)`,
    target: budget.target,
    violations: total > budget.max ? offenders : [],
  };
}

function isAllowedLargeTest(relativePath: string): boolean {
  return LEGACY_LARGE_TEST_ALLOWLIST.has(relativePath)
    || LARGE_TEST_ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function readNewWorkspacePaths(): Set<string> {
  try {
    const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .filter((line) => line.startsWith('A ') || line.startsWith('?? '))
        .map((line) => line.slice(3).replace(/\\/g, '/'))
        .filter((relativePath) => /^(src|tests)\//.test(relativePath) && /\.(ts|tsx)$/.test(relativePath)),
    );
  } catch {
    return new Set();
  }
}

function readSnapshots(root: string, topLevel: string): FileSnapshot[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return walk(root)
    .filter((absolutePath) => /\.(ts|tsx)$/.test(absolutePath))
    .map((absolutePath) => {
      const contents = fs.readFileSync(absolutePath, 'utf8');
      const relativePath = `${topLevel}/${path.relative(root, absolutePath).replace(/\\/g, '/')}`;
      return {
        absolutePath,
        relativePath,
        lines: contents.split(/\r?\n/).length,
        anyCount: (contents.match(/\bany\b/g) || []).length,
      };
    });
}

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_SOURCE_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...walk(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function isInternalPackageScript(scriptName: string): boolean {
  return scriptName.endsWith(':check')
    || scriptName.endsWith(':json')
    || scriptName.startsWith('qa:')
    || scriptName.startsWith('test:')
    || scriptName.startsWith('security:')
    || scriptName.startsWith('identity:')
    || scriptName.startsWith('architecture:')
    || scriptName === 'workspace:check'
    || scriptName.includes(':smoke')
    || scriptName.includes(':debug');
}
