import { CapabilityPolicyService } from '../../src/services/CapabilityPolicyService.js';

describe('CapabilityPolicyService', () => {
  it('allows read-only host diagnostics in safe profile', () => {
    const service = new CapabilityPolicyService();

    const decision = service.evaluate({
      capability: 'host.shell',
      profile: 'safe',
      autonomyLevel: 1,
      command: 'git status',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.runtimeTarget).toBe('host');
    expect(decision.requiredProfile).toBe('safe');
  });

  it('requires profile upgrade for install capabilities in safe profile', () => {
    const service = new CapabilityPolicyService();

    const decision = service.evaluate({
      capability: 'host.install',
      profile: 'safe',
      autonomyLevel: 3,
      command: 'npm install left-pad',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.blockedReason).toBe('profile_upgrade_required');
  });

  it('routes build and test commands to container when approved', () => {
    const service = new CapabilityPolicyService();

    const decision = service.evaluate({
      capability: 'host.shell',
      profile: 'trusted',
      autonomyLevel: 3,
      command: 'npm run build',
      approved: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.runtimeTarget).toBe('container');
    expect(decision.mutating).toBe(true);
  });

  it('blocks explicitly dangerous host commands even with owner profile', () => {
    const service = new CapabilityPolicyService();

    const decision = service.evaluate({
      capability: 'host.shell',
      profile: 'owner',
      autonomyLevel: 6,
      command: 'shutdown /s',
      approved: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(false);
    expect(decision.blockedReason).toBe('dangerous_command');
  });
});
