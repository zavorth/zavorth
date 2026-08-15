import fs from 'fs';
import os from 'os';
import path from 'path';
import { DeviceCapabilityPolicy } from '../../src/nodes/policy/DeviceCapabilityPolicy.js';


describe('DeviceCapabilityPolicy', () => {
  const tempDirs: string[] = [];
  const originalCwd = path.resolve(__dirname, '../../');

  afterEach(() => {
    process.chdir(originalCwd);
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('persists and reloads the local allowlist for a device node', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-device-policy-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'device-capability-policy.json');
    const policy = new DeviceCapabilityPolicy({
      policyFile,
      now: () => new Date('2026-04-08T19:00:00.000Z'),
    });

    policy.syncFromCapabilities({
      nodeId: 'Desktop A',
      capabilityIds: ['clipboard.read', 'screen.capture'],
      approvedCapabilityIds: ['clipboard.read'],
    });

    const reloaded = new DeviceCapabilityPolicy({ policyFile });
    const loaded = reloaded.loadPolicies();

    expect(loaded).toEqual([
      expect.objectContaining({
        nodeId: 'desktop-a',
        allowedCapabilities: ['clipboard.read'],
        autoApproveRiskLevel: 'medium',
        source: 'pairing-credentials',
      }),
    ]);
    expect(reloaded.isCapabilityAllowed('desktop-a', 'clipboard.read')).toBe(true);
    expect(reloaded.isCapabilityAllowed('desktop-a', 'screen.capture')).toBe(false);
  });

  it('loads canonical .zavorth device policy on default load', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-device-policy-canonical-'));
    tempDirs.push(root);
    process.chdir(root);
    const canonicalPolicyFile = path.join(root, '.zavorth', 'device-capability-policy.json');
    fs.mkdirSync(path.dirname(canonicalPolicyFile), { recursive: true });
    fs.writeFileSync(
      canonicalPolicyFile,
      `${JSON.stringify({
        version: 1,
        updatedAt: '2026-04-08T19:00:00.000Z',
        policies: {
          'desktop-canonical': {
            nodeId: 'desktop-canonical',
            allowedCapabilities: ['clipboard.read'],
            autoApproveRiskLevel: 'medium',
            source: 'pairing-credentials',
            updatedAt: '2026-04-08T19:00:00.000Z',
            notes: [],
          },
        },
      }, null, 2)}\n`,
      'utf8',
    );

    const policy = new DeviceCapabilityPolicy();
    const loaded = policy.loadPolicies();

    expect(fs.existsSync(canonicalPolicyFile)).toBe(true);
    expect(loaded).toEqual([
      expect.objectContaining({
        nodeId: 'desktop-canonical',
        allowedCapabilities: ['clipboard.read'],
      }),
    ]);
  });
});
