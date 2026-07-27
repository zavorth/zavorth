import {
  explainSurfaceProjection,
  formatProjectionExplain,
  listSurfaceProjectionTelemetry,
  projectResponseForChannel,
  resetSurfaceProjectionTelemetryForTests,
  SURFACE_PROJECTION_OBS_VERSION,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import { resolveSurfaceProfileForChannel } from '../../../src/domain/surface/application/surface-affordance/index.js';
import { buildAgentPermissionApprovalResponse } from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';
import {
  registerPendingSurfaceApproval,
  resolvePendingSurfaceApproval,
  clearPendingSurfaceApproval,
  resetPendingSurfaceApprovalIndexForTests,
} from '../../../src/domain/surface/application/surface-projection/PendingSurfaceApprovalIndex.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('SurfaceProjectionObservability F7 + pending approval index', () => {
  afterEach(() => {
    resetSurfaceProjectionTelemetryForTests();
    resetPendingSurfaceApprovalIndexForTests();
  });

  it('explains why telegram gets native buttons and signal does not', () => {
    const tgProfile = resolveSurfaceProfileForChannel('telegram');
    const tgOut = projectResponseForChannel(
      'telegram',
      buildAgentPermissionApprovalResponse({ approvalId: TASK_ID }, tgProfile),
      {},
      { profile: tgProfile },
    );
    const tgExplain = explainSurfaceProjection({
      channel: 'telegram',
      profile: tgProfile,
      projectorOutput: tgOut,
    });
    expect(tgExplain.version).toBe(SURFACE_PROJECTION_OBS_VERSION);
    expect(tgExplain.usedNativeButtons).toBe(true);
    expect(tgExplain.affordances.inline_buttons).toBe(true);
    expect(formatProjectionExplain(tgExplain)).toMatch(/nativeButtons=true/i);

    const sigProfile = resolveSurfaceProfileForChannel('signal');
    const sigOut = projectResponseForChannel(
      'signal',
      buildAgentPermissionApprovalResponse({ approvalId: TASK_ID }, sigProfile),
      {},
      { profile: sigProfile },
    );
    const sigExplain = explainSurfaceProjection({
      channel: 'signal',
      profile: sigProfile,
      projectorOutput: sigOut,
    });
    expect(sigExplain.usedNativeButtons).toBe(false);
    expect(sigExplain.reasons.some((r) => /inline_buttons disabled/i.test(r))).toBe(true);
    expect(sigExplain.recommendation).toMatch(/chat-interactive|inline_buttons/i);
  });

  it('records telemetry on projectResponseForChannel', () => {
    const profile = resolveSurfaceProfileForChannel('cli');
    projectResponseForChannel(
      'cli',
      buildAgentPermissionApprovalResponse({ approvalId: TASK_ID }, profile),
      {},
      { profile },
    );
    const events = listSurfaceProjectionTelemetry(10);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.channel === 'cli')).toBe(true);
  });

  it('pending approval index resolves by message and latest chat', () => {
    registerPendingSurfaceApproval({
      approvalId: TASK_ID,
      surface: 'telegram',
      chatId: '42',
      messageId: '99',
      highRisk: true,
    });
    expect(
      resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '42', messageId: '99' })
        ....approvalId,
    ).toBe(TASK_ID);
    expect(
      resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '42' })?.highRisk,
    ).toBe(true);
    clearPendingSurfaceApproval({ surface: 'telegram', chatId: '42', approvalId: TASK_ID });
    expect(resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '42' })).toBeNull();
  });
});
