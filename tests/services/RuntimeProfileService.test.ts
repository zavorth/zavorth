import fs from 'fs';
import os from 'os';
import path from 'path';
import { RuntimeProfileService } from '../../src/services/RuntimeProfileService';
import { CapabilityLifecycleService } from '../../src/services/CapabilityLifecycleService';

describe('RuntimeProfileService', () => {
  const originalEnv = process.env;
  const tempDirs: string[] = [];

  function loadModules() {
    return { RuntimeProfileService, CapabilityLifecycleService };
  }

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.ZAVORTH_PROFILE;
    delete process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers the persisted capability lifecycle profile when no explicit override exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-profile-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'capability-state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        version: 1,
        profile: 'ops',
        updatedAt: new Date().toISOString(),
        capabilities: {},
      }),
      'utf8',
    );
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = stateFile;

    const { RuntimeProfileService } = loadModules();
    const service = new RuntimeProfileService();

    expect(service.getProfile()).toBe('ops');
  });

  it('still lets env and constructor arguments override the persisted profile', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-profile-override-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'capability-state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        version: 1,
        profile: 'ops',
        updatedAt: new Date().toISOString(),
        capabilities: {},
      }),
      'utf8',
    );
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = stateFile;
    process.env.ZAVORTH_PROFILE = 'full';

    const { RuntimeProfileService } = loadModules();

    expect(new RuntimeProfileService().getProfile()).toBe('full');
    expect(new RuntimeProfileService('core').getProfile()).toBe('core');
  });

  it('accepts ZAVORTH_PROFILE as the only env bootstrap profile', () => {
    process.env.ZAVORTH_PROFILE = 'ops';

    const { RuntimeProfileService } = loadModules();

    expect(new RuntimeProfileService().getProfile()).toBe('ops');
  });

  it('respects an explicit state file path even without env overrides', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-profile-custom-state-'));
    tempDirs.push(root);
    const customStateFile = path.join(root, 'custom-capability-state.json');
    fs.writeFileSync(
      customStateFile,
      JSON.stringify({
        version: 1,
        profile: 'full',
        updatedAt: new Date().toISOString(),
        capabilities: {},
      }),
      'utf8',
    );

    const { RuntimeProfileService } = loadModules();
    const service = new RuntimeProfileService(undefined, {
      stateFilePath: customStateFile,
    });

    expect(service.getProfile()).toBe('full');
  });

  it('keeps the live runtime profile in sync when the lifecycle profile changes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-profile-live-'));
    tempDirs.push(root);
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = path.join(root, 'capability-state.json');

    const { RuntimeProfileService, CapabilityLifecycleService } = loadModules();
    const runtimeProfileService = new RuntimeProfileService('core');
    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService,
      stateFilePath: process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE,
      manifests: [],
    });

    expect(runtimeProfileService.getProfile()).toBe('core');

    lifecycleService.setProfile('ops', 'tester');

    expect(runtimeProfileService.getProfile()).toBe('ops');
    expect(lifecycleService.getProfile()).toBe('ops');
  });

  it('uses the provided lifecycle state file as the bootstrap source when no runtime profile is injected', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-profile-lifecycle-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'capability-state.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        version: 1,
        profile: 'ops',
        updatedAt: new Date().toISOString(),
        capabilities: {},
      }),
      'utf8',
    );

    const { CapabilityLifecycleService } = loadModules();
    const lifecycleService = new CapabilityLifecycleService({
      stateFilePath: stateFile,
      manifests: [],
    });

    expect(lifecycleService.getProfile()).toBe('ops');
  });

  it('consumes one-time capability approvals after the first successful use', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-profile-once-'));
    tempDirs.push(root);
    process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE = path.join(root, 'capability-state.json');

    const { CapabilityLifecycleService, RuntimeProfileService } = loadModules();
    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService: new RuntimeProfileService('core'),
      stateFilePath: process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE,
    });

    lifecycleService.enableCapability('media', 'tester', 'once');
    const beforeUse = lifecycleService.describeCapability('media');
    const afterUse = lifecycleService.registerCapabilityUsage('media', 'test usage');
    const afterSnapshot = lifecycleService.describeCapability('media');

    expect(beforeUse).toMatchObject({
      capabilityId: 'media',
      approvalScope: 'once',
      enabledByUser: true,
    });
    expect(afterUse).toMatchObject({
      capabilityId: 'media',
      approvalScope: null,
      enabledByUser: false,
      state: 'dormant',
    });
    expect(afterSnapshot).toMatchObject({
      capabilityId: 'media',
      approvalScope: null,
      enabledByUser: false,
      state: 'dormant',
    });
  });
});
