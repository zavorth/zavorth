import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_RUNTIME_ID,
  createZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import {
  FirstRunWorkspaceBootstrapProfileService,
} from '../../../src/services/FirstRunWorkspaceBootstrapProfileService.js';
import {
  WorkspaceIdentityContextAssembler,
} from '../../../src/runtime/agent/context/WorkspaceIdentityContextAssembler.js';

const DOC_283 = 'docs/283-zavorth-canonical-first-run-workspace-bootstrap-wizard.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RELEASE_PACKS_INDEX = 'src/runtime/external-agents/index.release-packs.ts';

const legacyLower = 'bas' + 'ilisk';
const legacyTitle = 'Bas' + 'ilisk';
const legacyUpper = 'BAS' + 'ILISK';
const legacyIdentityPattern = new RegExp(`${legacyTitle}|${legacyLower}|${legacyUpper}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-first-run-'));
}

function cleanup(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

describe('Zavorth canonical first-run workspace bootstrap wizard pack', () => {
  const pack = createZavorthCanonicalFirstRunWorkspaceBootstrapWizardPackFixture();

  it('exports the pack 283 boundary and final state', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);
    const releasePacksIndex = read(RELEASE_PACKS_INDEX);

    expect(boundary).toContain('ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack/v1');
    expect(index).toContain("from './index.release-packs.js'");
    expect(releasePacksIndex).toContain("from './ZavorthCanonicalFirstRunWorkspaceBootstrapWizardPack.js'");
    expect(pack.normalization.packId).toBe('283');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_CANONICAL_FIRST_RUN_WORKSPACE_BOOTSTRAP_WIZARD_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-first-run-workspace-bootstrap-ready');
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      firstRunWizardImplemented: true,
      profilePersistenceImplemented: true,
      workspaceIdentityReadable: true,
      dryRunSupported: true,
      nonInteractiveSafe: true,
      rawSecretSerialized: false,
      runtimePersistentStartPerformed: false,
    }));
    expect(pack.blockedActionPerformed()).toBe(false);
  });

  it('records every mandatory wizard question and safe CLI mode', () => {
    expect(pack.questionIds()).toEqual([
      'user-display-name',
      'agent-display-name',
      'tone-preference',
      'workspace-root',
      'provider-model',
      'memory-mode',
      'safety-posture',
      'summary-confirmation',
    ]);
    expect(pack.normalization.cli).toEqual(expect.objectContaining({
      entryCommand: 'zavorth setup',
      dryRunCommand: 'zavorth setup --dry-run',
      jsonDryRunCommand: 'zavorth setup --json --dry-run',
      nonInteractiveBehavior: 'safe-hint-no-hang',
    }));
  });

  it('uses Zavorth-owned profile paths and does not serialize secrets', () => {
    expect(pack.profilePaths()).toEqual([
      'data/runtime/first-run/profile.json',
      'data/runtime/first-run/workspace.json',
      'data/runtime/first-run/identity.json',
      'data/runtime/first-run/policy.json',
    ]);
    expect(pack.normalization.persistence).toEqual(expect.objectContaining({
      writesSecrets: false,
      writesTokens: false,
      idempotent: true,
    }));
    assertNoRawSecret(JSON.stringify(pack.normalization));
  });

  it('supports dry-run, confirmation, cancellation and existing profile detection', () => {
    const root = makeTempRoot();
    try {
      const service = new FirstRunWorkspaceBootstrapProfileService({
        storageRoot: root,
        defaultWorkspaceRoot: root,
        now: () => new Date('2026-05-02T06:00:00.000Z'),
      });
      const answers = {
        userDisplayName: 'Ermys',
        preferredAddress: 'Ermys',
        agentDisplayName: 'Zavorth',
        tonePreference: 'equilibrado',
        workspaceRoot: root,
        providerId: 'deferred',
        memoryMode: 'local-metadata',
        safetyPosture: 'preview-first',
      };
      const dryRun = service.applyProfile(answers, { dryRun: true });
      expect(dryRun.status).toBe('dry-run');
      expect(fs.existsSync(service.resolvePaths().profilePath)).toBe(false);

      const cancelled = service.applyProfile(answers, { confirmed: false });
      expect(cancelled.status).toBe('cancelled');
      expect(fs.existsSync(service.resolvePaths().profilePath)).toBe(false);

      const applied = service.applyProfile(answers, { confirmed: true });
      expect(applied.status).toBe('applied');
      expect(applied.writtenFiles).toEqual(expect.arrayContaining([
        service.resolvePaths().profilePath,
        service.resolvePaths().workspacePath,
        service.resolvePaths().identityPath,
        service.resolvePaths().policyPath,
      ]));

      const profileExists = service.applyProfile(answers, { confirmed: true });
      expect(profileExists.status).toBe('profile-exists');
      assertNoRawSecret(JSON.stringify(applied));
    } finally {
      cleanup(root);
    }
  });

  it('uses the shared Model Picker selection as the safe provider placeholder by default', () => {
    const root = makeTempRoot();
    try {
      const service = new FirstRunWorkspaceBootstrapProfileService({
        storageRoot: root,
        defaultWorkspaceRoot: root,
        now: () => new Date('2026-05-02T06:00:00.000Z'),
        modelPickerContractService: {
          buildContract: () => ({
            schemaVersion: 1,
            generatedAt: '2026-05-02T06:00:00.000Z',
            families: { schemaVersion: 1, generatedAt: '2026-05-02T06:00:00.000Z', families: [] },
            routes: {
              schemaVersion: 1,
              generatedAt: '2026-05-02T06:00:00.000Z',
              routes: [{ id: 'openai' }, { id: 'gemini' }],
            },
            profiles: [],
            selected: {
              schemaVersion: 1,
              source: 'current-config',
              providerName: 'openai',
              providerLabel: 'OpenAI',
              modelName: 'gpt-5.2',
              modelLabel: 'gpt-5.2',
              routeId: 'openai',
              familyId: 'openai',
              readiness: 'ready',
              ready: true,
              fallbackOrder: ['openai', 'gemini'],
              explanation: ['Configuracao atual seleciona openai/gpt-5.2.'],
            },
          } as any),
        },
      });

      const plan = service.buildPlan({ workspaceRoot: root }, { dryRun: true });

      expect(plan.profile.provider).toEqual({
        providerId: 'openai',
        modelId: 'gpt-5.2',
        providerStatus: 'configured-placeholder',
        rawSecretStored: false,
      });
      expect(plan.summary).toContain('Provider/modelo: openai/gpt-5.2 (configured-placeholder)');
      expect(plan.questions.find((entry) => entry.id === 'provider-model')?.defaultValue).toBe('openai');
    } finally {
      cleanup(root);
    }
  });

  it('keeps non-interactive JSON redacted and blocks secret-shaped input', () => {
    const root = makeTempRoot();
    try {
      const service = new FirstRunWorkspaceBootstrapProfileService({
        storageRoot: root,
        defaultWorkspaceRoot: root,
      });
      const fakeSecret = ['sk', 'proj', 'super', 'secret', 'token', '1234567890'].join('-');
      const plan = service.buildPlan({
        userDisplayName: fakeSecret,
        workspaceRoot: root,
      }, {
        dryRun: true,
        nonInteractive: true,
      });

      expect(plan.nonInteractiveSafe).toBe(true);
      expect(plan.dryRun).toBe(true);
      expect(plan.status).toBe('blocked');
      expect(plan.redactedJson).toContain('[redacted]');
      assertNoRawSecret(plan.redactedJson);
    } finally {
      cleanup(root);
    }
  });

  it('exposes the first-run profile through workspace identity context without starting runtime', async () => {
    const root = makeTempRoot();
    try {
      const service = new FirstRunWorkspaceBootstrapProfileService({
        storageRoot: root,
        defaultWorkspaceRoot: root,
        now: () => new Date('2026-05-02T06:00:00.000Z'),
      });
      service.applyProfile({
        userDisplayName: 'Ermys',
        preferredAddress: 'Ermys',
        agentDisplayName: 'Zavorth',
        tonePreference: 'conciso',
        workspaceRoot: root,
        providerId: 'deferred',
        memoryMode: 'local-summary',
        safetyPosture: 'local-only',
      }, { confirmed: true });

      const assembler = new WorkspaceIdentityContextAssembler({
        firstRunProfileReader: service,
        contextResolver: {
          resolve: jest.fn(async () => ({
            workspace: root,
            workspaceName: 'temp-workspace',
            instructionFile: null,
            instructionSources: [],
            instructionSummary: '',
            instructionNotes: [],
            skillDirectories: [],
            workspaceCommands: [],
            workspaceHooks: [],
            layers: [],
          })),
        },
      });

      const snapshot = await assembler.assemble({ workspace: root });
      expect(snapshot.warm.workspaceProfile).toEqual(expect.objectContaining({
        userDisplayName: 'Ermys',
        agentDisplayName: 'Zavorth',
        tonePreference: 'conciso',
        memoryMode: 'local-summary',
        safetyPosture: 'local-only',
        providerStatus: 'deferred',
        firstRunProfileConfigured: true,
      }));
      expect(snapshot.metadata.firstRunProfileConfigured).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it('documents the pack without old product identity or secret leakage', () => {
    const doc = read(DOC_283);

    expect(doc).toContain('Zavorth Canonical First-Run Workspace Bootstrap Wizard');
    expect(doc).toContain('decision=zavorth-first-run-workspace-bootstrap-ready');
    expect(doc).toContain('data/runtime/first-run/profile.json');
    expect(doc).toContain('zavorth setup --dry-run');
    expect(doc).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(doc);
  });
});
