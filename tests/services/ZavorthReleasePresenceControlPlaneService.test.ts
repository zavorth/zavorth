import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthReleasePresenceControlPlaneService } from '../../src/services/ZavorthReleasePresenceControlPlaneService';

type Fixture = {
  root: string;
  historyFile: string;
  cleanup: () => void;
};

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-release-presence-'));
  writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'zavorth-test', version: '1.2.3' }, null, 2));
  writeFile(path.join(root, 'archives', 'a', 'docs', 'index.html'), 'docs-a');
  writeFile(path.join(root, 'archives', 'a', 'remote-console', 'index.html'), 'console-a');
  writeFile(path.join(root, 'archives', 'b', 'docs', 'index.html'), 'docs-b');
  writeFile(path.join(root, 'archives', 'b', 'docs', 'new.html'), 'new-doc');
  writeFile(path.join(root, 'archives', 'b', 'remote-console', 'index.html'), 'console-b');
  const historyFile = path.join(root, 'data', 'runtime', 'publish-history.json');
  writeFile(historyFile, JSON.stringify([
    {
      publishedAt: '2026-04-24T16:30:00.000Z',
      branch: 'main',
      commit: 'bbbbbbbb22222222',
      archive: {
        id: 'b',
        targets: {
          docs: 'archives/b/docs',
          remoteConsole: 'archives/b/remote-console',
        },
      },
      targets: {
        docs: { productionUrl: 'https://docs.example.com' },
        remoteConsole: { productionUrl: 'https://console.example.com' },
      },
    },
    {
      publishedAt: '2026-04-24T15:30:00.000Z',
      branch: 'main',
      commit: 'aaaaaaaa11111111',
      archive: {
        id: 'a',
        targets: {
          docs: 'archives/a/docs',
          remoteConsole: 'archives/a/remote-console',
        },
      },
      targets: {
        docs: { productionUrl: 'https://old-docs.example.com' },
        remoteConsole: { productionUrl: 'https://old-console.example.com' },
      },
    },
  ], null, 2));

  return {
    root,
    historyFile,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function createHealthSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    publish: {
      available: true,
      publishedAt: '2026-04-24T16:30:00.000Z',
      branch: 'main',
      commit: 'bbbbbbbb22222222',
      sourceArchiveId: 'b',
      docsUrl: 'https://docs.example.com',
      remoteConsoleUrl: 'https://console.example.com',
      smokeTest: 'passed',
      gitPush: 'passed',
    },
    remoteTransportDoctor: {
      status: 'passed',
      summary: 'Transportes remotos degradam bem quando dormentes.',
    },
    ...overrides,
  };
}

function createRemoteTransportSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-04-24T16:35:00.000Z',
    summary: {
      total: 2,
      ready: 1,
      partial: 1,
      planned: 0,
      disabled: 0,
      live: 1,
      reachable: 1,
      attentionRequired: 1,
      pendingWork: 1,
    },
    entries: [
      {
        id: 'node-host',
        label: 'Node host',
        kind: 'node-host',
        transport: 'node-mesh',
        direction: 'bidirectional',
        readiness: 'ready',
        available: true,
        endpoint: 'local',
        operatorSummary: 'Node host pronto.',
        actionHint: null,
        telemetry: { updatedAt: null, pendingWork: 0, lastError: null, statusLine: 'ready' },
        details: [],
        actions: [],
      },
      {
        id: 'discord-transport',
        label: 'Discord transport',
        kind: 'bridge',
        transport: 'discord',
        direction: 'bidirectional',
        readiness: 'partial',
        available: false,
        endpoint: null,
        operatorSummary: 'Bridge dormente.',
        actionHint: null,
        telemetry: { updatedAt: null, pendingWork: 1, lastError: null, statusLine: 'partial' },
        details: [],
        actions: [],
      },
    ],
    selected: null,
    suggestedActions: [],
    narrative: {
      headline: 'Remote transport pronto em modo degradavel.',
      operatorSummary: '1 pronto e 1 parcial.',
    },
    ...overrides,
  };
}

function createTelemetrySnapshot(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-04-24T16:40:00.000Z',
    file: 'telemetry.jsonl',
    windowHours: 168,
    available: true,
    status: 'active',
    totalEvents: 5,
    traceCount: 2,
    failureEvents: 1,
    blockedEvents: 1,
    lastEventAt: '2026-04-24T16:39:00.000Z',
    topSources: [],
    topEventTypes: [],
    traces: [
      {
        traceId: 'task-1',
        source: 'cli',
        status: 'failed',
        eventCount: 3,
        failureCount: 1,
        lastEventType: 'task.failed',
        startedAt: '2026-04-24T16:10:00.000Z',
        lastSeenAt: '2026-04-24T16:12:00.000Z',
      },
      {
        traceId: 'task-2',
        source: 'cli',
        status: 'completed',
        eventCount: 2,
        failureCount: 0,
        lastEventType: 'task.completed',
        startedAt: '2026-04-24T16:20:00.000Z',
        lastSeenAt: '2026-04-24T16:22:00.000Z',
      },
    ],
    sinks: {
      localJsonl: true,
      langfuseConfigured: false,
      otelExporterConfigured: false,
      otelReady: false,
      externalRequired: false,
    },
    retention: {
      windowHours: 168,
      maxEvents: 5000,
      maxTraces: 8,
      maxTopEntries: 5,
      scannedEvents: 5,
      retainedEvents: 5,
      truncated: false,
    },
    redaction: {
      mode: 'hashed-references',
      traceIdsHashed: true,
      payloadsIncluded: false,
      notes: [],
    },
    recommendation: null,
    ...overrides,
  };
}

function createService(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return new ZavorthReleasePresenceControlPlaneService({
    now: () => new Date('2026-04-24T16:45:00.000Z'),
    projectRoot: fixture.root,
    packageJsonPath: path.join(fixture.root, 'package.json'),
    publishHistoryFile: fixture.historyFile,
    operationsHealthService: {
      readSnapshotFast: jest.fn(() => createHealthSnapshot() as any),
      readSnapshotLive: jest.fn(() => createHealthSnapshot({ live: true }) as any),
    },
    remoteTransportService: {
      buildSnapshot: jest.fn(() => createRemoteTransportSnapshot() as any),
    },
    telemetryLedgerService: {
      buildSnapshot: jest.fn(() => createTelemetrySnapshot() as any),
    },
    ...overrides,
  });
}

describe('ZavorthReleasePresenceControlPlaneService', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('builds release status with channel, risk, rollback and contracts', async () => {
    const service = createService(fixture);

    const snapshot = await service.buildStatus();

    expect(snapshot.phase).toBe('31');
    expect(snapshot.surface).toBe('release-presence-control-plane');
    expect(snapshot.mode).toBe('status');
    expect(snapshot.release.version).toBe('1.2.3');
    expect(snapshot.release.channel).toBe('stable');
    expect(snapshot.release.risk.level).toBe('medium');
    expect(snapshot.rollback.previewOnly).toBe(true);
    expect(snapshot.rollback.confirmationRequired).toBe(true);
    expect(snapshot.contracts.remoteNeverRequiresLooseCredentialFirstLayer).toBe(true);
    expect(snapshot.contracts.publishRegistersVersionDiffRiskRollback).toBe(true);
  });

  it('compares previous and latest snapshots from publish history', async () => {
    const service = createService(fixture);

    const snapshot = await service.buildDiff({ from: 'previous', to: 'latest' });

    expect(snapshot.mode).toBe('diff');
    expect(snapshot.diff.available).toBe(true);
    expect(snapshot.diff.report?.overall.added).toBe(1);
    expect(snapshot.diff.report?.overall.changed).toBe(2);
    expect(snapshot.diff.summary).toContain('a (aaaaaaaa)');
    expect(snapshot.diff.summary).toContain('b (bbbbbbbb)');
  });

  it('keeps rollback preview read-only with preflight and evidence', async () => {
    const service = createService(fixture);

    const snapshot = await service.buildRollbackPreview({ targetId: 'a' });

    expect(snapshot.mode).toBe('rollback-preview');
    expect(snapshot.rollback.targetId).toBe('a');
    expect(snapshot.rollback.executed).toBe(false);
    expect(snapshot.rollback.preflight.checks.length).toBeGreaterThan(0);
    expect(snapshot.rollback.evidence).toEqual(expect.arrayContaining([
      expect.stringContaining('commit=aaaaaaaa'),
    ]));
    expect(snapshot.contracts.rollbackPreviewDoesNotExecute).toBe(true);
  });

  it('reports remote presence without loose credentials and degrades offline', async () => {
    const service = createService(fixture, {
      remoteTransportService: {
        buildSnapshot: jest.fn(() => createRemoteTransportSnapshot({
          summary: {
            total: 0,
            ready: 0,
            partial: 0,
            planned: 0,
            disabled: 0,
            live: 0,
            reachable: 0,
            attentionRequired: 0,
            pendingWork: 0,
          },
          entries: [],
          narrative: {
            headline: 'Sem transporte remoto.',
            operatorSummary: 'Remote presence offline por ambiente local.',
          },
        }) as any),
      },
    });

    const snapshot = await service.buildRemotePresence();

    expect(snapshot.mode).toBe('presence');
    expect(snapshot.remotePresence.status).toBe('offline');
    expect(snapshot.remotePresence.credentials.looseCredentialRequired).toBe(false);
    expect(snapshot.contracts.remotePresenceDegradesWhenOffline).toBe(true);
  });

  it('exposes cost and attempt panel from telemetry without raw token accounting', async () => {
    const service = createService(fixture);

    const snapshot = await service.buildStatus();

    expect(snapshot.costPanel.available).toBe(true);
    expect(snapshot.costPanel.estimatedAttempts).toBe(5);
    expect(snapshot.costPanel.failures).toBe(1);
    expect(snapshot.costPanel.blocked).toBe(1);
    expect(snapshot.costPanel.tokenAccounting.available).toBe(false);
    expect(snapshot.costPanel.taskCosts[0]).toEqual(expect.objectContaining({
      taskRef: 'task-1',
      attempts: 3,
      failures: 1,
    }));
  });
});
