import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();

describe('ZavorthControlBrowserPreview', () => {
  it('keeps a local browser preview script wired to official ZavorthControl fixtures', () => {
    const script = readFileSync(
      join(rootDir, 'scripts/zavorthControl-browser-preview.ts'),
      'utf8',
    );

    expect(script).toContain('buildZavorthControlZavorthControlFixturePreviewViewModel');
    expect(script).toContain('listZavorthControlZavorthControlFixturePreviewOptions');
    expect(script).toContain('ZavorthControlZavorthControlViewModel');
    expect(script).toContain('bcc-mission-brief');
    expect(script).toContain('bcc-overview-stack');
    expect(script).toContain('renderRemoteMeshPanel');
    expect(script).toContain('Aplicar no MCP');
    expect(script).toContain('bcc-compose__input-frame');
    expect(script).toContain('bcc-active-run-state');
    expect(script).toContain('renderOnboardingPanel');
    expect(script).toContain('bcc-onboarding-step');
    expect(script).toContain('renderApprovalsPanel');
    expect(script).toContain('bcc-approval-summary');
    expect(script).toContain('LIVE_FIXTURE_ID');
    expect(script).toContain('/api/web/zavorthControl');
    expect(script).toContain('buildLiveViewModelFromSnapshot');
    expect(script).toContain('zavorthControl-auth-form');
    expect(script).toContain('/api/auth/validate');
    expect(script).toContain('sessionStorage');
  });

  it('exposes the browser preview through package scripts and ZavorthControl QA', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['zavorthControl:preview']).toContain('scripts/zavorthControl-browser-preview.ts');
    expect(packageJson.scripts['qa:zavorthControl-browser-preview']).toContain('ZavorthControlBrowserPreview.test.ts');
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-browser-preview');
  });

  it('keeps fixture previews as internal QA instead of public docs', () => {
    const docsIndex = readFileSync(join(rootDir, 'docs/README.md'), 'utf8');
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(docsIndex).toContain('Private audits, implementation scratchpads and temporary planning notes do not belong here.');
    expect(packageJson.scripts['zavorthControl:preview']).toContain('scripts/zavorthControl-browser-preview.ts');
    expect(packageJson.scripts['qa:zavorthControl-browser-preview']).toContain('--fixture=all');
  });

  it('exposes the generated fixture review inside the real zavorthControl routes', () => {
    const assetService = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-console/WebConsoleAssetService.ts'),
      'utf8',
    );
    const zavorthControlRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceHelpers.ts'),
      'utf8',
    );
    const runtimeShell = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-console/web-console-runtime-shell-html/part1.ts'),
      'utf8',
    );
    const stateRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts'),
      'utf8',
    );
    const interactionRoutes = readFileSync(
      join(rootDir, 'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts'),
      'utf8',
    );
    const webAppService = readFileSync(
      join(rootDir, 'src/services/WebAppService.ts'),
      'utf8',
    );

    expect(assetService).toContain('/control/review');
    expect(assetService).toContain('zavorthControl-browser-preview');
    expect(assetService).toContain('ZAVORTH_ZAVORTH_CONTROL_REVIEW_ENABLED');
    expect(assetService).toContain('ZAVORTH_ZAVORTH_CONTROL_REVIEW_HTML');
    expect(assetService).toContain('npm run zavorthControl:preview');
    expect(assetService).toContain('shouldServeZavorthControlReviewRoute');
    expect(assetService).toContain('isDevelopmentOrTestRuntime');
    expect(assetService).toContain('readZavorthControlShellHtml');
    expect(assetService).toContain("'assets', 'zavorthControl'");
    expect(assetService).toContain('readZavorthControlAsset');
    expect(zavorthControlRoutes).toContain("pathname === '/control/review'");
    expect(zavorthControlRoutes).toContain('isRetiredControlSurfacePath');
    expect(zavorthControlRoutes).toContain("pathname.startsWith('/styles/')");
    expect(zavorthControlRoutes).toContain("pathname.startsWith('/scripts/')");
    expect(runtimeShell).not.toContain('open-zavorthControl-review');
    expect(runtimeShell).not.toContain('/control/review?fixture=safe-run');
    expect(stateRoutes).toContain('/api/web/zavorthControl');
    expect(stateRoutes).toContain('deps.agentGateway?.buildSnapshot');
    expect(stateRoutes).toContain('modelProfile: this.buildCurrentModelProfile(zavorthControlSnapshot)');
    expect(stateRoutes).toContain('resolveConfiguredModel');
    expect(stateRoutes).toContain('config.llmProvider');
    expect(interactionRoutes).toContain('/api/web/agent-runs/approve');
    expect(interactionRoutes).toContain('/api/web/agent-runs/reject');
    expect(interactionRoutes).toContain('deps.agentGateway.approve');
    expect(interactionRoutes).toContain('deps.agentGateway.reject');
    expect(interactionRoutes).toContain('/api/web/artifacts');
    expect(interactionRoutes).toContain('/api/web/zavorthControl/events');
    expect(interactionRoutes).toContain('persistent-session-history');
    expect(interactionRoutes).toContain('buildZavorthControlEvents');
    expect(interactionRoutes).toContain('/api/web/file-asset');
    expect(interactionRoutes).toContain('readPreviewAsset');
    expect(assetService).toContain('readPreviewAsset');
    expect(webAppService).toContain('buildPublicZavorthControlFallbackSnapshot');
    expect(webAppService).toContain('Autenticacao necessaria para ler runs reais');
    expect(webAppService).toContain('zavorthControl_token_mismatch');
    expect(webAppService).toContain('zavorth zavorthControl repair');
    expect(webAppService).toContain('zavorth zavorthControl generate-token');
  });

  it('keeps the user-provided ZavorthControl visual as the main /zavorthControl shell and bridges data non-invasively', () => {
    const shell = readFileSync(
      join(rootDir, 'assets/zavorthControl/index.html'),
      'utf8',
    );
    const appScript = readFileSync(
      join(rootDir, 'assets/zavorthControl/scripts/app.js'),
      'utf8',
    );
    const runtimeBridge = readFileSync(
      join(rootDir, 'assets/zavorthControl/scripts/runtime-bridge.js'),
      'utf8',
    );
    const pagesScript = readFileSync(
      join(rootDir, 'assets/zavorthControl/scripts/pages.js'),
      'utf8',
    );
    const layoutCss = readFileSync(
      join(rootDir, 'assets/zavorthControl/styles/layout.css'),
      'utf8',
    );

    expect(shell).toContain('core-frame');
    expect(shell).toContain('terminal-hero');
    expect(shell).toContain('scripts/runtime-bridge.js');
    expect(runtimeBridge).toContain('/api/auth/status');
    expect(runtimeBridge).toContain('/api/web/zavorthControl');
    expect(runtimeBridge).toContain('ZavorthRuntimeBridge');
    expect(runtimeBridge).toContain('Non-invasive data bridge');
    expect(runtimeBridge).toContain('updatePremiumMetric');
    expect(runtimeBridge).toContain('updatePremiumStatus');
    expect(runtimeBridge).toContain('channelReadinessLabel');
    expect(runtimeBridge).toContain('platform-action-list');
    expect(runtimeBridge).not.toContain('document.body.innerHTML');
    expect(appScript).toContain('runtimeBridge.sendChat');
    expect(appScript).toContain('compose-attachments');
    expect(appScript).toContain('pendingSelectedSkills');
    expect(appScript).toContain('lastVoiceInput');
    expect(appScript).toContain('addAttachmentFiles');
    expect(appScript).toContain('compose-skill-popover');
    expect(appScript).toContain('buildSkillOptions');
    expect(appScript).toContain('SpeechRecognition');
    expect(appScript).toContain('is-listening');
    expect(appScript).toContain('voice-listening-overlay');
    expect(appScript).toContain('getCurrentModelLabel');
    expect(appScript).not.toContain('gemini-3-flash');
    expect(appScript).not.toContain('$0.002');
    expect(appScript).toContain('ZavorthControlChat');
    expect(appScript).toContain('renderTranscript');
    expect(appScript).toContain('renderApprovals');
    expect(appScript).toContain('normalizeTraceCapability');
    expect(appScript).toContain('renderTraceReceipt');
    expect(appScript).toContain('renderTraceReplay');
    expect(appScript).toContain('Raciocinio bruto do modelo permanece privado');
    expect(appScript).toContain('capabilityFromElement');
    expect(appScript).toContain('renderRemoteMeshApprovals');
    expect(appScript).toContain('data-zavorth-remote-mesh-action');
    expect(appScript).toContain('renderArtifacts');
    expect(appScript).toContain('isRelevantChatArtifact');
    expect(appScript).toContain('renderArtifacts(artifacts, context = {})');
    expect(appScript).toContain('openArtifactPane');
    expect(appScript).toContain('data-zavorth-approval-decision');
    expect(appScript).toContain('data-zavorth-artifact-id');
    expect(appScript).toContain('data-zavorth-trace-action="open"');
    expect(appScript).toContain('zavorth-artifact-card');
    expect(appScript).toContain('runtimeBridge.decideApproval');
    expect(runtimeBridge).toContain('/api/web/chat/send');
    expect(runtimeBridge).toContain('composerPayload = {}');
    expect(runtimeBridge).toContain('selectedSkills');
    expect(runtimeBridge).toContain('attachments');
    expect(runtimeBridge).toContain('voice');
    expect(runtimeBridge).toContain('/api/web/gateway/sessions/history');
    expect(runtimeBridge).toContain('/api/web/artifacts?sessionId=');
    expect(runtimeBridge).toContain('/api/web/file-preview?path=');
    expect(runtimeBridge).toContain('/api/web/file-asset?path=');
    expect(runtimeBridge).toContain('/api/web/permissions?sessionId=');
    expect(runtimeBridge).toContain('/api/web/agent-runs/${action}');
    expect(runtimeBridge).toContain('/api/web/permissions/${action');
    expect(runtimeBridge).toContain('/api/web/tasks/${action');
    expect(runtimeBridge).toContain('approvalId: id');
    expect(runtimeBridge).not.toContain('Approval de run universal ainda exige');
    expect(runtimeBridge).toContain('fetchCurrentArtifacts');
    expect(runtimeBridge).toContain('openArtifact');
    expect(runtimeBridge).toContain('renderArtifactsFromPayload');
    expect(runtimeBridge).toContain('shouldDisplayArtifactsInChat');
    expect(runtimeBridge).toContain('hasDirectExecutionArtifactContext');
    expect(runtimeBridge).toContain('extractResponseDecision');
    expect(runtimeBridge).toContain('artifactPolicyAllowsChatDisplay');
    expect(runtimeBridge).toContain("display: true, reason: 'send-response'");
    expect(runtimeBridge).toContain("display: false, reason: 'state-sync'");
    expect(runtimeBridge).toContain('suppressTranscriptRender(5000)');
    expect(runtimeBridge).toContain('skipSessionHydrate');
    expect(runtimeBridge).not.toContain('Mensagem enviada');
    expect(runtimeBridge).toContain('readBlob');
    expect(runtimeBridge).toContain('updateRecentActivityTable');
    expect(runtimeBridge).toContain('deriveNextRunAction');
    expect(runtimeBridge).toContain('buildRunReplayHtml');
    expect(runtimeBridge).toContain('openRunDetails');
    expect(runtimeBridge).toContain('wireRunReplayRows');
    expect(runtimeBridge).toContain('data-zavorth-run-id');
    expect(runtimeBridge).toContain('bcc-trace-link');
    expect(runtimeBridge).toContain('data-zavorth-trace-action="open"');
    expect(runtimeBridge).toContain('/api/web/events?sessionId=');
    expect(runtimeBridge).toContain('/api/web/zavorthControl/events?${params.toString()}');
    expect(runtimeBridge).toContain('fetchZavorthControlEvents');
    expect(runtimeBridge).toContain('openPersistentTrace');
    expect(runtimeBridge).toContain("params.set('runId'");
    expect(runtimeBridge).toContain("params.set('traceId'");
    expect(runtimeBridge).toContain('ingestRuntimeEvents');
    expect(runtimeBridge).toContain('zavorthControlEventFromRealtimeEvent');
    expect(runtimeBridge).toContain('connectRealtime');
    expect(runtimeBridge).toContain('disconnectRealtime');
    expect(runtimeBridge).toContain('resolveCurrentModelProfile');
    expect(runtimeBridge).toContain('getCurrentModelLabel');
    expect(runtimeBridge).toContain('getAvailableSkills');
    expect(runtimeBridge).toContain('publishCurrentModelProfile');
    expect(runtimeBridge).toContain('.echo-meta__model');
    expect(runtimeBridge).toContain('#sector-agents .entity-card__meta .badge--muted');
    expect(runtimeBridge).toContain('updateChannels');
    expect(runtimeBridge).toContain('updateAgents');
    expect(runtimeBridge).toContain('updateSkills');
    expect(runtimeBridge).toContain('updateUsage');
    expect(runtimeBridge).toContain('updateCron');
    expect(runtimeBridge).toContain('updateNodes');
    expect(runtimeBridge).toContain('/api/web/runtime/companions');
    expect(runtimeBridge).toContain('/api/web/gateway/runtime');
    expect(runtimeBridge).toContain('startFetchEventStream');
    expect(runtimeBridge).toContain('consumeSseBuffer');
    expect(runtimeBridge).toContain('handleRealtimeEvent');
    expect(runtimeBridge).toContain('Core Ao Vivo');
    expect(runtimeBridge).toContain("Accept: 'text/event-stream'");
    expect(runtimeBridge).toContain('zavorth.zavorthControl.sessionId');
    expect(runtimeBridge).toContain('X-Zavorth-Token');
    expect(runtimeBridge).toContain("source: 'zavorthControl'");
    expect(runtimeBridge).toContain('The zavorthControl is protected.');
    expect(runtimeBridge).toContain('openUnlockModal');
    expect(runtimeBridge).toContain('hydrateCurrentSession');
    expect(runtimeBridge).toContain('fetchCurrentApprovals');
    expect(runtimeBridge).toContain('fetchZavorthControlEvents');
    expect(runtimeBridge).toContain('renderRemoteMeshApprovalsFromPayload');
    expect(runtimeBridge).toContain('applyRemoteMeshApproval');
    expect(runtimeBridge).toContain('/api/web/remote-mesh/notebook/mcp');
    expect(runtimeBridge).toContain('decideApproval');
    expect(runtimeBridge).toContain('extractApprovals');
    expect(runtimeBridge).toContain('extractTranscriptMessages');
    expect(runtimeBridge).toContain('/api/auth/validate');
    expect(runtimeBridge).toContain('zavorth-unlock-token');
    expect(runtimeBridge).toContain('Unlock live runtime');
    expect(runtimeBridge).toContain('hashParams.get');
    expect(runtimeBridge).toContain('zavorth zavorthControl');
    expect(runtimeBridge).toContain('zavorth zavorthControl token');
    expect(runtimeBridge).toContain('Open a new tab with');
    expect(runtimeBridge).toContain('error.recovery');
    expect(runtimeBridge).toContain('Core Unlocked');
    expect(runtimeBridge).toContain('openAccessStatusModal');
    expect(runtimeBridge).toContain('lockZavorthControlTab');
    expect(runtimeBridge).toContain('clearStoredToken');
    expect(runtimeBridge).toContain("pulse.dataset.authState");
    expect(runtimeBridge).toContain('Lock this tab');
    expect(runtimeBridge).toContain('Token saved in this tab');
    expect(runtimeBridge).toContain('sessionStorage.setItem(AUTH_STORAGE_KEY, token)');
    expect(runtimeBridge).toContain('sessionStorage.removeItem(AUTH_STORAGE_KEY)');
    expect(runtimeBridge).toContain("pulse.addEventListener('click'");
    expect(layoutCss).toContain('.bridge__pulse[data-auth-state="protected"]');
    expect(layoutCss).toContain('.bridge__pulse[data-auth-state="unlocked"]');
    expect(layoutCss).toContain('.bridge__pulse[data-auth-state="local"]');
    expect(layoutCss).toContain('var(--b-warn-subtle)');
    const chatCss = readFileSync(
      join(rootDir, 'assets/zavorthControl/styles/chat.css'),
      'utf8',
    );
    expect(chatCss).toContain('.compose-attachment-chip');
    expect(chatCss).toContain('.compose-skill-option');
    expect(chatCss).toContain('.compose-dock__btn.is-listening');
    expect(chatCss).toContain('.voice-overlay__wave');
    expect(appScript).toContain('ingestRuntimeEvents');
    expect(appScript).toContain('traceSheetQuery');
    expect(appScript).toContain('traceEventMatchesQuery');
    expect(appScript).toContain('traceEventIds');
    expect(appScript).toContain('runtime-history');
    expect(pagesScript).toContain('Static placeholders stay honest');
    expect(pagesScript).toContain('zavorthControl-glass');
    expect(pagesScript).toContain('Gateway');
    expect(pagesScript).toContain('data-zavorthControl-metric="runs"');
    expect(pagesScript).toContain('Waiting for a mission');
    expect(pagesScript).not.toContain('12,847');
    expect(pagesScript).not.toContain('3.2M');
    expect(pagesScript).not.toContain('$4.82');
    expect(pagesScript).not.toContain('RTX 4090');
    expect(pagesScript).not.toContain('A100');
    expect(pagesScript).not.toContain('1528652069');
    expect(pagesScript).not.toContain('code-writer');
    expect(pagesScript).not.toContain('memory-compaction');
  });
});
