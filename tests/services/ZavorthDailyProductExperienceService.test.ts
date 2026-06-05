import { DASHBOARD_SETUP_CHECKLIST_VERSION, type DashboardSetupChecklistSnapshot } from '../../src/contracts/DashboardSetupChecklistContract.js';
import { ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION, type ZavorthDailyCapabilityFlowSnapshot } from '../../src/contracts/ZavorthDailyCapabilityFlowContract.js';
import { ZavorthDailyProductExperienceService } from '../../src/services/ZavorthDailyProductExperienceService.js';

describe('ZavorthDailyProductExperienceService', () => {
  const now = () => new Date('2026-06-04T12:00:00.000Z');

  function setupSnapshot(overrides: Partial<DashboardSetupChecklistSnapshot> = {}): DashboardSetupChecklistSnapshot {
    const items: DashboardSetupChecklistSnapshot['items'] = [
      {
        id: 'connect-provider',
        label: 'Test provider',
        area: 'provider',
        status: 'next',
        summary: 'Probe one provider and show fallback state.',
        nextAction: 'Run provider playbook.',
        command: 'npm run zavorth:provider-connection-playbook --silent',
        href: '/control/providers?setup=provider',
        proof: 'Provider proof is required before default route.',
      },
      {
        id: 'connect-telegram',
        label: 'Connect channel',
        area: 'channel',
        status: 'needs-setup',
        summary: 'Connect Telegram or keep another route as outbox.',
        nextAction: 'Open channel setup.',
        command: 'npm run zavorth:channel-connection-playbook --silent',
        href: '/control/providers?setup=channel',
        proof: 'Outbox routes cannot be default live routes.',
      },
      {
        id: 'configure-executor',
        label: 'Configure execution',
        area: 'execution-backend',
        status: 'needs-setup',
        summary: 'Keep live mutation as dry-run until a strong smoke passes.',
        nextAction: 'Run execution backend playbook.',
        command: 'npm run zavorth:execution-backend-playbook --silent',
        href: '/control/providers?setup=execution',
        proof: 'Dry-run is safe when strong sandbox proof is missing.',
      },
      {
        id: 'review-memory',
        label: 'Review memory',
        area: 'memory',
        status: 'next',
        summary: 'Show learned memory with evidence, confidence and expiry.',
        nextAction: 'Open learned memory.',
        command: 'npm run zavorth:memory-learning-loop:check --silent',
        href: '/control/memory?view=learned',
        proof: 'Memory remains editable and forgettable.',
      },
      {
        id: 'install-skills-governed',
        label: 'Review tools',
        area: 'skill',
        status: 'next',
        summary: 'Draft, scan, smoke and approve tools before active use.',
        nextAction: 'Open tools catalog.',
        command: 'npm run zavorth:skill-curator-live-loop:check --silent',
        href: '/control/skills?view=lifecycle',
        proof: 'Executable behavior does not appear without review.',
      },
      {
        id: 'schedule-with-preview',
        label: 'Schedule routine',
        area: 'scheduler',
        status: 'next',
        summary: 'Show final prompt and scope before a routine runs.',
        nextAction: 'Open scheduler preview.',
        command: 'node scripts/zavorth-governed-scheduled-tasks-check.mjs',
        href: '/control/tasks?view=scheduler',
        proof: 'Scheduled work cannot silently expand scope.',
      },
      {
        id: 'run-quality-evals',
        label: 'Run evals',
        area: 'quality',
        status: 'next',
        summary: 'Check quality, leaks, tool-use and approval fatigue.',
        nextAction: 'Run quality evals.',
        command: 'npm run zavorth:operational-rollout-eval:check --silent',
        href: '/control/docs?view=quality',
        proof: 'Regression checks are projection-only.',
      },
    ];

    return {
      generatedAt: now().toISOString(),
      version: DASHBOARD_SETUP_CHECKLIST_VERSION,
      status: 'needs-setup',
      headline: 'Finish setup.',
      items,
      summary: {
        total: items.length,
        done: 0,
        next: 5,
        needsSetup: 2,
        blocked: 0,
      },
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        liveActionsRemainApprovalBound: true,
      },
      ...overrides,
    };
  }

  function capabilitySnapshot(overrides: Partial<ZavorthDailyCapabilityFlowSnapshot> = {}): ZavorthDailyCapabilityFlowSnapshot {
    return {
      generatedAt: now().toISOString(),
      version: ZAVORTH_DAILY_CAPABILITY_FLOW_VERSION,
      status: 'attention',
      headline: 'Ready with review.',
      selfImprovement: {
        title: 'Melhorar comportamento',
        status: 'attention',
        promptStatus: 'needs-review',
        bestCandidateId: 'candidate-1',
        requiresApprovalForPromotion: true,
        noAutoApply: true,
        rollbackAvailable: true,
        stages: [],
      },
      runtimeSetup: {
        title: 'Rodar leve',
        target: 'safe-8gb-desktop',
        selectedProfile: 'safe-8gb',
        fallbackProfile: 'chat',
        alwaysOnReady: false,
        wizardSteps: [],
      },
      mcpCatalog: {
        title: 'Adicionar ferramenta',
        status: 'attention',
        scanned: 1,
        blocked: 0,
        needsReview: 1,
        executableToolsExposed: 0,
        items: [],
      },
      continuousEvals: {
        title: 'Rodar avaliacoes',
        status: 'attention',
        commands: ['npm run security:secrets --silent'],
        summary: '6 scenarios, 0 failures, 1 warning.',
      },
      dashboardProjection: {
        route: '/control',
        renderMode: 'daily-capability-flow',
        cards: [],
        safety: {
          projectionOnly: true,
          rawSecretsSerialized: false,
          liveActionsRemainApprovalBound: true,
        },
      },
      nextBestActions: ['Review one candidate.'],
      safety: {
        projectionOnly: true,
        noLiveActionExecuted: true,
        rawSecretsSerialized: false,
        approvalRequiredForBehaviorChange: true,
        runtimeProfileDoesNotGrantAuthority: true,
        externalToolsHeldForReviewBeforeExposure: true,
        continuousEvalDoesNotPersistByDefault: true,
      },
      ...overrides,
    };
  }

  it('projects first-run setup, daily loop, review center and quality gates without live authority', async () => {
    const service = new ZavorthDailyProductExperienceService({
      now,
      setupChecklist: { buildSnapshot: () => setupSnapshot() },
      capabilityFlow: { buildSnapshot: async () => capabilitySnapshot() },
    });

    const snapshot = await service.buildSnapshot({
      profile: 'creator',
      basePrompt: 'Prefer short summaries. token=secret-token sk-test-123',
    });

    expect(snapshot.version).toBe('daily-product-experience/v1');
    expect(snapshot.status).toBe('needs-setup');
    expect(snapshot.selectedProfile.profileId).toBe('creator');
    expect(snapshot.firstRun.steps.map((step) => step.id)).toEqual([
      'choose-profile',
      'test-provider',
      'connect-channel',
      'configure-runtime',
      'review-memory',
      'review-tools',
      'schedule-routine',
      'run-evals',
    ]);
    expect(snapshot.dailyLoop.steps.map((step) => step.id)).toEqual([
      'ask',
      'understand',
      'choose-route',
      'work',
      'deliver',
      'receipt',
      'review',
    ]);
    expect(snapshot.dailyLoop.steps.find((step) => step.id === 'work')?.approvalAppearsFor).toEqual(expect.arrayContaining([
      'shell execution',
      'external send',
      'sensitive learned memory',
    ]));
    expect(snapshot.reviewCenter.items.map((item) => item.id)).toEqual([
      'learned-memory',
      'skill-lifecycle',
      'channel-readiness',
      'backend-readiness',
      'quality-evals',
      'receipts',
    ]);
    expect(snapshot.dashboardProjection.cards.map((card) => card.id)).toEqual([
      'daily-start',
      'setup-guide',
      'daily-loop',
      'review-center',
      'quality-gates',
    ]);
    expect(snapshot.dashboardProjection.cards.every((card) => card.executionAuthority === false)).toBe(true);
    expect(snapshot.dashboardProjection.cards.every((card) => card.mutatesState === false)).toBe(true);
    expect(snapshot.safety).toEqual({
      projectionOnly: true,
      noLiveActionExecuted: true,
      rawSecretsSerialized: false,
      setupDoesNotGrantAuthority: true,
      liveActionsRemainApprovalBound: true,
      memoryChangesRemainReviewable: true,
      externalToolsRemainPreviewUntilApproved: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain('secret-token');
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-123');
  });

  it('maps blocked, attention and ready states from setup and capability sources', async () => {
    const blocked = await new ZavorthDailyProductExperienceService({
      now,
      setupChecklist: { buildSnapshot: () => setupSnapshot({ summary: { total: 1, done: 0, next: 0, needsSetup: 0, blocked: 1 } }) },
      capabilityFlow: { buildSnapshot: async () => capabilitySnapshot() },
    }).buildSnapshot();

    const attention = await new ZavorthDailyProductExperienceService({
      now,
      setupChecklist: { buildSnapshot: () => setupSnapshot({ status: 'attention', summary: { total: 1, done: 0, next: 1, needsSetup: 0, blocked: 0 } }) },
      capabilityFlow: { buildSnapshot: async () => capabilitySnapshot({ status: 'attention' }) },
    }).buildSnapshot();

    const ready = await new ZavorthDailyProductExperienceService({
      now,
      setupChecklist: { buildSnapshot: () => setupSnapshot({ status: 'ready', summary: { total: 1, done: 1, next: 0, needsSetup: 0, blocked: 0 } }) },
      capabilityFlow: { buildSnapshot: async () => capabilitySnapshot({ status: 'ready', continuousEvals: { title: 'Rodar avaliacoes', status: 'ready', commands: [], summary: 'All checks passed.' } }) },
    }).buildSnapshot();

    expect(blocked.status).toBe('blocked');
    expect(attention.status).toBe('attention');
    expect(ready.status).toBe('ready');
  });

  it('renders simple product language instead of heavy internal terms', async () => {
    const service = new ZavorthDailyProductExperienceService({
      now,
      setupChecklist: { buildSnapshot: () => setupSnapshot() },
      capabilityFlow: { buildSnapshot: async () => capabilitySnapshot() },
    });
    const text = service.renderText(await service.buildSnapshot({ profile: 'personal' }));

    expect(text).toContain('Start guided');
    expect(text).toContain('Daily loop');
    expect(text).toContain('Review center');
    expect(text).not.toMatch(/transaction plane|policy broker|ledger|quarantine/i);
  });
});
