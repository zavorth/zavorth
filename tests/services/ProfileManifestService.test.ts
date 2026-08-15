import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProfileManifestService } from '../../src/services/ProfileManifestService';

import {
  ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION,
  ZAVORTH_PROFILE_BUNDLE_VERSION,
  ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION,
  ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION,
} from '../../src/contracts/ProfileManifestContract';

describe('ProfileManifestService', () => {
  it('loads the built-in declarative profiles as neutral runtime bundles', () => {
    const service = new ProfileManifestService({
      profileDir: path.join(__dirname, 'config', 'profile-manifests'),
    });

    const bundles = service.compileAll();
    const ids = bundles.map((bundle) => bundle.id);

    expect(ids).toEqual(expect.arrayContaining([
      'personal',
      'developer',
      'operator',
      'team',
      'creator',
      'business',
      'power',
    ]));
    expect(bundles.find((bundle) => bundle.id === 'business')?.runtimePolicy).toEqual(expect.objectContaining({
      trustMode: 'strict',
      approvalMode: 'always',
    }));
    expect(bundles.find((bundle) => bundle.id === 'power')?.cognitivePolicy).toEqual(expect.objectContaining({
      planningDepth: 'deep',
    }));
    expect(bundles.every((bundle) => bundle.version === ZAVORTH_PROFILE_BUNDLE_VERSION)).toBe(true);
    expect(bundles.find((bundle) => bundle.id === 'developer')).toEqual(expect.objectContaining({
      cognitiveContextBundle: expect.objectContaining({
        version: ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION,
        profileId: 'developer',
        planningDepth: 'deep',
        memoryMode: 'episodic',
      }),
      runtimePolicyBundle: expect.objectContaining({
        version: ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION,
        profileId: 'developer',
        sandboxMode: 'required',
        requireApproval: expect.arrayContaining(['workspace.write', 'shell.exec']),
      }),
      surfaceExperienceBundle: expect.objectContaining({
        version: ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION,
        profileId: 'developer',
        defaultSurface: 'cli',
      }),
      runtimePolicy: expect.objectContaining({
        sandboxMode: 'required',
        maxToolRounds: 12,
      }),
      capabilityPolicy: expect.objectContaining({
        requireApproval: expect.arrayContaining(['workspace.write', 'shell.exec']),
      }),
      improvementPolicy: expect.objectContaining({
        mode: 'quiet-staging',
        silent: expect.arrayContaining(['staging_diff', 'sandbox_validation']),
        notify: expect.arrayContaining(['low_risk_archive']),
        requireApproval: expect.arrayContaining(['apply', 'secret', 'external_send']),
        interruptMode: 'daily-digest',
      }),
    }));

    expect(bundles.find((bundle) => bundle.id === 'personal')?.improvementPolicy).toEqual(expect.objectContaining({
      mode: 'quiet-curation',
      silent: expect.arrayContaining(['draft_skill', 'low_risk_archive']),
      requireApproval: expect.arrayContaining(['apply', 'policy', 'secret']),
      interruptMode: 'never-for-low-risk',
    }));
    expect(bundles.find((bundle) => bundle.id === 'operator')?.improvementPolicy).toEqual(expect.objectContaining({
      mode: 'manual',
      silent: ['telemetry'],
      requireApproval: expect.arrayContaining(['low_risk_archive', 'apply', 'external_send']),
      interruptMode: 'immediate',
    }));
  });

  it('compiles custom YAML/JSON manifests without hardcoded profile names', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-profile-manifests-'));
    fs.writeFileSync(path.join(root, 'foundation.yaml'), [
      'version: zavorth.profile/1',
      'id: foundation',
      'label: Foundation',
      'runtime:',
      '  approvalMode: always',
      'capabilities:',
      '  allow:',
      '    - workspace.read',
      '  requireApproval:',
      '    - shell.exec',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'custom.json'), JSON.stringify({
      version: 'zavorth.profile/1',
      id: 'custom-lab',
      label: 'Custom Lab',
      extends: 'foundation',
      runtime: {
        maxToolRounds: 4,
      },
      capabilities: {
        allow: ['browser.inspect'],
      },
      memory: {
        mode: 'semantic',
      },
      improvement: {
        mode: 'quiet-curation',
        silent: ['telemetry', 'candidate'],
        notify: ['draft_skill'],
        requireApproval: ['apply', 'secret'],
        interruptMode: 'never-for-low-risk',
      },
    }, null, 2));

    const service = new ProfileManifestService({ profileDir: root });
    const bundle = service.compileProfileById('custom-lab');

    expect(bundle).toEqual(expect.objectContaining({
      id: 'custom-lab',
      sourceIds: ['foundation', 'custom-lab'],
      runtimePolicy: expect.objectContaining({
        approvalMode: 'always',
        maxToolRounds: 4,
      }),
      capabilityPolicy: expect.objectContaining({
        allow: ['workspace.read', 'browser.inspect'],
        requireApproval: ['shell.exec'],
      }),
      memoryPolicy: expect.objectContaining({
        mode: 'semantic',
      }),
      improvementPolicy: expect.objectContaining({
        mode: 'quiet-curation',
        silent: ['telemetry', 'candidate'],
        notify: ['draft_skill'],
        requireApproval: ['apply', 'secret'],
        interruptMode: 'never-for-low-risk',
      }),
    }));
    expect(bundle?.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the three compiled profile bundles independently', () => {
    const service = new ProfileManifestService({
      profileDir: path.join(__dirname, 'config', 'profile-manifests'),
    });

    const compiled = service.compileBundlesById('operator');

    expect(compiled?.profile.id).toBe('operator');
    expect(compiled?.cognitive.version).toBe(ZAVORTH_COGNITIVE_CONTEXT_BUNDLE_VERSION);
    expect(compiled?.runtime.version).toBe(ZAVORTH_RUNTIME_POLICY_BUNDLE_VERSION);
    expect(compiled?.surface.version).toBe(ZAVORTH_SURFACE_EXPERIENCE_BUNDLE_VERSION);
    expect(compiled?.runtime.approvalMode).toBe('always');
    expect(compiled?.surface.allowedSurfaces).toEqual(expect.arrayContaining(['cli', 'zavorthControl', 'api']));
    expect(compiled?.cognitive.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(compiled?.runtime.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(compiled?.surface.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
