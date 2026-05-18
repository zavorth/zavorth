#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  runInternalSkillFixture(),
  runCreateSkillFallbackFixture(),
  runExternalPreferenceFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-capability-mesh] checking capability arbitration');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-capability-mesh] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthCapabilityMeshContract.ts',
    'src/services/ZavorthCapabilityMeshService.ts',
    'scripts/zavorth-capability-mesh.ts',
    'scripts/zavorth-capability-mesh-check.mjs',
    'tests/services/ZavorthCapabilityMeshService.test.ts',
    'docs/39-capability-mesh.md',
    'package.json',
    'src/zavorth-cli.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'files-exist',
    label: 'Capability Mesh files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package script are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthCapabilityMeshContract.ts', [
      'zavorth-capability-mesh/1',
      'internal-skill',
      'external-agent',
      'create-zavorth-skill',
      'adapt-external-capability',
      'noExternalAgentInvokedDuringArbitration: true',
    ]],
    ['src/services/ZavorthCapabilityMeshService.ts', [
      'SkillCatalogService',
      'ZavorthExternalAgentGatewayService',
      'checkedInternalSkillsFirst: true',
      'noSkillInstalledDuringArbitration: true',
      'delegate-external-agent',
      'create-skill-draft',
    ]],
    ['scripts/zavorth-capability-mesh.ts', [
      'ZavorthCapabilityMeshService',
      '--prefer-external',
      '--no-skill-creation',
    ]],
    ['package.json', [
      'zavorth:capability-mesh',
      'zavorth:capability-mesh:check',
    ]],
    ['src/zavorth-cli.ts', [
      'runCapabilityMesh',
      'capability-mesh',
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
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'markers',
    label: 'Capability Mesh safety markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'mesh arbitrates without invoking external agents or installing skills',
    details: missing,
  };
}

function runInternalSkillFixture() {
  const result = runCli(['--json', '--request', 'faça uma revisão de segurança deste código']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'capability-mesh'
    && snapshot?.orchestration?.checkedInternalSkillsFirst === true
    && snapshot?.safety?.noProcessStarted === true
    && Array.isArray(snapshot?.candidates)
    && snapshot.candidates.some((candidate) => candidate.kind === 'internal-skill' || candidate.kind === 'create-zavorth-skill');
  return {
    id: 'internal-skill-fixture',
    label: 'Mesh ranks internal skills or create-skill fallback',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, candidates=${snapshot.candidates.length}` : `exit ${result.status}`,
    target: 'request produces governed candidates without execution',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runCreateSkillFallbackFixture() {
  const result = runCli(['--json', '--request', 'crie uma skill nova para normalizar um formato academico estranho']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.candidates?.some((candidate) => candidate.kind === 'create-zavorth-skill' && candidate.requiresApproval === true)
    && snapshot?.orchestration?.noSkillInstalledDuringArbitration === true;
  return {
    id: 'create-skill-fallback',
    label: 'Mesh proposes skill draft when capability is missing',
    status: ok ? 'passed' : 'failed',
    observed: ok ? snapshot.selected.decision : `exit ${result.status}`,
    target: 'missing capability becomes draft proposal, not silent install',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runExternalPreferenceFixture() {
  const registryFile = path.join(root, 'tmp', 'capability-mesh-external-registry.json');
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  fs.writeFileSync(registryFile, JSON.stringify({
    contractVersion: 'zavorth-external-agent-gateway/1',
    updatedAt: new Date().toISOString(),
    profiles: [{
      id: 'rust-reviewer',
      label: 'Rust specialist reviewer',
      adapter: 'cli',
      status: 'enabled',
      root: root,
      command: 'rust-agent',
      args: [],
      endpoint: null,
      acp: { serverId: null, transport: null },
      promptMode: 'stdin',
      allowedCapabilities: ['rust', 'review', 'security'],
      liveExecutionEnabled: true,
      allowRemoteNetwork: false,
      isolation: {
        kind: 'docker',
        required: true,
        strongBoundary: true,
        image: 'rust-agent:latest',
        distro: null,
        workspaceMount: root,
        workingDirectory: '/workspace',
        network: 'disabled',
        readOnlyRoot: true,
        notes: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provenance: { source: 'manual', onboardingCandidateId: null },
      safety: {
        requiresApprovalPerInvocation: true,
        noDefaultRuntimeBinding: true,
        secretsPassedThroughEnv: false,
        toolExposureByDefault: false,
        strongIsolationAvailable: true,
        localCliIsNotOsSandbox: false,
      },
    }],
  }, null, 2));
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-capability-mesh.ts',
    '--json',
    '--request',
    'use o melhor agente externo para revisar Rust com segurança',
    '--prefer-external',
  ], {
    cwd: root,
    env: { ...process.env, ZAVORTH_EXTERNAL_AGENT_GATEWAY_REGISTRY: registryFile },
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.candidates?.some((candidate) => candidate.kind === 'external-agent' && candidate.metadata.externalProfileId === 'rust-reviewer')
    && snapshot?.safety?.perRunApprovalStillRequired === true
    && !String(snapshot?.selected?.nextCommand || '').includes('--approve-external-execution')
    && snapshot?.orchestration?.noExternalAgentInvokedDuringArbitration === true;
  return {
    id: 'external-preference-fixture',
    label: 'Mesh can prefer connected external agents',
    status: ok ? 'passed' : 'failed',
    observed: ok ? snapshot.selected.decision : `exit ${result.status}`,
    target: 'connected external agent can win arbitration but remains approval-gated',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runCli(args) {
  return spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-capability-mesh.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
