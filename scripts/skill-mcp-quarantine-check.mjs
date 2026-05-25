#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'skill-mcp-quarantine-files',
    label: 'Skill MCP Quarantine files exist',
    target: 'Runtime, CLI, Dashboard, tests and docs are present',
    files: [
      'src/runtime/agent/SkillMcpQuarantineService.ts',
      'src/cli/ZavorthCliSkillMcpQuarantineRenderer.ts',
      'tests/runtime/agent/SkillMcpQuarantineService.test.ts',
      'tests/runtime/agent/AgentRunServiceSkillMcpQuarantine.test.ts',
      'tests/cli/ZavorthCliSkillMcpQuarantine.test.ts',
      'tests/ai-gateway/dashboard/DashboardSkillMcpQuarantine.test.ts',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'skill-mcp-quarantine-contract',
    label: 'Skill/MCP Quarantine contract explains trust',
    target: 'Quarantine snapshot includes trust state, origin, risk and promotion actions',
    files: ['src/runtime/agent/SkillMcpQuarantineService.ts'],
    needles: [
      'SKILL_MCP_QUARANTINE_CONTRACT_VERSION',
      '2026-05-03.skill-mcp-quarantine',
      'externalImportsNeverTrustedAutomatically',
      'naturalLanguageDoesNotBypassQuarantine',
      'promotionsRequireExplicitOperatorAction',
      'quarantinedToolsHidden',
      'promoteCommand',
      'keepQuarantinedCommand',
    ],
  }),
  ruleContainsAcross({
    id: 'agent-run-uses-skill-mcp-quarantine',
    label: 'Agent run attaches Skill/MCP Quarantine',
    target: 'AgentRunService writes run.metadata.skillMcpQuarantine from importedCapabilityTrust',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/index.ts',
      'tests/runtime/agent/AgentRunServiceSkillMcpQuarantine.test.ts',
    ],
    needles: [
      'SkillMcpQuarantineService',
      'skillMcpQuarantine',
      'applySkillMcpQuarantine',
      'SKILL_MCP_QUARANTINE_CONTRACT_VERSION',
    ],
  }),
  ruleContainsAcross({
    id: 'cli-exposes-skill-mcp-quarantine',
    label: 'CLI exposes Skill/MCP Quarantine',
    target: 'zavorth quarantine renders origin/risk/trust in text or JSON',
    files: [
      'src/cli/ZavorthCliRegistryOps.ts',
      'src/cli/ZavorthCliSkillMcpQuarantineRenderer.ts',
      'tests/cli/ZavorthCliSkillMcpQuarantine.test.ts',
    ],
    needles: [
      'quarantine',
      'Skill/MCP Quarantine - Skill MCP Quarantine',
      'resolveSkillMcpQuarantineCliText',
      'formatSkillMcpQuarantineSnapshot',
      'zavorth quarantine promote',
    ],
  }),
  ruleContainsAcross({
    id: 'dashboard-projects-skill-mcp-quarantine',
    label: 'Dashboard projects Skill/MCP Quarantine',
    target: '/dashboard reads skillMcpQuarantine from run metadata and renders quarantine in skills sector',
    files: [
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/dashboardDashboardContracts.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/dashboardRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.ts',
      'src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardControlShell.tsx',
      'tests/ai-gateway/dashboard/DashboardSkillMcpQuarantine.test.ts',
    ],
    needles: [
      'DashboardSkillMcpQuarantineSnapshot',
      'skillMcpQuarantine',
      'buildSkillMcpQuarantine',
      'mapSkillMcpQuarantine',
      'Policy de quarentena',
      'em quarentena',
    ],
  }),
  ruleContainsAll({
    id: 'package-exposes-skill-mcp-quarantine-gate',
    label: 'package exposes Skill MCP Quarantine gate',
    target: 'local QA can run skill-mcp-quarantine:check and qa:skill-mcp-quarantine',
    files: ['package.json'],
    needles: [
      'skill-mcp-quarantine:check',
      'qa:skill-mcp-quarantine',
      'scripts/skill-mcp-quarantine-check.mjs',
    ],
  }),
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
  console.log('[skill-mcp-quarantine] checking Skill MCP Quarantine');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[skill-mcp-quarantine] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
