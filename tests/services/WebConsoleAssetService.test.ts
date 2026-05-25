import fs from 'fs';
import os from 'os';
import path from 'path';
import { WebConsoleAssetService } from '../../src/domain/surface/presentation/web-console/WebConsoleAssetService.js';

describe('WebConsoleAssetService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('serves the official gateway dashboard at /dashboard and root', () => {
    const service = new WebConsoleAssetService(process.cwd());
    for (const route of ['/', '/dashboard']) {
      const response = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const writeJson = jest.fn();

      expect(service.handleStaticRoute(route, response as any, writeJson)).toBe(true);
      expect(response.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      const html = String(response.end.mock.calls[0][0] || '');
      expect(html).toContain('Local gateway ready');
      expect(html).toContain('Ask normally. Zavorth will answer, preview risky work, and ask before acting.');
      expect(html).toContain('Ask Zavorth');
      expect(html).toContain('zavorth-icon.svg');
      expect(writeJson).not.toHaveBeenCalled();
    }
  });

  it('redirects /dashboard to the final-user dashboard surface', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-control-removed-'));
    tempDirs.push(root);

    const service = new WebConsoleAssetService(root);
    const response = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    const writeJson = jest.fn();

    expect(service.handleStaticRoute('/dashboard', response as any, writeJson)).toBe(true);
    expect(response.writeHead).toHaveBeenCalledWith(302, {
      Location: '/dashboard',
      'Cache-Control': 'no-store',
    });
    expect(response.end).toHaveBeenCalled();
    expect(writeJson).not.toHaveBeenCalled();
  });
  it('keeps Dashboard fixture review behind a dev/test flag', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-review-gate-'));
    tempDirs.push(root);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousReviewEnabled = process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED;
    const previousExperimental = process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL;

    try {
      process.env.NODE_ENV = 'test';
      delete process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED;
      delete process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL;

      const service = new WebConsoleAssetService(root);
      const blockedResponse = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const blockedJson = jest.fn();

      expect(service.handleStaticRoute('/dashboard/review', blockedResponse as any, blockedJson)).toBe(true);
      expect(blockedResponse.writeHead).toHaveBeenCalledWith(302, {
        Location: '/dashboard',
        'Cache-Control': 'no-store',
      });
      expect(blockedResponse.end).toHaveBeenCalled();
      expect(blockedJson).not.toHaveBeenCalled();

      process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED = 'true';
      const allowedResponse = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const allowedJson = jest.fn();

      expect(service.handleStaticRoute('/dashboard/review', allowedResponse as any, allowedJson)).toBe(true);
      expect(allowedJson).not.toHaveBeenCalled();
      expect(allowedResponse.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      expect(String(allowedResponse.end.mock.calls[0][0])).toContain('Dashboard Review');
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousReviewEnabled === undefined) {
        delete process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED;
      } else {
        process.env.ZAVORTH_COMMAND_CENTER_REVIEW_ENABLED = previousReviewEnabled;
      }
      if (previousExperimental === undefined) {
        delete process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL;
      } else {
        process.env.ZAVORTH_COMMAND_CENTER_EXPERIMENTAL = previousExperimental;
      }
    }
  });

  it('redirects /app to the normal final-user web surface', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-legacy-'));
    tempDirs.push(root);

    const service = new WebConsoleAssetService(root);
    const response = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    const writeJson = jest.fn();

    expect(service.handleStaticRoute('/app', response as any, writeJson)).toBe(true);
    expect(response.writeHead).toHaveBeenCalledWith(302, {
      Location: '/dashboard',
      'Cache-Control': 'no-store',
    });
    expect(response.end).toHaveBeenCalled();
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('keeps /app available only with an explicit dev/test legacy flag', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-legacy-enabled-'));
    tempDirs.push(root);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousLegacyFlag = process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;

    try {
      process.env.NODE_ENV = 'test';
      process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = '1';
      const service = new WebConsoleAssetService(root);
      const response = {
        writeHead: jest.fn(),
        end: jest.fn(),
      };
      const writeJson = jest.fn();

      expect(service.handleStaticRoute('/app', response as any, writeJson)).toBe(true);
    const html = String(response.end.mock.calls[0][0] || '');
    expect(html).toContain('legacy-surface-banner');
    expect(html).toContain('Legacy surface');
    expect(html).toContain('frozen');
    expect(html).toContain('Use /dashboard as the main entry');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('./app.js');
    expect(html).toContain('./styles.css');
    expect(writeJson).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousLegacyFlag === undefined) {
        delete process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
      } else {
        process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = previousLegacyFlag;
      }
    }
  });

  it('embeds auth-aware onboarding script for protected runtime data', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-script-'));
    tempDirs.push(root);

    const previousNodeEnv = process.env.NODE_ENV;
    const previousLegacyFlag = process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
    process.env.NODE_ENV = 'test';
    process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = '1';
    const service = new WebConsoleAssetService(root);
    const response = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    const writeJson = jest.fn();

    expect(service.handleStaticRoute('/app.js', response as any, writeJson)).toBe(true);
    const script = String(response.end.mock.calls[0][0] || '');
    expect(script).toContain('validateProtectedAccess');
    expect(script).toContain('renderPriorityState');
    expect(script).toContain('renderProfileRecommendations');
    expect(script).toContain('renderAlternativeRoutes');
    expect(script).toContain('renderProtectedCardHierarchy');
    expect(script).toContain('refreshProtectedShellState');
    expect(script).toContain('ensureGatewayControlSocket');
    expect(script).toContain('/api/web/gateway/ws');
    expect(script).toContain('runPriorityPrimaryAction');
    expect(script).toContain('renderOperationalMeshSummary');
    expect(script).toContain('buildOperationalSelectorRow');
    expect(script).toContain('fetchNodeOperationalPanel');
    expect(script).toContain('fetchChannelOperationalPanel');
    expect(script).toContain('fetchChannelInstallPlan');
    expect(script).toContain('parseOperationalEnvEntries');
    expect(script).toContain('fetchTransportOperationalPanel');
    expect(script).toContain('fetchExtensionOperationalPanel');
    expect(script).toContain('runOperationalMeshInlineAction');
    expect(script).toContain('renderSessionWorkspace');
    expect(script).toContain('renderLearningMemory');
    expect(script).toContain('buildSessionWorkspaceDiffItems');
    expect(script).toContain('buildSessionWorkspaceResourceItems');
    expect(script).toContain('buildSessionWorkspaceCompanionItems');
    expect(script).toContain('buildSessionWorkspaceHealthItems');
    expect(script).toContain('renderLayeredMemorySearchResults');
    expect(script).toContain('#ops-quality-state');
    expect(script).toContain('#ops-quality-summary');
    expect(script).toContain('#ops-quality-status');
    expect(script).toContain('#ops-quality-details');
    expect(script).toContain('runLearningAction');
    expect(script).toContain('runLayeredMemorySearch');
    expect(script).toContain('refreshLearningMemoryPanels');
    expect(script).toContain('installLearningMemoryInteractions');
    expect(script).toContain('renderTrustPlanePanel');
    expect(script).toContain('refreshTrustPlanePanel');
    expect(script).toContain('runTrustPlaneAction');
    expect(script).toContain('installTrustPlaneInteractions');
    expect(script).toContain('#trust-plane-host-state');
    expect(script).toContain('/api/web/trust-plane');
    expect(script).toContain('/api/web/trust-plane/actions');
    expect(script).toContain('renderEvalControlPlanePanel');
    expect(script).toContain('refreshEvalControlPlanePanel');
    expect(script).toContain('installEvalControlPlaneInteractions');
    expect(script).toContain('#eval-control-plane-state');
    expect(script).toContain('/api/web/operations/evals');
    expect(script).toContain('renderHubControlPlanePanel');
    expect(script).toContain('refreshHubControlPlanePanel');
    expect(script).toContain('runHubControlPlaneAction');
    expect(script).toContain('installHubControlPlaneInteractions');
    expect(script).toContain('#hub-control-plane-state');
    expect(script).toContain('/api/web/hub');
    expect(script).toContain('/api/web/hub/actions');
    expect(script).toContain("'platform-sync'");
    expect(script).toContain("'mcp-doctor'");
    expect(script).toContain('renderQaControlPlanePanel');
    expect(script).toContain('refreshQaControlPlanePanel');
    expect(script).toContain('installQaControlPlaneInteractions');
    expect(script).toContain('#qa-control-plane-state');
    expect(script).toContain('/api/web/operations/qa');
    expect(script).toContain('renderGovernanceControlPlanePanel');
    expect(script).toContain('refreshGovernanceControlPlanePanel');
    expect(script).toContain('installGovernanceControlPlaneInteractions');
    expect(script).toContain('#governance-control-plane-state');
    expect(script).toContain('/api/web/operations/governance');
    expect(script).toContain('renderReplayLearningControlPlanePanel');
    expect(script).toContain('refreshReplayLearningControlPlanePanel');
    expect(script).toContain('installReplayLearningControlPlaneInteractions');
    expect(script).toContain('#replay-learning-state');
    expect(script).toContain('/api/web/operations/replay-learning');
    expect(script).toContain('renderEcosystemControlPlanePanel');
    expect(script).toContain('refreshEcosystemControlPlanePanel');
    expect(script).toContain('installEcosystemControlPlaneInteractions');
    expect(script).toContain('#ecosystem-control-plane-state');
    expect(script).toContain('/api/web/operations/ecosystem');
    expect(script).toContain('renderDistributedRuntimeControlPlanePanel');
    expect(script).toContain('refreshDistributedRuntimeControlPlanePanel');
    expect(script).toContain('installDistributedRuntimeControlPlaneInteractions');
    expect(script).toContain('#distributed-runtime-control-plane-state');
    expect(script).toContain('/api/web/operations/distributed-runtime');
    expect(script).toContain('renderRuntimeStabilityControlPlanePanel');
    expect(script).toContain('refreshRuntimeStabilityControlPlanePanel');
    expect(script).toContain('installRuntimeStabilityControlPlaneInteractions');
    expect(script).toContain('#runtime-stability-control-plane-state');
    expect(script).toContain('/api/web/operations/runtime-stability');
    expect(script).toContain('renderRolloutReadinessControlPlanePanel');
    expect(script).toContain('refreshRolloutReadinessControlPlanePanel');
    expect(script).toContain('installRolloutReadinessControlPlaneInteractions');
    expect(script).toContain('#rollout-readiness-control-plane-state');
    expect(script).toContain('/api/web/operations/rollout-readiness');
    expect(script).toContain('renderAutomationControlPlanePanel');
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousLegacyFlag === undefined) {
      delete process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
    } else {
      process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = previousLegacyFlag;
    }
    expect(script).toContain('refreshAutomationControlPlanePanel');
    expect(script).toContain('runAutomationControlPlaneAction');
    expect(script).toContain('installAutomationControlPlaneInteractions');
    expect(script).toContain('#automation-control-plane-state');
    expect(script).toContain('/api/web/operations/automations');
    expect(script).toContain('/api/web/automations/actions');
    expect(script).toContain('renderWatchModePanel');
    expect(script).toContain('refreshWatchModePanel');
    expect(script).toContain('runWatchModeStart');
    expect(script).toContain('runWatchModePolicyAction');
    expect(script).toContain('runWatchModeMutation');
    expect(script).toContain('runWatchModeApprovalDecision');
    expect(script).toContain('installWatchModeInteractions');
    expect(script).toContain('#watch-mode-state');
    expect(script).toContain('/api/web/watch-mode?limit=8');
    expect(script).toContain('/api/web/watch-mode/policy');
    expect(script).toContain('/api/web/watch-mode/runs');
    expect(script).toContain('/api/web/watch-mode/runs/');
    expect(script).toContain('data-watch-mode-approval');
    expect(script).toContain('renderSystemOverlordPanel');
    expect(script).toContain('buildSystemOverlordActionControls');
    expect(script).toContain('refreshSystemOverlordPanel');
    expect(script).toContain('runSystemOverlordSupervisedAction');
    expect(script).toContain('runSystemOverlordApprovalDecision');
    expect(script).toContain('runSystemOverlordKillSwitch');
    expect(script).toContain('runSystemOverlordActionMutation');
    expect(script).toContain('installSystemOverlordInteractions');
    expect(script).toContain('applyCapabilityPlaceholder');
    expect(script).toContain("'network.tunnel'");
    expect(script).toContain("'node.invoke'");
    expect(script).toContain("'secrets.read'");
    expect(script).toContain('/api/web/system-overlord?limit=20');
    expect(script).toContain('/api/web/system-overlord/actions');
    expect(script).toContain('/api/web/system-overlord/kill-switch');
    expect(script).toContain('/api/web/system-overlord/approvals/');
    expect(script).toContain('/cancel');
    expect(script).toContain('/rollback');
    expect(script).toContain('data-overlord-approval');
    expect(script).toContain('data-overlord-action-mode');
    expect(script).toContain('#system-overlord-state');
    expect(script).toContain('#system-overlord-kill-switch-enable');
    expect(script).toContain('fetchSessionWorkspacePayload');
    expect(script).toContain('/api/web/gateway/sessions');
    expect(script).toContain('buildSessionWorkspaceApprovalItems');
    expect(script).toContain('runSessionWorkspaceApprovalAction');
    expect(script).toContain('runSessionWorkspaceCompanionAction');
    expect(script).toContain('runSessionWorkspaceReplayAction');
    expect(script).toContain('buildReplayComparePrompt');
    expect(script).toContain('installSessionWorkspaceInteractions');
    expect(script).toContain('installOperationalMeshActions');
    expect(script).toContain('runOperationalMeshAction');
    expect(script).toContain('runSessionWorkspaceAction');
    expect(script).toContain('postProtectedJson');
    expect(script).toContain('runJourneyTrustAction');
    expect(script).toContain('/api/web/host/trust');
    expect(script).toContain('/api/web/host/install-journey/actions');
    expect(script).toContain('runOfficialRemoteAction');
    expect(script).toContain('/api/web/host/official-remote-access/actions');
    expect(script).toContain('/api/web/nodes');
    expect(script).toContain('/api/web/nodes/doctor');
    expect(script).toContain('/api/web/nodes/recover');
    expect(script).toContain('/approved-capabilities');
    expect(script).toContain('/bootstrap');
    expect(script).toContain('/api/web/nodes/');
    expect(script).toContain('/api/web/channels');
    expect(script).toContain('/api/web/channels/actions');
    expect(script).toContain('/api/web/channels/install');
    expect(script).toContain('/api/web/channels/setup-assistant');
    expect(script).toContain('/api/web/channels/setup-assistant/apply');
    expect(script).toContain('/api/web/channels/setup-assistant/doctor');
    expect(script).toContain('/api/web/channels/doctor');
    expect(script).toContain('/activity');
    expect(script).toContain('/api/web/transports');
    expect(script).toContain('/api/web/transports/');
    expect(script).toContain('/api/web/workspace/extensions');
    expect(script).toContain('/api/web/plugins');
    expect(script).toContain('/api/web/plugins/actions');
    expect(script).toContain('/api/web/hooks');
    expect(script).toContain('/api/web/hooks/run');
    expect(script).toContain('/api/web/platform/sync');
    expect(script).toContain('nodes-open');
    expect(script).toContain('channels-open');
    expect(script).toContain('channel-action');
    expect(script).toContain('channel-assistant');
    expect(script).toContain('channel-assistant-apply');
    expect(script).toContain('channel-assistant-doctor');
    expect(script).toContain('channel-apply-mode');
    expect(script).toContain('channel-configure-mode');
    expect(script).toContain('channels-doctor');
    expect(script).toContain('extensions-open');
    expect(script).toContain('policy-custom');
    expect(script).toContain('plugin-action');
    expect(script).toContain('hook-dry-run');
    expect(script).toContain('platform-sync');
    expect(script).toContain('data-operational-action');
    expect(script).toContain('/api/web/session');
    expect(script).toContain('/api/web/gateway/sessions');
    expect(script).toContain('/api/web/tool-runs');
    expect(script).toContain('/api/web/learning');
    expect(script).toContain('/api/web/learning/actions');
    expect(script).toContain('/api/web/memory/procedures');
    expect(script).toContain('/api/web/memory/search');
    expect(script).toContain('/api/web/gateway/sessions/history');
    expect(script).toContain('/api/web/gateway/sessions/spawn');
    expect(script).toContain('/api/web/permissions/');
    expect(script).toContain('/api/web/tasks/');
    expect(script).toContain('#session-workspace-approvals-state');
    expect(script).toContain('#session-workspace-replay-state');
    expect(script).toContain('#session-workspace-tools-state');
    expect(script).toContain('data-session-tool-diff');
    expect(script).toContain("eventType === 'tool'");
    expect(script).toContain('data-session-replay-action');
    expect(script).toContain('card-focus');
    expect(script).toContain('manifest.surfaces');
    expect(script).toContain('priority-primary-copy');
    expect(script).toContain('priority-dev-action');
    expect(script).toContain('alt-dev-action');
    expect(script).toContain('/api/web/host/access-manifest');
    expect(script).toContain('/api/web/host/install-journey');
    expect(script).toContain('/api/web/host/official-remote-access');
  });

  it('serves runtime shell styles from the dedicated style builder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-assets-styles-'));
    tempDirs.push(root);
    const previousNodeEnv = process.env.NODE_ENV;
    const previousLegacyFlag = process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
    process.env.NODE_ENV = 'test';
    process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = '1';

    const service = new WebConsoleAssetService(root);
    const response = {
      writeHead: jest.fn(),
      end: jest.fn(),
    };
    const writeJson = jest.fn();

    expect(service.handleStaticRoute('/styles.css', response as any, writeJson)).toBe(true);
    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/css; charset=utf-8',
    });
    const styles = String(response.end.mock.calls[0][0] || '');
    expect(styles).toContain(':root');
    expect(styles).toContain('--accent: #0f6c5c');
    expect(styles).toContain('.runtime-handoff-shell');
    expect(styles).toContain('.system-overlord-action-form');
    expect(writeJson).not.toHaveBeenCalled();
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousLegacyFlag === undefined) {
      delete process.env.ZAVORTH_LEGACY_SURFACES_ENABLED;
    } else {
      process.env.ZAVORTH_LEGACY_SURFACES_ENABLED = previousLegacyFlag;
    }
  });

  it('keeps file preview inside the workspace and truncates oversized text files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-preview-'));
    tempDirs.push(root);
    const service = new WebConsoleAssetService(root);
    const insideFile = path.join(root, 'notes.md');
    fs.writeFileSync(insideFile, 'a'.repeat(6500));

    const preview = service.readPreviewFile('notes.md');
    expect(preview.path).toBe('notes.md');
    expect(preview.content).toHaveLength(6000);
    expect(preview.truncated).toBe(true);

    const outsideFile = path.join(os.tmpdir(), `zavorth-web-preview-outside-${Date.now()}.md`);
    fs.writeFileSync(outsideFile, 'blocked');
    try {
      expect(() => service.readPreviewFile(outsideFile)).toThrow('Esse arquivo esta fora do workspace do Zavorth.');
    } finally {
      if (fs.existsSync(outsideFile)) {
        fs.rmSync(outsideFile, { force: true });
      }
    }
  });
});
