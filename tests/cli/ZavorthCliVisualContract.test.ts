import * as fs from 'fs';
import { resolve } from 'node:path';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { ZavorthCli } from '../../src/cli/ZavorthCli';
import { formatCliChatWelcome } from '../../src/cli/ZavorthCliSurfaceHelpers';
import { formatCliStatusSnapshot } from '../../src/cli/ZavorthCliNativeRenderers.status';
import {
  formatCliOperationsDoctorSnapshot,
  formatOperationsCockpitSnapshot,
  formatOperatorBriefSnapshot,
} from '../../src/cli/ZavorthCliNativeRenderers.runtime';
import { formatCliOperationsCockpitSnapshot } from '../../src/cli/ZavorthCliOperationsCockpit';
import {
  formatZavorthOnboardBanner,
  formatZavorthOnboardNonInteractiveHint,
} from '../../src/cli/ZavorthCliOnboardRenderer';
import { config } from '../../src/config/index';

import { formatCliChatHelp } from '../../src/cli/ZavorthCliChatHelp';
import { formatCliChatAssistantMessage } from '../../src/cli/ZavorthCliChatRenderers';
import {
  formatCliApprovalRequiredEventCard,
  formatCliRecoverableErrorEventCard,
} from '../../src/cli/ZavorthCliEventCards';

import { formatZavorthGoFailure, formatZavorthGoReport } from '../../src/cli/ZavorthCliGoRenderer';

import type { RuntimeOfficialAccessReport } from '../../src/runtime/access/RuntimeOfficialAccessService';

const FORBIDDEN_FIRST_LAYER_PATTERNS = [
  /Zavorth Chat v/i,
  /v1\.0\.0/i,
  /\bvoce>\b/i,
  /\bzavorth>\b/i,
  /npm run ops:/i,
  /\bsidecars?\b/i,
  /\bcontrol plane\b/i,
  /\bsessionId\b/i,
  /\bchatId\b/i,
  /Error:\s*\n\s*at\s+/i,
  /\bat\s+.+\.(ts|js):\d+:\d+/i,
];

function expectNoFirstLayerNoise(output: string): void {
  for (const pattern of FORBIDDEN_FIRST_LAYER_PATTERNS) {
    expect(output).not.toMatch(pattern);
  }
}

function makeAccessReport(ready: boolean): RuntimeOfficialAccessReport {
  return {
    generatedAt: '2026-04-24T00:00:00.000Z',
    summary: ready ? 'Zavorth ready for local use.' : 'The official path still needs to prepare Zavorth.',
    tokenSource: 'env',
    journey: {} as any,
    manifest: {} as any,
    readiness: {} as any,
    local: {
      ready,
      appUrl: 'http://127.0.0.1:3000/zavorthControl',
      trust: {
        attempted: false,
        applied: ready,
        statusCode: null,
        error: null,
      },
    },
    remote: {
      configured: false,
      appUrl: null,
      appProbe: null,
      authProbe: null,
      issues: [],
      ready: false,
    },
    nextSteps: [],
  };
}

describe('Zavorth CLI visual anti-regression contract', () => {
  it('keeps setup dry-run and JSON setup safe, redacted and side-effect free', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-cli-'));
    const tsxCli = path.join(config.projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    try {
      const env = {
        ...process.env,
        ZAVORTH_HOME: tempRoot,
        ZAVORTH_FIRST_RUN_STORAGE_ROOT: tempRoot,
        NODE_ENV: 'test',
      };
      const dryRun = execFileSync(process.execPath, [tsxCli, 'scripts/setup-v3.ts', '--dry-run'], {
        cwd: config.projectRoot,
        encoding: 'utf8',
        env,
      });
      const jsonOutput = execFileSync(process.execPath, [tsxCli, 'scripts/setup-v3.ts', '--json', '--dry-run'], {
        cwd: config.projectRoot,
        encoding: 'utf8',
        env,
      });
      const parsed = JSON.parse(jsonOutput);
      const profilePath = path.join(tempRoot, 'data', 'runtime', 'first-run', 'profile.json');

      expect(dryRun).toContain('Preview only. No files will be changed.');
      expect(dryRun).toContain('First Light');
      expect(dryRun).toContain('Workspace');
      expect(dryRun).toContain('Plan');
      expect(dryRun).toContain('Readiness');
      expect(dryRun).toContain('secrets redacted');
      expect(parsed.dryRun).toBe(true);
      expect(parsed.safety.rawSecretSerialized).toBe(false);
      expect(parsed.safety.runtimePersistentStartPerformed).toBe(false);
      expect(fs.existsSync(profilePath)).toBe(false);
      expectNoFirstLayerNoise(`${dryRun}\n${jsonOutput}`);
    } finally {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  });

  it('keeps the chat welcome branded, model-aware and free from old prompt noise', () => {
    const output = formatCliChatWelcome();

    expect(output).toContain('Zavorth');
    expect(output).toContain('Zavorth');
    expect(output).toContain('natural chat');
    expect(output).toMatch(/[a-z0-9][a-z0-9._:/-]+ - natural chat/i);
    expect(output).not.toContain('Gemini - natural chat');
    expect(output).not.toContain('Zavorth Chat v');
    expect(output).not.toContain('v1.0.0');
    expect(output).toContain("Hi, I'm Zavorth.");
    expect(output).toContain('Write naturally');
    expect(output).toContain('... shortcuts: status | doctor | history | new | quit');
    expectNoFirstLayerNoise(output);
  });

  it('uses the compact product prompt inside chat instead of old raw prompts', async () => {
    const writes: string[] = [];
    const question = jest.fn<Promise<string>, [string]>().mockResolvedValueOnce('quit');
    const close = jest.fn();
    const historyFile = resolve(config.projectRoot, 'data', 'runtime', 'zavorth-cli-history.txt');
    const historyExists = fs.existsSync(historyFile);
    const previousHistory = historyExists ? fs.readFileSync(historyFile, 'utf8') : null;

    try {
      const cli = new ZavorthCli({
        writer: {
          line: (text: string) => writes.push(text),
          error: () => undefined,
        },
        readlineFactory: () =>
          ({
            history: [],
            question,
            close,
          }) as any,
      });

      const exitCode = await cli.runRepl({
        command: null,
        repl: true,
        json: false,
        live: false,
        userId: 'alice',
        platform: 'web',
        chatId: 'web:visual-contract',
        sessionId: 'visual-contract-session',
        workspaceHint: null,
        commandText: null,
      });

      const output = writes.join('\n');
      expect(exitCode).toBe(0);
      expect(question).toHaveBeenCalledWith('Zavorth › ');
      expect(output).toContain('Zavorth');
      expect(output).not.toContain('voce>');
      expect(output).not.toContain('zavorth>');
      expect(output).toContain('visual-contract-session');
      expect(output).not.toContain('web:visual-contract');
      expectNoFirstLayerNoise(output);
    } finally {
      if (previousHistory !== null) {
        fs.writeFileSync(historyFile, previousHistory, 'utf8');
      } else if (fs.existsSync(historyFile)) {
        fs.unlinkSync(historyFile);
      }
    }
  });

  it('keeps in-chat help short and contextual', () => {
    const output = formatCliChatHelp();

    expect(output).toContain('Shortcuts');
    expect(output).toContain('status');
    expect(output).toContain('check runtime readiness');
    expect(output).toContain('doctor');
    expect(output).toContain('diagnose setup or provider issues');
    expect(output).toContain('quit');
    expect(output).toContain('leave the terminal session');
    expect(output).not.toContain('Complete Zavorth CLI reference');
    expect(output).not.toContain('nodes invoke');
    expect(output).not.toContain('ops run');
    expectNoFirstLayerNoise(output);
  });

  it('renders assistant replies, approvals and errors as cards without raw shell prefixes', () => {
    const assistant = formatCliChatAssistantMessage({
      body: 'Hi. Let us solve this in small steps.',
    });
    const approval = formatCliApprovalRequiredEventCard({
      body: 'I need your confirmation before editing files.',
      command: 'approve task-123 pin=654321',
    });
    const recoverable = formatCliRecoverableErrorEventCard({
      body: 'I could not continue right now.',
      command: 'doctor',
    });
    const output = [assistant, approval, recoverable].join('\n\n');

    expect(output).toContain('Zavorth');
    expect(output).toContain('! Approval needed');
    expect(output).toContain('approve task-123 pin=654321');
    expect(output).toContain('! Recoverable issue');
    expect(output).toContain('doctor');
    expectNoFirstLayerNoise(output);
  });

  it('keeps onboarding as a product entry screen with mascot, steps and current model', () => {
    const banner = formatZavorthOnboardBanner({ currentModel: 'gemini-2.5-flash' });
    const hint = formatZavorthOnboardNonInteractiveHint();
    const output = `${banner}\n${hint}`;

    expect(output).toContain('Zavorth');
    expect(output).toContain("Let's prepare your local assistant");
    expect(output).toContain('1. Model');
    expect(output).toContain('2. Access');
    expect(output).toContain('3. Safety');
    expect(output).toContain('4. Person');
    expect(output).toContain('5. Ready');
    expect(output).toContain('Current model: gemini-2.5-flash');
    expect(output).toContain('zavorth setup');
    expect(output).toContain('zavorth go');
    expect(output).toContain('Home');
    expect(output).toMatch(/\/dashboard|\/zavorthControl/i);
    expect(output).toContain('npm run setup');
    expect(output).toContain('npm run go');
    expect(output).toContain('npm run doctor');
    expect(output).not.toContain('npm run ops:');
    expectNoFirstLayerNoise(output);
  });

  it('keeps go as a product doorway and does not tell users to run go inside go', () => {
    const ready = formatZavorthGoReport(makeAccessReport(true), {
      dryRun: false,
      appOpen: {
        skipped: false,
        opened: true,
        targetUrl: 'http://127.0.0.1:3000/zavorthControl',
      },
      launcher: {
        skipped: false,
        applied: true,
        mode: 'desktop',
        error: null,
      },
    });
    const blocked = formatZavorthGoReport(makeAccessReport(false), {
      dryRun: true,
    });
    const failure = formatZavorthGoFailure(new Error('short failure'));
    const output = `${ready}\n\n${blocked}\n\n${failure}`;

    expect(ready).toMatch(/Zavorth pronto|Zavorth ready|ready for local use/i);
    expect(ready).toContain('Home');
    expect(ready).toMatch(
      /Zavorth Dashboard: http:\/\/127\.0\.0\.1:3000\/(?:dashboard|zavorthControl)|ZavorthControl: http:\/\/127\.0\.0\.1:3000\/(?:dashboard|zavorthControl)|http:\/\/127\.0\.0\.1:3000\/(?:dashboard|zavorthControl)/i,
    );
    expect(ready).toContain('Inbox | Tasks | Approvals | Receipts | Connectors');
    expect(ready).toContain('Start from the terminal if you prefer');
    expect(ready).toContain('> zavorth chat');
    expect(ready).toContain('> zavorth receipts');
    expect(ready).toContain('> zavorth doctor');
    expect(ready).not.toContain('> zavorth go');
    expect(blocked).toContain('Adjustment required');
    expect(blocked).toContain('What happened:');
    expect(blocked).toContain('Likely cause:');
    expect(blocked).toContain('Next step:');
    expect(blocked).toContain('Try: zavorth doctor');
    expect(blocked).toContain('> zavorth status');
    expect(blocked).not.toContain('> zavorth go');
    expect(failure).toContain('Zavorth could not continue');
    expect(failure).toContain('What happened:');
    expect(failure).toContain('Likely cause:');
    expect(failure).toContain('Next step:');
    expect(failure).toContain('Try: zavorth doctor');
    expectNoFirstLayerNoise(output);
  });

  it('keeps status, doctor, brief and ops readable in the same visual language', () => {
    const status = formatCliStatusSnapshot({
      generatedAt: '2026-04-24T00:00:00.000Z',
      headline: 'Zavorth operational, but with some points needing attention.',
      nextAction: {
        label: 'Open main diagnostic',
        command: 'zavorth doctor',
        reason: 'Check details.',
      },
      brief: { posture: 'watch', headline: 'Zavorth under observation.' },
      cockpit: { status: 'attention', headline: 'Operation under observation.', topAlert: null },
      gateway: {
        channelsReady: 1,
        channelsTotal: 2,
        runtimeModesReady: 1,
        securityPosture: 'ok',
      },
      domains: { total: 4, initialized: 4, pending: 0 },
      platform: { plugins: 1, skills: 1, mcps: 1, collections: 0, recipes: 0, syncSummary: null },
      sessions: { total: 1, historyItems: 2, pendingPermissions: 0, sendReady: true, spawnReady: true },
      nodes: { total: 1, paired: 1, online: 1, queued: 0, staleQueued: 0 },
      transports: null,
    });
    const doctor = formatCliOperationsDoctorSnapshot({
      checkedAt: '2026-04-24T00:00:00.000Z',
      summary: 'Zavorth needs attention.',
      local: { ready: false, appUrl: null, issues: ['host supervisor not active'] },
      remote: { ready: false, appUrl: null, issues: [] },
      nodeMesh: {} as any,
      channelProviders: {
        status: 'passed',
        summary: 'Channels ok.',
        stale: false,
        command: 'cmd',
        validated: 1,
        total: 1,
      },
      remoteTransports: {
        status: 'pending',
        summary: 'Remote pending.',
        stale: false,
        command: 'cmd',
        healthy: 0,
        total: 0,
        recommendedAction: null,
      },
      sessions: null,
      nodeFleet: null,
      integrations: null,
      recommendations: [],
      nextSteps: [{ id: 'start-supervised-host', title: 'Start supervised host', blocking: true }],
      notes: [],
    } as any);
    const brief = formatOperatorBriefSnapshot({
      generatedAt: '2026-04-24T00:00:00.000Z',
      posture: 'watch',
      headline: 'Zavorth operational, but needs attention.',
      highlights: ['Node Mesh with real smoke expired.'],
      nextAction: {
        label: 'Validate Node Mesh',
        command: 'npm run test:nodes:smoke',
        reason: 'Renew expired smoke.',
      },
      channelProviderDoctor: { summary: 'Channels ok.' },
      remoteTransportDoctor: { summary: 'Remote pending.' },
      maintenanceAutomation: { summary: 'Automation active.' },
    } as any);
    const ops = formatOperationsCockpitSnapshot({
      generatedAt: '2026-04-24T00:00:00.000Z',
      status: 'attention',
      headline: 'Zavorth needs attention.',
      highlights: ['1/2 enabled sidecars are ready.'],
      runtime: {
        uptimeLabel: '2h',
        memoryLabel: '256 MB RSS',
        platformLabel: 'win32 / x64',
      },
      summary: {
        enabledSidecars: 2,
        readySidecars: 1,
        recentErrorCount: 1,
      },
      actions: [{ label: 'Validate Node Mesh', command: 'npm run test:nodes:smoke' }],
      alerts: [],
    } as any);
    const output = [status, doctor, brief, ops].join('\n\n');

    expect(status).toMatch(
      /- Conversation is ready to continue\.|Agent state: Ready to use|Ready to use|ready to continue/i,
    );
    expect(status).toContain('> zavorth doctor');
    expect(doctor).toContain('Zavorth diagnostic');
    expect(doctor).toContain('zavorth go');
    expect(brief).toContain('> Validate Node Mesh');
    expect(brief).toContain('> zavorth doctor');
    expect(ops).toContain('> local components: 1 of 2 ready');
    expect(ops).toContain('> next step: Validate Node Mesh (zavorth doctor)');
    expectNoFirstLayerNoise(output);
  });

  it('keeps the operations cockpit consolidated without leaking internal commands', () => {
    const output = formatCliOperationsCockpitSnapshot({
      generatedAt: '2026-04-24T00:00:00.000Z',
      stage: '25',
      surface: 'zavorth-cockpit',
      status: 'attention',
      headline: '1/2 enabled sidecars are ready.',
      highlights: ['Node Mesh with real smoke expired.'],
      runtime: {
        uptimeLabel: '2h',
        memoryLabel: '256 MB RSS',
        heapLabel: '96 MB heap',
        platformLabel: 'win32 / x64',
        sampledAt: '2026-04-24T00:00:00.000Z',
      },
      summary: {
        enabledSidecars: 2,
        readySidecars: 1,
        recentErrorCount: 1,
        freeDiskPercent: 62,
        publishAgeLabel: '2 h',
      },
      actions: [],
      alerts: [],
      operations: {} as any,
      unified: {
        headline: 'Zavorth operational, but needs attention.',
        posture: 'attention',
        sourceHealth: {
          status: true,
          doctor: true,
          brief: true,
          ops: true,
          memory: true,
          actions: true,
        },
        cards: [
          {
            id: 'state',
            title: 'Current state',
            tone: 'warning',
            lines: [
              '- state: needs attention',
              '- status: Zavorth operational.',
              '- doctor: Zavorth ready for local use.',
            ],
          },
          {
            id: 'operations',
            title: 'Operation',
            tone: 'warning',
            lines: ['- local components: 1 of 2 ready', '- maintenance: automation enabled', '- publish: 2 h'],
          },
          {
            id: 'work',
            title: 'Work and deliveries',
            tone: 'neutral',
            lines: [
              '- conversations: 2 sessions | 0 pending permissions',
              '- replay: 2 tasks | artifacts: 3',
              '- recent artifact: gateway-summary.md',
            ],
          },
          {
            id: 'trust',
            title: 'Trust and access',
            tone: 'neutral',
            lines: [
              '- security: zero-trust ready',
              '- remote: 1/2 transports ready',
              '- mesh: 1/1 nodes online | queue 0',
            ],
          },
        ],
        nextActions: [
          {
            id: 'doctor',
            label: 'Open main diagnostic',
            command: 'zavorth doctor',
            reason: 'Validate signals before acting.',
            priority: 'high',
            source: 'doctor',
          },
        ],
        memory: {
          artifacts: 3,
          replayTasks: 2,
          recentArtifact: 'gateway-summary.md',
          suggestedAction: null,
        },
        doctorError: null,
      },
      statusSnapshot: null,
      briefSnapshot: null,
      doctorSnapshot: null,
    } as any);

    expect(output).toMatch(/Zavorth Ops|Ops/i);
    expect(output).toMatch(/Current state|Now/i);
    expect(output).toMatch(/Work and deliveries|Work/i);
    expect(output).toMatch(/Trust and access|Access/i);
    expect(output).toMatch(/Do now|Next/i);
    expect(output).not.toMatch(/\bzavorth ops run\b/i);
    expectNoFirstLayerNoise(output);
  });
});
