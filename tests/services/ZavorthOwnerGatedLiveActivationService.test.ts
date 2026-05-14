import { ZavorthOwnerGatedLiveActivationService } from '../../src/services/ZavorthOwnerGatedLiveActivationService.js';

describe('ZavorthOwnerGatedLiveActivationService', () => {
  const now = () => new Date('2026-05-05T23:30:00.000Z');

  it('activates all 23 owner-gated live groups with owner approval and receipts', () => {
    const snapshot = new ZavorthOwnerGatedLiveActivationService({
      now,
      env: {},
    }).buildSnapshot({
      activate: true,
      ownerApprovalId: 'owner-approved-live-activation',
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      groups: 23,
      activated: 23,
      approvalRequired: 0,
      blocked: 0,
      agentRuntimeBridges: 3,
      providerRoutes: 2,
      channelRoutes: 2,
      runtimeEnhancements: 2,
      nativeDeviceTargets: 4,
      skills: 8,
      skillBridges: 2,
      receipts: 23,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      enabledByDefault: false,
    }));
    expect(new Set(snapshot.entries.map((entry) => entry.groupId)).size).toBe(23);
    expect(snapshot.receipts.every((receipt) => receipt.status === 'activated')).toBe(true);
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: 'agent.bridge.claude-code-cli',
        status: 'activated',
        liveIoStatus: 'not-required',
      }),
      expect.objectContaining({
        groupId: 'provider.claude.vertex',
        status: 'activated',
        liveIoStatus: 'config-required',
      }),
      expect.objectContaining({
        groupId: 'skill.connector-email-draft',
        status: 'activated',
        liveIoStatus: 'secretref-required',
      }),
      expect.objectContaining({
        groupId: 'bridge.mcp.skill-connectors',
        status: 'activated',
        liveIoStatus: 'not-required',
      }),
    ]));
  });

  it('keeps routes blocked until activation and approval are explicit', () => {
    const snapshot = new ZavorthOwnerGatedLiveActivationService({
      now,
      env: {},
    }).buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.activated).toBe(0);
    expect(snapshot.summary.approvalRequired).toBe(23);
    expect(snapshot.entries.every((entry) => entry.status === 'approval-required')).toBe(true);
  });

  it('detects configured SecretRefs and config refs without serializing values', () => {
    const snapshot = new ZavorthOwnerGatedLiveActivationService({
      now,
      env: {
        CALENDAR_OAUTH: 'redacted-calendar-token',
        ZAVORTH_SKILL_TOOL_EXECUTION_APPROVAL: 'approved',
        AWS_REGION: 'us-east-1',
      },
    }).buildSnapshot({
      activate: true,
      ownerApprovalId: 'owner-approved-live-activation',
    });

    const calendar = snapshot.entries.find((entry) => entry.groupId === 'skill.connector-calendar-brief');
    const bedrock = snapshot.entries.find((entry) => entry.groupId === 'provider.claude.bedrock');

    expect(calendar).toEqual(expect.objectContaining({
      liveIoStatus: 'ready',
      configuredSecretRefs: ['calendar.oauth'],
      missingSecretRefs: [],
    }));
    expect(bedrock).toEqual(expect.objectContaining({
      liveIoStatus: 'ready',
      configuredConfigRefs: ['AWS_REGION'],
      missingConfigRefs: [],
    }));
    expect(JSON.stringify(snapshot)).not.toContain('redacted-calendar-token');
    expect(snapshot.summary.secretValuesSerialized).toBe(false);
  });

  it('formats a concise operator summary', () => {
    const service = new ZavorthOwnerGatedLiveActivationService({
      now,
      env: {},
    });
    const snapshot = service.buildSnapshot({
      activate: true,
      ownerApprovalId: 'owner-approved-live-activation',
    });
    const text = service.formatSnapshotText(snapshot);

    expect(text).toContain('Zavorth Owner-Gated Live Activation');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Groups: 23');
    expect(text).toContain('Activated/approval-required/blocked: 23/0/0');
  });
});
