import fs from 'fs';
import path from 'path';

describe('CapabilityLifecycleService cleanup behavior', () => {
  const originalEnv = process.env;
  const tempRoots: string[] = [];

  function loadModules() {
    let CapabilityLifecycleService: any;
    let RuntimeProfileService: any;
    let config: any;

    jest.isolateModules(() => {
      ({ CapabilityLifecycleService } = require('../../src/services/CapabilityLifecycleService'));
      ({ RuntimeProfileService } = require('../../src/services/RuntimeProfileService'));
      ({ config } = require('../../src/config/index'));
    });

    return { CapabilityLifecycleService, RuntimeProfileService, config };
  }

  function createProjectTempRoot(projectRoot: string, label: string): string {
    const root = path.join(projectRoot, 'tmp-jest-artifacts', `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    fs.mkdirSync(root, { recursive: true });
    tempRoots.push(root);
    return root;
  }

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
    while (tempRoots.length > 0) {
      const target = tempRoots.pop();
      if (target && fs.existsSync(target)) {
        try {
          fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
        } catch {
          // Evita falha espuria do Windows quando um handle temporario demora a soltar.
        }
      }
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('moves an optional capability back to dormant when it is disabled', () => {
    const { CapabilityLifecycleService, RuntimeProfileService, config } = loadModules();
    const root = createProjectTempRoot(config.projectRoot, 'capability-clean');
    const staleFile = path.join(root, 'remote.log');
    const staleStatus = path.join(root, 'remote.status.json');
    fs.writeFileSync(staleFile, 'log', 'utf8');
    fs.writeFileSync(staleStatus, '{}', 'utf8');
    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService: new RuntimeProfileService('core'),
      stateFilePath: path.join(root, 'state.json'),
      manifests: [{
        id: 'test-remote',
        label: 'Test remote',
        description: 'cleanup test',
        availability: 'optional',
        activationMode: 'sidecar',
        approvalRequired: true,
        enabledByDefaultProfiles: ['full'],
        idleTtlMs: 1000,
        estimatedFootprint: { ramIdleMb: 1, diskMb: 1, processCount: 1 },
        provisioningRecipe: null,
        cleanupPaths: [staleFile, staleStatus],
        fallbackBehavior: 'fallback',
      }],
    });
    lifecycleService.enableCapability('test-remote', 'tester', 'host');

    const disabled = lifecycleService.disableCapability('test-remote', 'tester');

    expect(disabled).toMatchObject({
      capabilityId: 'test-remote',
      state: 'dormant',
      enabledByUser: false,
      approvalScope: null,
    });
    const afterDisable = lifecycleService.describeCapability('test-remote');
    expect(afterDisable).toMatchObject({
      capabilityId: 'test-remote',
      state: 'dormant',
      enabledByUser: false,
      approvalScope: null,
    });
  });

  it('does not clean artifacts while the capability is enabled for the current host', () => {
    const { CapabilityLifecycleService, RuntimeProfileService, config } = loadModules();
    const root = createProjectTempRoot(config.projectRoot, 'capability-enabled');
    const activeFile = path.join(root, 'qa-output.json');
    fs.writeFileSync(activeFile, 'keep', 'utf8');

    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService: new RuntimeProfileService('core'),
      stateFilePath: path.join(root, 'state.json'),
      manifests: [{
        id: 'test-qa',
        label: 'Test qa',
        description: 'enabled cleanup test',
        availability: 'optional',
        activationMode: 'lazy',
        approvalRequired: true,
        enabledByDefaultProfiles: ['full'],
        idleTtlMs: 1000,
        estimatedFootprint: { ramIdleMb: 1, diskMb: 1, processCount: 0 },
        provisioningRecipe: null,
        cleanupPaths: [activeFile],
        fallbackBehavior: 'fallback',
      }],
    });

    lifecycleService.enableCapability('test-qa', 'tester', 'host');
    const cleaned = lifecycleService.cleanupDormantCapabilityArtifacts(['test-qa']);

    expect(cleaned).toEqual([]);
    expect(fs.existsSync(activeFile)).toBe(true);
  });

  it('expires session-scoped capabilities after the idle TTL elapses', () => {
    const { CapabilityLifecycleService, RuntimeProfileService, config } = loadModules();
    const root = createProjectTempRoot(config.projectRoot, 'capability-expire');
    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService: new RuntimeProfileService('core'),
      stateFilePath: path.join(root, 'state.json'),
      manifests: [{
        id: 'test-remote',
        label: 'Test remote',
        description: 'ttl expiration test',
        availability: 'optional',
        activationMode: 'sidecar',
        approvalRequired: true,
        enabledByDefaultProfiles: ['full'],
        idleTtlMs: 1000,
        estimatedFootprint: { ramIdleMb: 1, diskMb: 1, processCount: 1 },
        provisioningRecipe: null,
        cleanupPaths: [],
        fallbackBehavior: 'fallback',
      }],
    });

    lifecycleService.enableCapability('test-remote', 'tester', 'session');
    lifecycleService.registerCapabilityUsage('test-remote', 'ttl test');

    const expired = lifecycleService.expireIdleCapabilities(Date.now() + 5_000);
    const snapshot = lifecycleService.describeCapability('test-remote');

    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({
      capabilityId: 'test-remote',
    });
    expect(snapshot).toMatchObject({
      capabilityId: 'test-remote',
      state: 'dormant',
      enabledByUser: false,
      approvalScope: null,
    });
  });

  it('reconciles default capability states when the profile changes', () => {
    const { CapabilityLifecycleService, RuntimeProfileService, config } = loadModules();
    const root = createProjectTempRoot(config.projectRoot, 'capability-profile');
    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService: new RuntimeProfileService('core'),
      stateFilePath: path.join(root, 'state.json'),
      manifests: [{
        id: 'test-discord',
        label: 'Test discord',
        description: 'profile reconciliation test',
        availability: 'optional',
        activationMode: 'lazy',
        approvalRequired: false,
        enabledByDefaultProfiles: ['full'],
        idleTtlMs: null,
        estimatedFootprint: { ramIdleMb: 1, diskMb: 1, processCount: 0 },
        provisioningRecipe: null,
        cleanupPaths: [],
        fallbackBehavior: 'fallback',
      }],
    });

    expect(lifecycleService.describeCapability('test-discord')).toMatchObject({
      capabilityId: 'test-discord',
      state: 'dormant',
    });

    lifecycleService.setProfile('full', 'tester');

    expect(lifecycleService.describeCapability('test-discord')).toMatchObject({
      capabilityId: 'test-discord',
      state: 'ready',
      enabledByProfile: true,
    });
  });

  it('persists the product mode alongside the runtime profile', () => {
    const { CapabilityLifecycleService, RuntimeProfileService, config } = loadModules();
    const root = createProjectTempRoot(config.projectRoot, 'capability-product-mode');
    const stateFilePath = path.join(root, 'state.json');
    const lifecycleService = new CapabilityLifecycleService({
      runtimeProfileService: new RuntimeProfileService('core'),
      stateFilePath,
      manifests: [],
    });

    const snapshot = lifecycleService.setProductMode('operator', 'tester');
    const persisted = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));

    expect(snapshot).toMatchObject({
      id: 'operator',
      runtimeProfile: 'ops',
      defaultRuntimeProfile: 'ops',
    });
    expect(persisted).toMatchObject({
      profile: 'ops',
      productMode: 'operator',
    });
  });
});
