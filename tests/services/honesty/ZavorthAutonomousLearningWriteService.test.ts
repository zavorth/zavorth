import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthAutonomousLearningWriteService } from '../../../src/services/ZavorthAutonomousLearningWriteService.js';
import type {
  ZavorthExperienceLearningDaemonSnapshot,
  ZavorthSkillForgeRuntimeSnapshot,
} from '../../../src/contracts/native/ZavorthNativeAutonomySpineContract.js';

function learningSnapshot(overrides: Partial<ZavorthExperienceLearningDaemonSnapshot> = {}): ZavorthExperienceLearningDaemonSnapshot {
  return {
    version: 'experience-learning-daemon/v1',
    generatedAt: new Date().toISOString(),
    status: 'ready',
    preTurnRecall: { ranBeforeTurn: false, query: null, results: [] },
    postTurnReview: {
      ranAfterSuccessfulTurn: true,
      turnId: 'turn-1',
      sourceSurface: 'test',
      redactedObservation: 'user: prefer bullets\nassistant: ok',
    },
    candidates: [
      {
        candidateId: 'cand-pref-1',
        kind: 'preference',
        lane: 'green',
        risk: 'low',
        status: 'auto-applied',
        approvalRequired: false,
        evidenceRefs: ['turn:turn-1'],
        confidence: 0.8,
        expiry: new Date(Date.now() + 86400000).toISOString(),
        receiptId: 'rcpt-pref',
        summary: 'Prefer bullet answers.',
      },
      {
        candidateId: 'cand-skill-1',
        kind: 'skill-signal',
        lane: 'yellow',
        risk: 'medium',
        status: 'candidate',
        approvalRequired: true,
        evidenceRefs: ['turn:turn-1'],
        confidence: 0.75,
        expiry: new Date(Date.now() + 86400000).toISOString(),
        receiptId: 'rcpt-skill',
        summary: 'Repeated release notes workflow.',
      },
      {
        candidateId: 'cand-red-1',
        kind: 'policy-change',
        lane: 'red',
        risk: 'high',
        status: 'blocked',
        approvalRequired: true,
        evidenceRefs: ['turn:turn-1'],
        confidence: 0.9,
        expiry: new Date(Date.now() + 86400000).toISOString(),
        receiptId: 'rcpt-red',
        summary: 'Disable approvals always.',
      },
    ],
    safety: {
      redactionBeforeClassification: true,
      rawSecretsSerialized: false,
      psychologicalInferencesNeverGreen: true,
      policyChangesNeverGreen: true,
      receiptsRequired: true,
    },
    ...overrides,
  };
}

describe('ZavorthAutonomousLearningWriteService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-learning-write-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes nothing in governed mode', () => {
    const service = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      policy: {
        contractVersion: 'zavorth-learning-runtime-policy/1',
        mode: 'governed',
        source: 'explicit',
        securityProfileId: 'enterprise',
        autoWriteGreenPreferences: false,
        autoMaterializeYellowSkillDrafts: false,
        autoInstallSkills: false,
        canModifySecurityPolicy: false,
        userConsentRequired: true,
        summary: 'governed',
      },
    });
    const result = service.applyFromSpine({ learning: learningSnapshot() });
    expect(result.appliedPreferences).toBe(0);
    expect(result.draftedSkills).toBe(0);
    expect(fs.existsSync(service.preferenceStorePath)).toBe(false);
  });

  it('persists green preferences and yellow skill drafts in autonomous mode', () => {
    const service = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      policy: {
        contractVersion: 'zavorth-learning-runtime-policy/1',
        mode: 'autonomous',
        source: 'explicit',
        securityProfileId: 'personal',
        autoWriteGreenPreferences: true,
        autoMaterializeYellowSkillDrafts: true,
        autoInstallSkills: false,
        canModifySecurityPolicy: false,
        userConsentRequired: false,
        summary: 'autonomous',
      },
    });
    const skillForge: ZavorthSkillForgeRuntimeSnapshot = {
      version: 'skill-forge-runtime/v1',
      generatedAt: new Date().toISOString(),
      status: 'needs-approval',
      drafts: [{
        draftId: 'draft-1',
        title: 'Release Notes Workflow',
        status: 'draft',
        materialized: false,
        approvalRequired: true,
        smokeRequired: true,
        rollbackAvailable: true,
        risk: 'medium',
        evidenceRefs: ['turn:turn-1'],
        preview: {
          manifest: '{}',
          skillBody: '# Release Notes\n',
          tests: ['static-risk-scan'],
        },
      }],
      pipeline: ['observe', 'draft'],
      safety: {
        noDirectSkillFileWrites: true,
        executableSupportFilesHeldForApproval: true,
        importedToolsNeverExecutableByDefault: true,
        usageMetricsExcludePromptContent: true,
      },
    };

    const result = service.applyFromSpine({
      learning: learningSnapshot(),
      skillForge,
      sourceSurface: 'telegram',
    });

    expect(result.mode).toBe('autonomous');
    expect(result.appliedPreferences).toBe(1);
    expect(result.draftedSkills).toBe(1);
    expect(result.blocked).toBe(1);
    expect(fs.existsSync(service.preferenceStorePath)).toBe(true);
    const prefs = JSON.parse(fs.readFileSync(service.preferenceStorePath, 'utf8'));
    expect(prefs.preferences[0].summary).toContain('Prefer bullet');
    expect(prefs.preferences[0].reversible).toBe(true);

    const draftDirs = fs.readdirSync(service.skillDraftRoot);
    expect(draftDirs.length).toBe(1);
    expect(fs.existsSync(path.join(service.skillDraftRoot, draftDirs[0], 'SKILL.md'))).toBe(true);
    const meta = JSON.parse(fs.readFileSync(path.join(service.skillDraftRoot, draftDirs[0], 'draft.meta.json'), 'utf8'));
    expect(meta.installed).toBe(false);
    expect(meta.approvalRequired).toBe(true);

    const libraryRoot = path.join(tempDir, 'skill-library');
    expect(fs.existsSync(libraryRoot)).toBe(false);
  });
});
