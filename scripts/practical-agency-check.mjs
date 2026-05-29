#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

const rules = [
  filesExist('practical-agency-files', [
    'src/contracts/PracticalAgencyContract.ts',
    'src/services/ConversationalAgencyPresenter.ts',
    'src/services/FabricToolIntentService.ts',
    'src/services/ZavorthCapabilityBuilderService.ts',
    'src/services/CapabilityLabService.ts',
    'src/services/OperationalPreferenceLearner.ts',
    'src/services/SkillMiningService.ts',
    'src/services/ZavorthSecurityRedTeamService.ts',
    'src/services/ZavorthPolicyCompilerService.ts',
    'src/services/ProjectConstitutionLoader.ts',
    'src/services/ZavorthPracticalAgencyService.ts',
    'scripts/practical-agency-gate.ts',
    'tests/services/ZavorthPracticalAgencyService.test.ts',
    'docs/README.md',
  ]),
  containsAll('conversational-agency-presenter', ['src/services/ConversationalAgencyPresenter.ts'], [
    'detailsHiddenByDefault: true',
    'zavorthControlDetailsAvailable: true',
    'previa de alteracao',
    'preciso da sua confirmacao',
    'modo inteligente em observacao',
  ]),
  containsAll('fabric-tool-intent-service', ['src/services/FabricToolIntentService.ts'], [
    'safeToolIntents',
    'draftToolIntents',
    'gatedToolIntents',
    'blockedToolIntents',
    'liveActionApplied: false',
  ]),
  containsAll('capability-builder-lab', [
    'src/services/ZavorthCapabilityBuilderService.ts',
    'src/services/CapabilityLabService.ts',
  ], [
    'status: \'draft_ready\'',
    'defaultEnabled: false',
    'liveAllowed: false',
    'filesWritten: false',
    'activationAllowed: false',
    'Risk 3+ activation requires owner approval.',
  ]),
  containsAll('learning-skill-mining-red-team-policy-constitution', [
    'src/services/OperationalPreferenceLearner.ts',
    'src/services/SkillMiningService.ts',
    'src/services/ZavorthSecurityRedTeamService.ts',
    'src/services/ZavorthPolicyCompilerService.ts',
    'src/services/ProjectConstitutionLoader.ts',
  ], [
    'rawSecretsSerialized: false',
    'activatesAutomatically: false',
    'blocksUnsafeImpact: true',
    'hardBlocksPreserved: true',
    'policyBypassAllowed: false',
    '[redacted-secret]',
  ]),
  containsAll('practical-agency-facade', ['src/services/ZavorthPracticalAgencyService.ts'], [
    'PRACTICAL_AGENCY_CONTRACT_VERSION',
    'ConversationalAgencyPresenter',
    'FabricToolIntentService',
    'ZavorthCapabilityBuilderService',
    'CapabilityLabService',
    'OperationalPreferenceLearner',
    'SkillMiningService',
    'ZavorthSecurityRedTeamService',
    'ZavorthPolicyCompilerService',
    'ProjectConstitutionLoader',
  ]),
  containsAll('practical-agency-secret-hygiene-tests', [
    'scripts/practical-agency-gate.ts',
    'tests/services/ZavorthPracticalAgencyService.test.ts',
  ], [
    'secret-hygiene-redacts-derived-text',
    'sk-policy-secret-value',
    'sk-constitution-secret-value',
    'sk-title-secret-value',
    'ghp_secretValueShouldDisappear',
  ]),
  containsAll('fabric-uses-conversational-presenter', ['src/services/ZavorthIntelligenceFabricService.ts'], [
    'ConversationalAgencyPresenter',
    'this.presenter.present',
  ]),
];

const gate = spawnSync(process.execPath, [tsxCli, 'scripts/practical-agency-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
});
rules.push({
  id: 'practical-agency-dynamic-gate',
  status: gate.status === 0 ? 'passed' : 'failed',
  observed: gate.status === 0 ? 'dynamic gate passed' : `dynamic gate failed (${gate.status})`,
  details: gate.status === 0 ? [] : [
    gate.error ? String(gate.error.message || gate.error) : '',
    gate.stdout,
    gate.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
});

const failed = rules.filter((rule) => rule.status === 'failed');
const output = {
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
  console.log(JSON.stringify(output, null, 2));
} else {
  console.log('[practical-agency] checking release gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[practical-agency] ${marker} ${rule.id}: ${rule.observed || ''}`);
    for (const detail of rule.details || []) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function filesExist(id, files) {
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${files.length - missing.length}/${files.length} files present`,
    details: missing,
  };
}

function containsAll(id, files, needles) {
  const haystack = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const missing = needles.filter((needle) => !haystack.includes(needle));
  return {
    id,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `missing ${missing.length} marker(s)` : 'all markers present',
    details: missing,
  };
}
