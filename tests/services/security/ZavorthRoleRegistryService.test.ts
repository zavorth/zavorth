import { ZavorthExtensionRegistryService } from '../../../src/services/ZavorthExtensionRegistryService.js';
import { ZavorthRoleRegistryService, defaultRoleDescriptors } from '../../../src/services/ZavorthRoleRegistryService.js';
import { defaultRoleLibrary, resolveSyncRoleSelection } from '../../../src/agents/swarm-v2/SwarmV2Planner.js';

describe('ZavorthRoleRegistryService', () => {
  it('publishes all governed compositions through descriptors rather than planner hardcoding', () => {
    const compositions = new Set(defaultRoleDescriptors().map((role) => role.composition));
    expect(compositions).toEqual(new Set(['specialist', 'verifier', 'researcher', 'executor', 'critic', 'observer', 'background', 'tree', 'team', 'swarm', 'kanban']));
    expect(defaultRoleLibrary().map((role) => role.id)).toEqual(expect.arrayContaining(['planner', 'researcher', 'implementer', 'verifier', 'observer', 'background', 'swarm', 'kanban']));
  });

  it('rejects unsafe write roles and unbounded budgets', () => {
    const registry = new ZavorthRoleRegistryService({ includeDefaults: false });
    const unsafe = { ...defaultRoleDescriptors()[0]!, id: 'unsafe', mandate: 'short', capabilityScope: { ...defaultRoleDescriptors()[0]!.capabilityScope, filesystem: 'workspace-write' as const }, budget: { ...defaultRoleDescriptors()[0]!.budget, maxToolCalls: Number.POSITIVE_INFINITY } };
    expect(registry.certify(unsafe).findings.map((item) => item.code)).toEqual(expect.arrayContaining(['mandate_incomplete', 'write_approval_missing', 'budget_invalid']));
    expect(registry.list()).toEqual([]);
  });

  it('enforces approval, cancellation, and resume lifecycle', () => {
    const registry = new ZavorthRoleRegistryService();
    expect(() => registry.activate('implementer')).toThrow('requires approval');
    const activation = registry.issueLifecycleCthere isllenge('implementer', 'activate');
    expect(registry.activate('implementer', activation.id)).toBe('active');
    expect(registry.cancel('implementer')).toBe('cancelled');
    expect(() => registry.resume('implementer')).toThrow('requires approval');
    const cancelledResume = registry.issueLifecycleCthere isllenge('implementer', 'resume');
    expect(registry.resume('implementer', cancelledResume.id)).toBe('active');
    expect(registry.pause('implementer')).toBe('paused');
    expect(() => registry.resume('implementer', cancelledResume.id)).toThrow('requires approval');
    const pausedResume = registry.issueLifecycleCthere isllenge('implementer', 'resume');
    expect(registry.resume('implementer', pausedResume.id)).toBe('active');
    expect(registry.complete('implementer')).toBe('completed');
    expect(() => registry.activate('implementer', activation.id)).toThrow('Use resume for terminal states');
    expect(() => registry.cancel('planner')).toThrow('cannot cancel from registered');
  });

  it('registers certified roles through the unified Extension Registry', async () => {
    const roles = new ZavorthRoleRegistryService();
    const extensions = new ZavorthExtensionRegistryService({
      sourceTrustVerifier: async () => true,
      approvalVerifier: async (context) => context.approvalId === 'role-verifier-test-approval',
    });
    roles.registerExtension(extensions, 'verifier');
    expect(extensions.list('verifier')).toHaveLength(1);
    await expect(extensions.invoke('role.verifier', 'verifier', null, {
      approvalId: 'role-verifier-test-approval',
    })).resolves.toEqual(expect.objectContaining({ id: 'verifier', composition: 'verifier' }));
  });

  it('does not keyword-route free-text objectives', () => {
    const library = defaultRoleLibrary();
    const first = resolveSyncRoleSelection({ objective: 'research security', library, selectedRoleIds: [], requestedRoles: [], autoSelectRoles: true, desiredRoleCount: 4 });
    const second = resolveSyncRoleSelection({ objective: 'write poetry', library, selectedRoleIds: [], requestedRoles: [], autoSelectRoles: true, desiredRoleCount: 4 });
    expect(first.selectedRoleIds).toEqual(second.selectedRoleIds);
  });

  it('rejects malformed runtime enums, arrays, evidence, lifecycle, and selection metadata', () => {
    const registry = new ZavorthRoleRegistryService({ includeDefaults: false });
    const base = defaultRoleDescriptors()[0]!;
    const malformed = {
      ...base,
      id: 'malformed',
      capabilityScope: { ...base.capabilityScope, filesystem: 'root', network: 'allowed', capabilityIds: ['', 'A B', 'a-b'], toolIds: ['x', 'X'], surfaces: [''] },
      budget: { maxToolCalls: 1.5, maxWallClockMs: Number.NaN, maxOutputBytes: 2_000_000_000, maxNetworkCalls: -1 },
      approvalBoundary: { required: false, requiredFor: ['network'] },
      evidence: { requiredKinds: ['', 'Receipt', 'receipt'], minimumCount: Number.NaN, verifierRoleIds: ['malformed'], independentVerifierRequired: true },
      lifecycle: { cancellable: true, resumable: true, pausable: true, terminalStates: ['completed', 'completed', 'unknown'], allowedTransitions: ['activate', 'activate'] },
      tags: ['default-selection:nope', 'default-selection:2'],
    } as never;
    const codes = registry.certify(malformed).findings.map((item) => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'filesystem_invalid', 'network_trust_required', 'capability_id_empty', 'capability_id_duplicate', 'tool_id_duplicate', 'surface_id_empty',
      'budget_invalid', 'approval_inconsistent', 'evidence_invalid', 'evidence-kind_id_empty', 'evidence-kind_id_duplicate',
      'self_verification_forbidden', 'lifecycle_invalid', 'transitions_invalid', 'transitions_inconsistent', 'selection_priority_invalid',
    ]));
  });

  it('returns defensive copies from register, get, and list', () => {
    const registry = new ZavorthRoleRegistryService({ includeDefaults: false });
    const source = { ...defaultRoleDescriptors()[0]!, id: 'immutable' };
    const registered = registry.register(source);
    registered.label = 'mutated';
    source.label = 'source-mutated';
    const fetched = registry.get('immutable')!;
    fetched.capabilityScope.capabilityIds.push('injected');
    registry.list()[0]!.budget.maxToolCalls = 99999;
    expect(registry.get('immutable')).toMatchObject({ label: 'Planner', capabilityScope: { capabilityIds: ['role.planner'] }, budget: { maxToolCalls: 10 } });
  });

  it('rejects malformed partial descriptors without throwing during certification', () => {
    const registry = new ZavorthRoleRegistryService({ includeDefaults: false });
    expect(() => registry.certify({
      id: 'partial',
      approvalBoundary: { required: 'yes', requiredFor: undefined } as never,
      evidence: { requiredKinds: [], minimumCount: 1, verifierRoleIds: undefined, independentVerifierRequired: true } as never,
      lifecycle: { cancellable: true, resumable: true, pausable: true, terminalStates: undefined, allowedTransitions: undefined } as never,
    })).not.toThrow();
    const certification = registry.certify({
      id: 'partial',
      approvalBoundary: { required: 'yes', requiredFor: undefined } as never,
      evidence: { requiredKinds: [], minimumCount: 1, verifierRoleIds: undefined, independentVerifierRequired: true } as never,
      lifecycle: { cancellable: true, resumable: true, pausable: true, terminalStates: undefined, allowedTransitions: undefined } as never,
    });
    expect(certification.status).toBe('rejected');
    expect(certification.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'approval_required_invalid', 'independent_verifier_missing', 'lifecycle_invalid', 'transitions_invalid',
    ]));
  });
});
