import fs from 'fs';
import path from 'path';

const root = process.cwd();

const checks = [
  {
    file: 'src/contracts/LegacySurfaceContract.ts',
    includes: [
      'LEGACY_SURFACE_CONTAINMENT_VERSION',
      "canonicalEntry: '/dashboard'",
      "retiredSurfaces: ['/app', '/classic']",
    ],
  },
  {
    file: 'src/services/LegacySurfaceContainmentService.ts',
    includes: [
      'legacyRoutesRetired: true',
      'legacy-surface-containment',
      'decideFeatureDestination',
      'Use /dashboard como a unica entrada web',
      'Runtime API, Gateway Contract',
    ],
  },
  {
    file: 'src/services/RuntimeAccessManifestService.ts',
    alternatives: [
      'src/domain/gateway/infrastructure/runtime-access/RuntimeAccessManifestService.ts',
      'src/runtime/access/RuntimeAccessManifestService.ts',
    ],
    includes: [
      'legacyContainment',
      'legacyAppUrl: null',
      'classicUrl: null',
      '/app e /classic foram removidas',
    ],
  },
  {
    file: 'src/services/WebConsoleAssetService.ts',
    alternatives: [
      'src/domain/surface/presentation/web-console/WebConsoleAssetService.ts',
    ],
    includes: [
      'isRemovedSurfacePath',
      'This web surface has been removed. Use /dashboard.',
      "pathname === '/app.js'",
      "pathname === '/styles.css'",
      '410',
    ],
  },
  {
    file: 'src/services/DashboardServiceHelpers.ts',
    alternatives: [
      'src/domain/surface/presentation/dashboard/dashboard-service/DashboardServiceHelpers.ts',
    ],
    includes: [
      'This web surface has been removed. Use /dashboard.',
      "pathname === '/app'",
      "pathname === '/classic'",
      '410',
    ],
  },
  {
    file: 'src/services/ZavorthControlServiceHelpers.ts',
    alternatives: [
      'src/domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceHelpers.ts',
    ],
    includes: [
      'This web surface has been removed. Use /zavorthControl.',
      "pathname === '/app'",
      "pathname === '/classic'",
      '410',
    ],
  },
  {
    file: 'src/telegram/bot-gateway/support/BotGatewayMessageProcessing.ts',
    includes: [
      'tryHandleNaturalConversationThroughLegacyUnifiedGateway',
      'const legacyUnifiedGateway = runtime.legacyUnifiedGateway || null',
      'legacy-unified-conversation-fallback-v1',
      'legacyUnifiedGatewayBypassed',
    ],
  },
  {
    file: 'src/services/WebAppConversationService.ts',
    includes: [
      'maybeHandleDirectAgentConversation',
      'maybeHandleLegacyUnifiedGatewayIngress',
      'resolveLegacyUnifiedGateway',
      'legacy-unified-conversation-fallback-v1',
      'legacyUnifiedGatewayBypassed',
    ],
  },
  {
    file: 'src/context-engine/LegacyUnifiedGatewayAdapter.ts',
    includes: [
      'export class LegacyUnifiedGatewayAdapter',
      'fallback de compatibilidade',
      'ZavorthAgentGateway canonical',
    ],
  },
  {
    file: 'src/cli/ZavorthCliContract.ts',
    includes: [
      'legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter',
    ],
  },
  {
    file: 'src/cli/ZavorthCliFlowHelpers.ts',
    includes: [
      'executeCliLegacyUnifiedConversation',
      'resolveCliLegacyUnifiedGateway',
      'legacy_unified_gateway_adapter',
    ],
  },
];

const failures = [];
const removedShimPath = path.join('src', 'context-engine', ['Unified', 'Gateway.ts'].join(''));
const removedRuntimeAlias = ['unified', 'Gateway'].join('');

const forbiddenGatewayReferences = [
  {
    pattern: /from ['"][^'"]*context-engine\/UnifiedGateway\.js['"]/,
    label: 'direct import from deprecated context-engine/UnifiedGateway.js',
  },
  {
    pattern: /\bnew\s+UnifiedGateway\b/,
    label: 'new UnifiedGateway',
  },
  {
    pattern: /\bclass\s+UnifiedGateway\b/,
    label: 'class UnifiedGateway',
  },
  {
    pattern: /\bimport\s+(?:type\s+)...\{[^}]*\bUnifiedGateway\b[^}]*\}/,
    label: 'UnifiedGateway named import',
  },
];

const removedLegacyAliasTokens = [
  ['wire', 'UnifiedGateway', 'AgentCallback'].join(''),
  ['executeCli', 'UnifiedConversation'].join(''),
  ['attach', 'UnifiedGateway'].join(''),
  ['include', 'UnifiedGateway'].join(''),
];

for (const check of checks) {
  const candidateFiles = [check.file, ...(check.alternatives || [])];
  const resolvedFile = candidateFiles.find((file) => fs.existsSync(path.join(root, file)));
  const absolute = resolvedFile ? path.join(root, resolvedFile) : path.join(root, check.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`${check.file}: missing`);
    continue;
  }
  const content = fs.readFileSync(absolute, 'utf8');
  for (const expected of check.includes) {
    if (!content.includes(expected)) {
      failures.push(`${check.file}: missing "${expected}"`);
    }
  }
}

if (fs.existsSync(path.join(root, removedShimPath))) {
  failures.push(`${removedShimPath}: removed gateway shim must not exist`);
}

for (const file of collectSourceFiles(['src', 'tests'])) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(removedRuntimeAlias)) {
    failures.push(`${relative}: removed runtime gateway alias still present; use legacyUnifiedGateway`);
  }
  for (const token of removedLegacyAliasTokens) {
    if (content.includes(token)) {
      failures.push(`${relative}: removed legacy alias "${token}" still present`);
    }
  }
  for (const rule of forbiddenGatewayReferences) {
    if (rule.pattern.test(content)) {
      failures.push(`${relative}: forbidden ${rule.label}; use LegacyUnifiedGatewayAdapter`);
    }
  }
}

if (failures.length > 0) {
  console.error('[legacy-containment] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[legacy-containment] ok: /dashboard canonical, /app e /classic removidos.');

function collectSourceFiles(directories) {
  const files = [];
  for (const directory of directories) {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    walk(absolute, files);
  }
  return files.filter((file) => /\.(?:mjs|js|ts|tsx)$/.test(file));
}

function walk(directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
      continue;
    }
    files.push(absolute);
  }
}
