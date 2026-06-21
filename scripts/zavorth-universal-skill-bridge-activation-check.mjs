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
  runHelpFixture(),
  runDryRunFixture(),
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
  console.log('[zavorth-universal-skill-bridge-activation] checking Credential vault');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-universal-skill-bridge-activation] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
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
    'src/contracts/ZavorthUniversalSkillBridgeActivationContract.ts',
    'src/services/UniversalSkillBridgeActivationService.ts',
    'scripts/zavorth-universal-skill-bridge-activation.ts',
    'scripts/zavorth-universal-skill-bridge-activation-check.mjs',
    'tests/services/UniversalSkillBridgeActivationService.test.ts',
    'src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack.ts',
    'src/telegram/controllers/TelegramSkillCatalogController.ts',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'universal-skill-bridge-activation-files',
    label: 'Credential vault files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'activation contract, service, CLI, channel command wiring and tests are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthUniversalSkillBridgeActivationContract.ts', [
      'ZAVORTH_UNIVERSAL_SKILL_BRIDGE_ACTIVATION_CONTRACT_VERSION',
      'activationUsesRegistryAndBridgeOnly',
      'Runtime gateway - Trust-Governed Skill Expansion at Scale',
    ]],
    ['src/services/UniversalSkillBridgeActivationService.ts', [
      'executeCommand',
      'activationDoesNotExecuteUpstreamCode',
      '/skills run <skill>',
      'dry-run by default',
    ]],
    ['src/domain/surface/presentation/shared-surface/SharedSurfaceEcosystemCommandPack.ts', [
      'skillBridgeActivationService',
      'handleSkillBridgeActivation',
      "lower.startsWith('run ')",
    ]],
    ['src/telegram/controllers/TelegramSkillCatalogController.ts', [
      'skillBridgeActivationService',
      'telegram-skill-bridge-activation',
    ]],
    ['package.json', [
      'zavorth:universal-skill-bridge-activation',
      'zavorth:universal-skill-bridge-activation:check',
      'qa:zavorth-universal-skill-bridge-activation',
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
    id: 'universal-skill-bridge-activation-markers',
    label: 'Credential vault markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'activation is wired into shared commands, Telegram and CLI checks',
    details: missing,
  };
}

function runHelpFixture() {
  const result = runActivationRule({
    id: 'universal-skill-bridge-activation-help',
    label: 'Activation help is available',
    target: '/skills bridge explains daily commands without requiring a selected skill',
    args: ['--args', 'bridge', '--json'],
    expect: (snapshot) => snapshot.status === 'ready'
      && snapshot.action === 'inspect'
      && snapshot.report.includes('/skills run <skill>')
      && snapshot.policy.activationUsesRegistryAndBridgeOnly === true,
  });
  return result;
}

function runDryRunFixture() {
  const fixture = createFixture();
  try {
    return runActivationRule({
      id: 'universal-skill-bridge-activation-dry-run',
      label: 'Activation prepares dry-run through bridge',
      target: '/skills run <skill> returns a dry-run envelope and same-channel next actions',
      args: ['--project-root', fixture.root, '--args', 'run research-pack', '--channel', 'telegram', '--json'],
      expect: (snapshot) => snapshot.status === 'dry-run'
        && snapshot.registry?.invocation?.status === 'dry-run'
        && snapshot.registry?.invocation?.promptEnvelope?.text.includes('<untrusted_skill_content')
        && snapshot.surfaceActions.some((action) => action.command === '/skills live research-pack --approval-id <approval-id>'),
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runLiveApprovalFixture() {
  const fixture = createFixture();
  try {
    return runActivationRule({
      id: 'universal-skill-bridge-activation-live-approval',
      label: 'Activation preserves live approval gate',
      target: '/skills live <skill> without approval does not prepare an envelope',
      args: ['--project-root', fixture.root, '--args', 'live research-pack', '--channel', 'discord', '--json'],
      expect: (snapshot) => snapshot.status === 'approval-required'
        && snapshot.registry?.invocation?.status === 'approval-required'
        && snapshot.registry?.invocation?.summary?.executionPerformed === false,
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runActivationRule(input) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      'scripts/zavorth-universal-skill-bridge-activation.ts',
      ...input.args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    },
  );
  const details = [];
  if (result.stderr.trim()) {
    details.push(result.stderr.trim());
  }
  if (result.status !== 0) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      observed: `exit ${result.status}`,
      target: input.target,
      details: [...details, result.stdout.trim()].filter(Boolean),
    };
  }
  try {
    const snapshot = JSON.parse(result.stdout);
    const passed = input.expect(snapshot);
    return {
      id: input.id,
      label: input.label,
      status: passed ? 'passed' : 'failed',
      observed: passed ? 'expected activation snapshot' : 'unexpected activation snapshot',
      target: input.target,
      details: passed ? [] : [JSON.stringify(snapshot, null, 2)],
    };
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      observed: 'invalid json',
      target: input.target,
      details: [...details, error instanceof Error ? error.message : String(error), result.stdout.trim()].filter(Boolean),
    };
  }
}

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-usba-'));
  fs.mkdirSync(path.join(rootDir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'config', 'skill-sources.json'), JSON.stringify({
    version: 1,
    updatedAt: '2026-05-10T17:00:00.000Z',
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
        notes: ['Fixture source for governed bridge activation checks.'],
      },
    ],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'config', 'skill-allowlist.json'), JSON.stringify({
    version: 1,
    updatedAt: '2026-05-10T17:00:00.000Z',
    defaultPolicy: 'deny',
    allowedSourceIds: ['workspace-library', 'workspace-imported-library'],
    rules: [
      {
        sourceId: 'workspace-library',
        mode: 'all',
        skillNames: [],
        reason: 'Fixture local skills are visible so activation can keep them outside bridge execution.',
      },
      {
        sourceId: 'workspace-imported-library',
        mode: 'all',
        skillNames: [],
        reason: 'Fixture imported skills are discovery-visible while live usage remains owner-approval gated by the bridge.',
      },
    ],
  }, null, 2), 'utf8');
  fs.mkdirSync(path.join(rootDir, 'skill-library', 'imported', 'research-pack', 'references'), { recursive: true });
  const skillDir = path.join(rootDir, 'skill-library', 'imported', 'research-pack');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    'name: research-pack',
    'description: Research local documents and produce evidence notes.',
    '---',
    '',
    '# research-pack',
    '',
    'Read local notes and produce evidence.',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skillDir, 'references', 'notes.md'), '# Notes\n', 'utf8');
  fs.writeFileSync(path.join(skillDir, 'ORIGIN.json'), JSON.stringify({
    version: 1,
    importedAt: '2026-05-10T16:00:00.000Z',
    importMode: 'manual',
    skillName: 'research-pack',
    source: {
      id: 'universal-source:research-pack',
      label: 'Universal fixture',
      kind: 'repository',
      trust: 'review',
      registrySource: 'zavorth:universal-skill-intake',
      upstream: path.join(rootDir, 'source'),
      license: 'MIT',
      ownership: 'universal-intake',
    },
    originalSkillPath: 'research-pack/SKILL.md',
    originalRelativePath: 'research-pack',
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
  return { root: rootDir };
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}
