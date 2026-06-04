import { ZavorthCapabilityUsageDocsService } from '../../src/services/ZavorthCapabilityUsageDocsService.js';

describe('ZavorthCapabilityUsageDocsService', () => {
  test('renders public usage documentation from verified capability actions', () => {
    const service = new ZavorthCapabilityUsageDocsService({
      now: () => new Date('2026-06-02T12:00:00.000Z'),
      docPath: 'C:/workspace/docs/capabilities.md',
      actionSurface: {
        buildSnapshot: () => ({
          generatedAt: '2026-06-02T12:00:00.000Z',
          surface: 'capability-action-surface',
          status: 'ready',
          summary: {
            exposed: 1,
            blocked: 0,
            receipts: 1,
            visibleSurfaces: 3,
          },
          items: [
            {
              id: 'capability-action-exposure:research-pack',
              actionId: 'capability.candidate.research-pack',
              title: 'Research pack',
              status: 'available',
              verificationId: 'verification:research-pack',
              detail: 'Verified adapter available through the Action Harness.',
              previewCommand: 'zavorth actions preview capability.candidate.research-pack',
              receiptsCommand: 'zavorth actions receipts --action capability.candidate.research-pack',
              nextSafeAction: 'Preview the capability before approval.',
            },
          ],
          receipts: [],
          placement: {
            dashboard: {
              visible: true,
              sectionId: 'operations-capabilities',
              apiPath: '/api/operations/capabilities',
            },
            tui: {
              visible: true,
              panelTitle: 'Capability actions',
            },
            setup: {
              visible: true,
              sectionTitle: 'Capability actions',
            },
          },
          commands: {
            status: 'npm run zavorth:capability-action-surface --silent -- --list',
            preview: 'zavorth actions preview <action-id>',
            receipts: 'zavorth actions receipts --action <action-id>',
            nextStage: 'Publish public usage documentation.',
          },
          safety: {
            readOnlyProjection: true,
            verifiedAdaptersOnly: true,
            previewRequired: true,
            approvalRequired: true,
            noToolExecution: true,
            noLiveActivation: true,
            secretsRedacted: true,
          },
        } as any),
      },
    });

    const snapshot = service.buildSnapshot();
    const markdown = service.renderMarkdown(snapshot);

    expect(snapshot.surface).toBe('capability-usage-docs');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary).toMatchObject({
      exposed: 1,
      receipts: 1,
      publicSections: 9,
    });
    expect(snapshot.safety).toMatchObject({
      publicDocsOnly: true,
      noSecrets: true,
      noInternalMilestoneLanguage: true,
      noLiveActivationByReadingDocs: true,
    });
    expect(markdown).toContain('# Zavorth Capabilities');
    expect(markdown).toContain('## How To Use One');
    expect(markdown).toContain('## Local Usage Signals');
    expect(markdown).toContain('## Lifecycle Decisions');
    expect(markdown).toContain('Research pack');
    expect(markdown).toContain('zavorth actions preview capability.candidate.research-pack');
    expect(markdown).not.toMatch(/\b(private audit|comparison report|internal report|maintenance report)\b/iu);
  });

  test('renders an honest empty public state without claiming live capabilities', () => {
    const service = new ZavorthCapabilityUsageDocsService({
      actionSurface: {
        buildSnapshot: () => ({
          generatedAt: '2026-06-02T12:00:00.000Z',
          surface: 'capability-action-surface',
          status: 'available',
          summary: {
            exposed: 0,
            blocked: 0,
            receipts: 0,
            visibleSurfaces: 3,
          },
          items: [],
          receipts: [],
          placement: {
            dashboard: {
              visible: true,
              sectionId: 'operations-capabilities',
              apiPath: '/api/operations/capabilities',
            },
            tui: {
              visible: true,
              panelTitle: 'Capability actions',
            },
            setup: {
              visible: true,
              sectionTitle: 'Capability actions',
            },
          },
          commands: {
            status: 'npm run zavorth:capability-action-surface --silent -- --list',
            preview: 'zavorth actions preview <action-id>',
            receipts: 'zavorth actions receipts --action <action-id>',
            nextStage: 'Publish public usage documentation.',
          },
          safety: {
            readOnlyProjection: true,
            verifiedAdaptersOnly: true,
            previewRequired: true,
            approvalRequired: true,
            noToolExecution: true,
            noLiveActivation: true,
            secretsRedacted: true,
          },
        } as any),
      },
    });

    const markdown = service.renderMarkdown();

    expect(markdown).toContain('No verified capability action is exposed yet.');
    expect(markdown).toContain('A visible capability is not automatic permission.');
  });
});
