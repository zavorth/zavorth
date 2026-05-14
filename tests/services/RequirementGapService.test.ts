import type { EngineeringContextSnapshot, EngineeringIntent } from '../../src/contracts/EngineeringCoreContract.js';
import { RequirementGapService } from '../../src/services/RequirementGapService.js';

describe('RequirementGapService', () => {
  const baseContext: EngineeringContextSnapshot = {
    workspace: '/tmp/demo',
    workspaceName: 'demo',
    packageJsonExists: true,
    packageManager: 'npm',
    scripts: { build: 'npm run build' },
    lockfiles: ['package-lock.json'],
    tsconfigExists: true,
    detectedStacks: ['node'],
    frameworks: ['express'],
    languages: ['typescript'],
    importantPaths: ['/tmp/demo/src'],
    shallowTree: ['src', 'src/index.ts'],
    instructionFile: null,
    instructionSummary: '',
    instructionNotes: [],
    workspaceCommands: [],
    workspaceHooks: [],
    autorepairSummary: null,
  };

  const mutatingIntent: EngineeringIntent = {
    kind: 'create_project',
    objective: 'crie um servidor Express',
    mutating: true,
    requiresSession: true,
    preferredProfile: 'trusted',
    workspaceHint: null,
    suggestedCommands: ['npm init -y'],
  };

  it('requires docker for mutating guarded runs', () => {
    const service = new RequirementGapService({
      sandboxExecutionService: {
        isDockerAvailable: () => false,
        getDockerImageForLanguage: () => 'node:22-bullseye',
      } as any,
    });

    const gaps = service.detectForIntent({
      intent: mutatingIntent,
      context: baseContext,
    });

    expect(gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'missing_docker',
        blocking: true,
      }),
    ]));
  });

  it('detects missing dependencies from stderr', () => {
    const service = new RequirementGapService({
      sandboxExecutionService: {
        isDockerAvailable: () => true,
        getDockerImageForLanguage: () => 'node:22-bullseye',
      } as any,
    });

    const gaps = service.detectForIntent({
      intent: mutatingIntent,
      context: baseContext,
      stderr: "Error: Cannot find module 'express'",
    });

    expect(gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'missing_dependency',
        operatorAction: 'approve_install',
      }),
    ]));
  });

  it('does not require docker for supervised browser control intents', () => {
    const service = new RequirementGapService({
      sandboxExecutionService: {
        isDockerAvailable: () => false,
        getDockerImageForLanguage: () => 'node:22-bullseye',
      } as any,
    });

    const gaps = service.detectForIntent({
      intent: {
        kind: 'system_overlord_operation',
        objective: 'abra o navegador em https://example.com',
        mutating: true,
        requiresSession: false,
        preferredProfile: 'dangerous',
        preferredCapability: 'browser.control',
        preferredAutonomyLevel: 5,
        workspaceHint: null,
        suggestedCommands: ['{"action":"navigate","url":"https://example.com"}'],
      },
      context: baseContext,
    });

    expect(gaps.find((gap) => gap.kind === 'missing_docker')).toBeUndefined();
  });
});
