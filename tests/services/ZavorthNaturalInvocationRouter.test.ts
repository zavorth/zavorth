import type { SkillMetadata } from '../../src/skills/SkillLoader.js';
import { ZavorthNaturalInvocationRouter } from '../../src/services/ZavorthNaturalInvocationRouter.js';

describe('ZavorthNaturalInvocationRouter Phase 5/7', () => {
  it('routes natural subagent requests and exposes all shared channel commands', async () => {
    const router = new ZavorthNaturalInvocationRouter({
      now: () => new Date('2026-05-10T14:10:00.000Z'),
    });

    const plan = await router.plan({
      text: 'mande um agente pesquisar e outro revisar localmente',
      autoExecute: true,
      mockLiveSubagents: true,
      skillCatalog: [],
    });

    expect(plan.primaryAction).toBe('spawn_team');
    expect(plan.subagentAutoInvocation?.selectedBy).toBe('explicit-user-request');
    expect(plan.execution.subagentRuntime?.status).toBe('completed');
    expect(plan.execution.subagentRuntime?.summary.liveRuns).toBe(1);
    expect(plan.surfaceCommands.map((command) => command.command)).toEqual(expect.arrayContaining([
      '/agents',
      '/agents spawn <task>',
      '/skills absorb <path>',
      '/invoke <request>',
    ]));
    expect(plan.surfaceCommands.every((command) => command.channels.includes('telegram') && command.channels.includes('imessage'))).toBe(true);
  });

  it('selects a high-confidence governed skill without requiring internal command names', async () => {
    const router = new ZavorthNaturalInvocationRouter({
      now: () => new Date('2026-05-10T14:10:00.000Z'),
    });

    const plan = await router.plan({
      text: 'use a melhor skill para revisar seguranca',
      skillCatalog: [skill()],
    });

    expect(plan.status).toBe('ready');
    expect(plan.primaryAction).toBe('use_skill');
    expect(plan.selectedSkillName).toBe('security-review');
    expect(plan.safety.importedSkillsAreInstructionsOnly).toBe(true);
  });

  it('promotes complex read-only requests to mock-live subagents during auto execution', async () => {
    const router = new ZavorthNaturalInvocationRouter({
      now: () => new Date('2026-05-10T14:10:00.000Z'),
    });

    const plan = await router.plan({
      text: 'faca uma auditoria profunda em todo o Zavorth, procure falhas, compare riscos e valide os achados',
      autoExecute: true,
      mockLiveSubagents: true,
      skillCatalog: [],
    });

    expect(plan.primaryAction).toBe('spawn_team');
    expect(plan.execution.subagentRuntime?.status).toBe('completed');
    expect(plan.execution.subagentRuntime?.runs.at(-1)?.executionMode).toBe('mock-live');
    expect(plan.execution.subagentRuntime?.autoInvocationTelemetry.latest?.selectedBy).toBe('implicit-complexity');
  });
});

function skill(): SkillMetadata {
  return {
    name: 'security-review',
    description: 'Skill para revisar seguranca e auditoria local.',
    dirPath: 'skill-library/imported/security-review',
    skillFilePath: 'skill-library/imported/security-review/SKILL.md',
    supportFilePaths: [],
    supportFiles: [],
    sourceId: 'workspace-imported-library',
    sourceLabel: 'Workspace imported skill library',
    sourceTrust: 'review',
    license: 'MIT',
    bundleTags: ['security', 'seguranca', 'review'],
    provenance: {
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Workspace imported skill library',
      sourceKind: 'workspace',
      sourceTrust: 'review',
      registrySource: 'test',
      ownership: 'test',
      license: 'MIT',
      importMode: 'manual',
      imported: true,
      importedAt: null,
      originDocumentPath: null,
      attributionFilePath: null,
      upstreamSourceId: null,
      upstreamSourceLabel: null,
      upstreamSourceKind: null,
      upstreamSourceTrust: null,
      upstreamRegistrySource: null,
      upstreamRepository: null,
      upstreamLicense: null,
      upstreamSkillPath: null,
      upstreamRelativePath: null,
    },
  };
}
