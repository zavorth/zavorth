import {
  createWave1PluginToolExposurePolicyFixtures,
  normalizeWave1PluginToolExposurePolicy,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 plugin tool exposure policy fixture parity', () => {
  it('normalizes tool exposure policy while source approval hints stay advisory', () => {
    const fixtures = createWave1PluginToolExposurePolicyFixtures();
    const normalization = normalizeWave1PluginToolExposurePolicy(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'tool-exposure-dangerous-command',
      'tool-exposure-source-approval-advisory',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(JSON.stringify(fixtures)).toContain('external-executor.workspace.forceDelete');
    expect(JSON.stringify(fixtures)).toContain('external-executor.web.fetch');
    expect(JSON.stringify(fixtures)).toContain('preapproved-by-source-policy');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthPluginToolExposurePolicyParity/v1',
      sourceToolNamesStoredAsEvidenceOnly: true,
      sourceApprovalHintsStoredAsEvidenceOnly: true,
      sourceRiskLabelsStoredAsEvidenceOnly: true,
      sourceAuthScopeHintsStoredAsEvidenceOnly: true,
      sourceApprovalHintsGrantAuthority: false,
      sourceToolPolicyAuthority: false,
      sourceToolsExecuted: false,
      toolExposureRuntimeIntroduced: false,
      executionGate: expect.objectContaining({
        sourceCommandsExecuted: false,
        sourceCliProcessesSpawned: false,
        sourceHttpRoutesRegistered: false,
        sourceGatewayMethodsDispatched: false,
        sourceServicesLaunched: false,
        sourceSetupCommandsExecuted: false,
        sourceQaRunnersExecuted: false,
        sourceModulesCopied: false,
        sourceStateMigrated: false,
        sourceCredentialsMigrated: false,
        liveSourceRuntimeConnected: false,
        realAdapterCreated: false,
      }),
    }));
    expect(normalization.policies).toEqual([
      expect.objectContaining({
        id: 'zavorth-tool-policy:wave1-tool-exposure-policy-1-dangerous-command-blocked',
        label: 'Tool exposure policy 1 blocked',
        disposition: 'block',
        risk: 'danger',
        requestedTools: ['workspace.delete'],
        authScopeHints: [
          {
            id: 'auth-scope-hint-1',
            sourceAuthScopeStoredAsEvidenceOnly: true,
          },
        ],
        policy: {
          authority: 'zavorth-tool-exposure-policy',
          sourceApprovalHintAuthority: false,
          sourceRiskLabelAuthority: false,
          sourceAuthScopeAuthority: false,
          sourceToolExecutionAllowed: false,
        },
        sourceApprovalHintGrantsAuthority: false,
        sourceToolExecutionAllowed: false,
        sourcePolicyAppliedDirectly: false,
        nativeContract: 'ZavorthToolExposurePolicySurface/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-tool-policy:wave1-tool-exposure-policy-2-source-approval-advisory',
        label: 'Tool exposure policy 2 approval gated',
        disposition: 'approval-required',
        risk: 'attention',
        requestedTools: ['network_fetch'],
        authScopeHints: [
          {
            id: 'auth-scope-hint-2',
            sourceAuthScopeStoredAsEvidenceOnly: true,
          },
        ],
        sourceApprovalHintGrantsAuthority: false,
        sourceToolExecutionAllowed: false,
        sourcePolicyAppliedDirectly: false,
        nativeContract: 'ZavorthToolExposurePolicySurface/v1',
      }),
    ]);
    expect(normalization.commandCenter.capabilityRows).toEqual([
      expect.objectContaining({
        policyId: 'zavorth-tool-policy:wave1-tool-exposure-policy-1-dangerous-command-blocked',
        status: 'blocked',
        policy: 'blocked',
      }),
      expect.objectContaining({
        policyId: 'zavorth-tool-policy:wave1-tool-exposure-policy-2-source-approval-advisory',
        status: 'requires-approval',
        policy: 'approval-required',
      }),
    ]);
    expect(normalization.toolExposurePolicyInput).toEqual({
      requestedTools: ['workspace.delete', 'network_fetch'],
      allowedTools: [],
      requireApprovalFor: ['network_fetch'],
      blockedTools: ['workspace.delete'],
      blockedToolReason: 'source-policy-hints-advisory-not-authority',
      toolHintProfile: {
        intentCategory: 'external-command-http-tool-exposure',
        groups: ['external-command-http'],
        recommendedToolNames: ['network_fetch'],
        reason: 'Source approval hints are advisory; Zavorth policy remains authoritative.',
      },
    });
    expect(JSON.stringify(normalization)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(normalization)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('preapproved-by-source-policy');
    expect(JSON.stringify(normalization)).not.toContain('plugin:workspace:write');
    expect(JSON.stringify(normalization)).not.toContain('network:egress');
  });
});
