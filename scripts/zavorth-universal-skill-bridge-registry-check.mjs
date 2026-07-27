#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  runProjectionFixture(),
  runInvocationFixture(),
  runLiveApprovalFixture(),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-universal-skill-bridge-registry] checking Connector registry');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-universal-skill-bridge-registry] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthUniversalSkillBridgeRegistryContract.ts',
    'src/services/UniversalSkillBridgeRegistryService.ts',
    'scripts/zavorth-universal-skill-bridge-registry.ts',
    'scripts/zavorth-universal-skill-bridge-registry-check.mjs',
    'tests/services/UniversalSkillBridgeRegistryService.test.ts',
    'src/services/SkillCatalogApiService.ts',
    'src/services/SkillLibraryPresentationService.ts',
    'src/services/ZavorthControlLegacyRouteService.ts',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'universal-skill-bridge-registry-files',
    label: 'Connector registry files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'registry contract, service, CLI, API surface and tests are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthUniversalSkillBridgeRegistryContract.ts', [
      'ZAVORTH_UNIVERSAL_SKILL_BRIDGE_REGISTRY_CONTRACT_VERSION',
      'catalogActionsUseBridgeOnly',
      'Credential vault - Activation UX and Channel Command Packs',
    ]],
    ['src/services/UniversalSkillBridgeRegistryService.ts', [
      'buildProjection',
      'bridgeRuntime.invoke',
      'registryDoesNotExecuteSkills',
      'dry-run',
      'live-prepare',
    ]],
    ['src/services/SkillCatalogApiService.ts', [
      'skillBridgeRegistryService',
      'bridgeReady',
      'Bridge:',
    ]],
    ['src/services/SkillLibraryPresentationService.ts', [
      'Dry-run pelo bridge',
      'catalog.bridge',
    ]],
    ['src/services/ZavorthControlLegacyRouteService.ts', [
      '/api/skills/bridge',
      'getSkillBridgeSnapshot',
    ]],
    ['package.json', [
      'zavorth:universal-skill-bridge-registry',
      'zavorth:universal-skill-bridge-registry:check',
      'qa:zavorth-universal-skill-bridge-registry',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: 'universal-skill-bridge-registry-markers',
    label: 'Connector registry markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'registry is wired to catalog, library and zavorthControl API markers',
    details: missing,
  };
}

function runProjectionFixture() {
  const fixture = createFixture();
  try {
    return runRegistryRule({
      id: 'universal-skill-bridge-registry-projection',
      label: 'Registry projects bridge actions',
      target: 'selected imported skill has dry-run and live bridge actions without invocation',
      args: ['--project-root', fixture.root, '--skill', 'research-pack', '--json'],
      expect: (snapshot) => snapshot.selected?.skillName === 'research-pack'
        && snapshot.invocation === null
        && snapshot.selected.actions.some((action) => action.kind === 'dry-run')
        && snapshot.selected.actions.some((action) => action.kind === 'live-prepare')
        && snapshot.summary.imported >= 1,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runInvocationFixture() {
  const fixture = createFixture();
  try {
    return runRegistryRule({
      id: 'universal-skill-bridge-registry-invoke',
      label: 'Registry invokes Approval gate bridge on request',
      target: 'invoke=1 returns a dry-run bridge invocation and prepared envelope',
      args: ['--project-root', fixture.root, '--skill', 'research-pack', '--invoke', '--json'],
      expect: (snapshot) => snapshot.invocation?.status === 'dry-run'
        && snapshot.invocation?.promptEnvelope?.text.includes('<untrusted_skill_content')
        && snapshot.summary.invocationPrepared === true,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runLiveApprovalFixture() {
  const fixture = createFixture();
  try {
    return runRegistryRule({
      id: 'universal-skill-bridge-registry-live-approval',
      label: 'Registry preserves live approval gate',
      target: 'live invocation through registry still requires owner approval',
      args: ['--project-root', fixture.root, '--skill', 'research-pack', '--invoke', '--live', '--json'],
      expect: (snapshot) => snapshot.invocation?.status === 'approval-required'
        && snapshot.invocation?.promptEnvelope === null
        && snapshot.invocation?.summary?.executionPerformed === false,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-usbr-'));
  fs.mkdirSync(path.join(rootDir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'config', 'skill-sources.json'), JSON.stringify({
    version: 1,
    updatedAt: '2026-05-10T16:00:00.000Z',
    sources: [
      {
        id: 'workspace-library',
        label: 'Workspace skill library',
        kind: 'workspace',
        trust: 'trusted',
        enabled: true,
        ingestionMode: 'local-scan',
        path: 'skill-library',
        createIfMissing: true,
        ownership: 'workspace',
        registrySource: 'zavorth:local-workspace',
      },
      {
        id: 'workspace-imported-library',
        label: 'Workspace imported skill library',
        kind: 'workspace',
        trust: 'review',
        enabled: true,
        ingestionMode: 'local-scan',
        path: 'skill-library/imported',
        createIfMissing: false,
        ownership: 'curated-import',
        registrySource: 'zavorth:curated-import',
        notes: ['Fixture source for governed bridge registry checks.'],
      },
    ],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'config', 'skill-allowlist.json'), JSON.stringify({
    version: 1,
    updatedAt: '2026-05-10T16:00:00.000Z',
    defaultPolicy: 'deny',
    allowedSourceIds: ['workspace-library', 'workspace-imported-library'],
    rules: [
      {
        sourceId: 'workspace-library',
        mode: 'all',
        skillNames: [],
        reason: 'Fixture local skills are visible so the registry can keep them outside bridge actions.',
      },
      {
        sourceId: 'workspace-imported-library',
        mode: 'all',
        skillNames: [],
        reason: 'Fixture imported skills are discovery-visible while live usage remains owner-approval gated by the bridge.',
      },
    ],
  }, null, 2), 'utf8');
  fs.mkdirSync(path.join(rootDir, '.agents', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'skill-library'), { recursive: true });
  writeImportedSkill(rootDir, 'research-pack', 'Research local documents and produce evidence notes.', 'Read local notes and produce evidence.');
  writeLocalSkill(rootDir, 'local-pack');
  return { root: rootDir };
}

function writeImportedSkill(rootDir, name, description, body) {
  const skillDir = path.join(rootDir, 'skill-library', 'imported', name);
  fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    `# ${name}`,
    '',
    body,
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skillDir, 'references', 'notes.md'), '# Notes\n', 'utf8');
  fs.writeFileSync(path.join(skillDir, 'ORIGIN.json'), JSON.stringify({
    version: 1,
    importedAt: '2026-05-10T16:00:00.000Z',
    importMode: 'manual',
    skillName: name,
    source: {
      id: `universal-source:${name}`,
      label: 'Universal fixture',
      kind: 'repository',
      trust: 'review',
      registrySource: 'zavorth:universal-skill-intake',
      upstream: path.join(rootDir, 'source'),
      license: 'MIT',
      ownership: 'universal-intake',
    },
    originalSkillPath: `${name}/SKILL.md`,
    originalRelativePath: name,
    copiedFiles: ['SKILL.md', 'references/notes.md'],
    governance: {
      risk: {
        score: 20,
        level: 'low',
        reviewRequired: true,
        reasons: ['fixture'],
      },
      licensePolicy: {
        label: 'permissive',
        allowImport: true,
        allowRuntimeUse: true,
        allowCoreCopy: false,
        reviewRequired: false,
        summary: 'MIT fixture.',
      },
      audit: {
        lastEventId: 'fixture',
        trailFilePath: null,
        lastAction: 'import',
        lastRecordedAt: '2026-05-10T16:00:00.000Z',
      },
    },
  }, null, 2), 'utf8');
}

function writeLocalSkill(rootDir, name) {
  const skillDir = path.join(rootDir, 'skill-library', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    'description: local skill should stay outside universal bridge.',
    '---',
    '',
    `# ${name}`,
    '',
    'local only.',
  ].join('\n'), 'utf8');
}

function runRegistryRule(input) {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    'scripts/zavorth-universal-skill-bridge-registry.ts',
    ...input.args,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      observed: `exit ${result.status ?? 'unknown'}`,
      target: input.target,
      details: compact(result.stderr, result.stdout),
    };
  }

  try {
    const snapshot = JSON.parse(result.stdout);
    const pass = input.expect(snapshot);
    return {
      id: input.id,
      label: input.label,
      status: pass ? 'passed' : 'failed',
      observed: `visible=${snapshot.summary?.visible}, imported=${snapshot.summary?.imported}, invocation=${snapshot.invocation?.status || 'none'}`,
      target: input.target,
      details: [
        `selected=${snapshot.selected?.skillName || 'none'}`,
        `actions=${snapshot.summary?.actions}`,
        `blocked=${snapshot.summary?.blocked}`,
        `approvalRequired=${snapshot.summary?.approvalRequired}`,
      ],
    };
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      observed: 'invalid JSON',
      target: input.target,
      details: [error instanceof Error ? error.message : String(error), ...compact(result.stderr, result.stdout)],
    };
  }
}

function read(relativePath) {
  const target = path.join(root, relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
}

function compact(...values) {
  return values
    .flatMap((value) => String(value || '').split(/\r...\n/g))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
