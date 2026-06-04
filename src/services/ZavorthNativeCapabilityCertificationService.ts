import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type {
  UniversalAgentRequest,
  UniversalAgentRunResult,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';
import { GoalLoopDaemonService } from './GoalLoopDaemonService.js';
import { GoalLoopService } from './GoalLoopService.js';
import { GoalLoopWorkerService, type GoalLoopAgentRunner } from './GoalLoopWorkerService.js';
import { GoalPlaneService } from './GoalPlaneService.js';
import { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthOperationalStateDbService } from './ZavorthOperationalStateDbService.js';
import { ZavorthXaiRuntimeService, type ZavorthXaiDoctorSnapshot } from './ZavorthXaiRuntimeService.js';

export type ZavorthNativeCapabilityCertificationStatus = 'ready' | 'partial' | 'missing';

export type ZavorthNativeCapabilityCertificationCheck = {
  id: string;
  title: string;
  status: ZavorthNativeCapabilityCertificationStatus;
  cleanInstallReady: boolean;
  liveCredentialRequired: boolean;
  baselineEvidence: string[];
  zavorthEvidence: string[];
  notes: string[];
  nextActions: string[];
};

export type ZavorthNativeCapabilityCertificationSmoke = {
  id: 'goal-loop-long-session';
  status: ZavorthNativeCapabilityCertificationStatus;
  ticksRequested: number;
  agentRuns: number;
  processedContinuations: number;
  finalPendingContinuations: number;
  finalGoalStatus: string | null;
  receipts: number;
  events: number;
  stateDbBacked: boolean;
  notes: string[];
};

export type ZavorthNativeCapabilityCertificationSnapshot = {
  contractVersion: 'zavorth-native-capability-certification/1';
  generatedAt: string;
  status: ZavorthNativeCapabilityCertificationStatus;
  projectRoot: string;
  evidenceRoot: string | null;
  evidenceRootFound: boolean;
  summary: {
    total: number;
    ready: number;
    partial: number;
    missing: number;
    credentialGatedReady: number;
  };
  checks: ZavorthNativeCapabilityCertificationCheck[];
  xai: {
    doctor: ZavorthXaiDoctorSnapshot;
    cleanInstallCredentialGateExpected: boolean;
    acceptsApiKey: true;
    acceptsOauthToken: true;
    secretsSerialized: false;
  };
  longRunSmoke: ZavorthNativeCapabilityCertificationSmoke;
  commands: {
    certify: string;
    certifyJson: string;
    qa: string;
    xaiDoctor: string;
    goalDaemon: string;
  };
  safety: {
    noExternalRuntimeDependency: true;
    noSecretSerialization: true;
    credentialMissingIsNotFailure: true;
    usesZavorthNativeContracts: true;
  };
};

type ServiceOptions = {
  projectRoot?: string;
  evidenceRoot?: string | null;
  env?: Record<string, string | undefined>;
  now?: () => Date;
};

type FeatureSpec = {
  id: string;
  title: string;
  baselineFiles: string[];
  zavorthFiles: string[];
  credentialGated?: boolean;
  notes: string[];
};

const FEATURES: FeatureSpec[] = [
  {
    id: 'goal-loop-background-continuation',
    title: 'Goal loop with background continuation worker',
    baselineFiles: ['baseline_cli/goals.py', 'cli.py', 'tests/baseline_cli/test_goals.py'],
    zavorthFiles: [
      'src/services/GoalPlaneService.ts',
      'src/services/GoalLoopService.ts',
      'src/services/GoalLoopWorkerService.ts',
      'src/services/GoalLoopDaemonService.ts',
      'src/services/GoalLoopStatusProjectionService.ts',
      'tests/services/GoalLoopDaemonService.test.ts',
      'tests/services/GoalLoopWorkerService.test.ts',
    ],
    notes: [
      'Persistent goals can queue continuation work without silent execution.',
      'Worker owns AgentRun execution and the daemon adds heartbeat, backoff and stale-claim recovery.',
    ],
  },
  {
    id: 'operational-state-session-recall',
    title: 'Operational StateDB and session recall',
    baselineFiles: ['baseline_state.py', 'tools/session_search_tool.py', 'tests/tools/test_session_search.py'],
    zavorthFiles: [
      'src/services/ZavorthOperationalStateDbService.ts',
      'src/services/ZavorthSessionRecallService.ts',
      'tests/services/ZavorthOperationalStateDbService.test.ts',
    ],
    notes: [
      'State is durable in SQLite with FTS fallback, sessions, messages, events, receipts, goals, tasks and locks.',
      'Recall is an operational service instead of a loose JSON note store.',
    ],
  },
  {
    id: 'taskboard-kanban-plane',
    title: 'TaskBoard/Kanban over Task Plane',
    baselineFiles: ['baseline_cli/kanban_db.py', 'baseline_cli/kanban.py', 'tools/kanban_tools.py'],
    zavorthFiles: [
      'src/services/TaskPlaneService.ts',
      'src/services/TaskBoardPlaneService.ts',
      'tests/services/ZavorthDailyOpsPlane.test.ts',
    ],
    notes: [
      'Boards are backed by the Task Plane and can decompose/triage work without bypassing approvals.',
    ],
  },
  {
    id: 'mcp-skills-catalog',
    title: 'MCP and installable skills catalog',
    baselineFiles: ['tools/mcp_tool.py', 'baseline_cli/mcp_catalog.py', 'tools/skills_hub.py', 'optional-skills'],
    zavorthFiles: [
      'src/services/McpCapabilityControlPlaneService.ts',
      'src/services/SkillLibraryPresentationService.ts',
      'src/services/SkillInstallPlanPresentationService.ts',
      'src/skills/UniversalSkillIntakeService.ts',
      'src/services/ZavorthHubControlPlaneService.ts',
      'tests/services/McpCapabilityControlPlaneService.test.ts',
      'tests/skills/UniversalSkillIntakeService.test.ts',
    ],
    notes: [
      'MCP and skills are exposed through governed control planes and install plans.',
      'Secrets and required env vars are surfaced as readiness, not copied into reports.',
    ],
  },
  {
    id: 'xai-provider-resolver-search',
    title: 'xAI resolver, doctor and native search',
    baselineFiles: ['tools/x_search_tool.py', 'tools/xai_http.py', 'baseline_cli/proxy/adapters/xai.py', 'agent/google_oauth.py'],
    zavorthFiles: [
      'src/services/ZavorthXaiRuntimeService.ts',
      'tests/cli/ZavorthDailyOpsCommand.test.ts',
      'src/cli/ZavorthCliLiveNamespaces.ts',
    ],
    credentialGated: true,
    notes: [
      'Clean install reports missing credential honestly, which is expected for this provider.',
      'Adapter supports API key and OAuth token credentials without serializing either one.',
    ],
  },
  {
    id: 'curator-plane-reviewer',
    title: 'Skill curator plane with optional LLM reviewer',
    baselineFiles: ['agent/skill_commands.py', 'tools/skills_guard.py', 'tests/baseline_cli/test_goals.py'],
    zavorthFiles: [
      'src/skills/SkillCuratorPlaneService.ts',
      'src/services/ZavorthSkillCuratorLiveLoopService.ts',
      'tests/services/SkillCuratorPlaneService.test.ts',
      'tests/services/ZavorthSkillCuratorLiveLoopService.test.ts',
    ],
    notes: [
      'Curator can dry-run, pause/resume, review proposals and keep apply behind approval/receipt.',
    ],
  },
  {
    id: 'daily-ops-command-surface',
    title: 'Daily ops commands with one governed action surface',
    baselineFiles: ['cli.py', 'tui_gateway', 'ui-tui'],
    zavorthFiles: [
      'src/cli/ZavorthCliLiveNamespaces.ts',
      'src/runtime/actions/ZavorthActionCatalog.ts',
      'src/tools/ZavorthActionTool.ts',
      'tests/runtime/actions/ZavorthActionHarness.test.ts',
      'tests/cli/ZavorthDailyOpsCommand.test.ts',
    ],
    notes: [
      'Natural actions, CLI, TUI and runtime tools converge on the Action Harness instead of phrase-specific mutations.',
    ],
  },
];

export class ZavorthNativeCapabilityCertificationService {
  private readonly projectRoot: string;
  private readonly evidenceRoot: string | null;
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;

  public constructor(options: ServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.evidenceRoot = options.evidenceRoot === null
      ? null
      : this.resolveEvidenceRoot(options.evidenceRoot);
    this.env = options.env || process.env;
    this.now = options.now || (() => new Date());
  }

  public async buildSnapshot(): Promise<ZavorthNativeCapabilityCertificationSnapshot> {
    const xai = new ZavorthXaiRuntimeService({ env: this.env as NodeJS.ProcessEnv, now: this.now }).doctor();
    const longRunSmoke = await this.runLongGoalLoopSmoke();
    const checks = FEATURES.map((feature) => this.checkFeature(feature, xai));
    checks.push(this.longRunCheck(longRunSmoke));
    const summary = {
      total: checks.length,
      ready: checks.filter((check) => check.status === 'ready').length,
      partial: checks.filter((check) => check.status === 'partial').length,
      missing: checks.filter((check) => check.status === 'missing').length,
      credentialGatedReady: checks.filter((check) => check.liveCredentialRequired && check.cleanInstallReady).length,
    };
    return {
      contractVersion: 'zavorth-native-capability-certification/1',
      generatedAt: this.now().toISOString(),
      status: this.aggregate(summary),
      projectRoot: this.projectRoot,
      evidenceRoot: this.evidenceRoot,
      evidenceRootFound: Boolean(this.evidenceRoot && fs.existsSync(this.evidenceRoot)),
      summary,
      checks,
      xai: {
        doctor: xai,
        cleanInstallCredentialGateExpected: !xai.configured && xai.status === 'missing_env',
        acceptsApiKey: true,
        acceptsOauthToken: true,
        secretsSerialized: false,
      },
      longRunSmoke,
      commands: {
        certify: 'zavorth certify native-capability',
        certifyJson: 'zavorth certify native-capability --json',
        qa: 'npm run qa:zavorth-native-capability-certification --silent',
        xaiDoctor: 'zavorth xai doctor',
        goalDaemon: 'zavorth goals daemon tick',
      },
      safety: {
        noExternalRuntimeDependency: true,
        noSecretSerialization: true,
        credentialMissingIsNotFailure: true,
        usesZavorthNativeContracts: true,
      },
    };
  }

  public renderText(snapshot: ZavorthNativeCapabilityCertificationSnapshot): string {
    const lines = [
      'Zavorth Native Capability Certification',
      '',
      `Status: ${snapshot.status}`,
      `Checks: ${snapshot.summary.ready}/${snapshot.summary.total} ready | partial=${snapshot.summary.partial} | missing=${snapshot.summary.missing}`,
      `Evidence root: ${snapshot.evidenceRootFound ? snapshot.evidenceRoot : 'not found; Zavorth self-certification only'}`,
      `xAI: ${snapshot.xai.doctor.status} (${snapshot.xai.doctor.authMode}; credential serialized: no)`,
      `Goal daemon smoke: ${snapshot.longRunSmoke.status} | runs=${snapshot.longRunSmoke.agentRuns} | final=${snapshot.longRunSmoke.finalGoalStatus}`,
      '',
    ];
    for (const check of snapshot.checks) {
      lines.push(`${check.id}: ${check.status}`);
      lines.push(`  ${check.title}`);
      for (const note of check.notes.slice(0, 2)) lines.push(`  - ${note}`);
      if (check.nextActions.length) lines.push(`  next: ${check.nextActions[0]}`);
      lines.push('');
    }
    lines.push(`QA: ${snapshot.commands.qa}`);
    return `${lines.join('\n')}\n`;
  }

  private checkFeature(feature: FeatureSpec, xai: ZavorthXaiDoctorSnapshot): ZavorthNativeCapabilityCertificationCheck {
    const baselineEvidence = this.collectEvidence(this.evidenceRoot, feature.baselineFiles);
    const zavorthEvidence = this.collectEvidence(this.projectRoot, feature.zavorthFiles);
    const missingZavorth = zavorthEvidence.filter((entry) => entry.startsWith('missing:'));
    const credentialReady = Boolean(feature.credentialGated && xai.status === 'missing_env');
    const status: ZavorthNativeCapabilityCertificationStatus = missingZavorth.length === 0
      ? 'ready'
      : missingZavorth.length < feature.zavorthFiles.length
        ? 'partial'
        : 'missing';
    return {
      id: feature.id,
      title: feature.title,
      status,
      cleanInstallReady: status === 'ready' || credentialReady,
      liveCredentialRequired: Boolean(feature.credentialGated),
      baselineEvidence,
      zavorthEvidence,
      notes: [
        ...feature.notes,
        ...(feature.credentialGated && xai.status === 'missing_env'
          ? ['Provider live proof is credential-gated; missing env on clean install is expected readiness, not a feature failure.']
          : []),
      ],
      nextActions: missingZavorth.length ? [`Add or wire: ${missingZavorth[0].replace(/^missing:/u, '').trim()}`] : [],
    };
  }

  private longRunCheck(smoke: ZavorthNativeCapabilityCertificationSmoke): ZavorthNativeCapabilityCertificationCheck {
    return {
      id: smoke.id,
      title: 'Long session goal continuation smoke',
      status: smoke.status,
      cleanInstallReady: smoke.status === 'ready',
      liveCredentialRequired: false,
      baselineEvidence: this.collectEvidence(this.evidenceRoot, [
        'baseline_cli/goals.py',
        'tests/baseline_cli/test_goals.py',
      ]),
      zavorthEvidence: [
        'src/services/GoalLoopService.ts',
        'src/services/GoalLoopWorkerService.ts',
        'src/services/GoalLoopDaemonService.ts',
        `stateDbBacked:${smoke.stateDbBacked}`,
      ],
      notes: smoke.notes,
      nextActions: smoke.status === 'ready' ? [] : ['Inspect Goal Loop daemon smoke output and worker receipts.'],
    };
  }

  private async runLongGoalLoopSmoke(): Promise<ZavorthNativeCapabilityCertificationSmoke> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-capability-'));
    fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
    const stateDb = new ZavorthOperationalStateDbService({
      dbPath: path.join(root, 'runtime', 'state.sqlite'),
      now: this.now,
    });
    let agentRuns = 0;
    const agentRunner: GoalLoopAgentRunner = {
      run: async (request) => {
        agentRuns += 1;
        const reply = agentRuns === 1
          ? 'one focused slice processed; another audit slice is still useful'
          : 'completed all validation and tests passed';
        return runResult(request, reply, this.now().toISOString());
      },
    };
    try {
      const taskPlane = new TaskPlaneService({
        storePath: path.join(root, 'runtime', 'task-plane.json'),
        stateDb,
        now: this.now,
      });
      const goalPlane = new GoalPlaneService({
        storePath: path.join(root, 'runtime', 'goal-plane.json'),
        taskPlane,
        stateDb,
        now: this.now,
      });
      const loop = new GoalLoopService({ goalPlane, taskPlane, stateDb, now: this.now });
      const worker = new GoalLoopWorkerService({
        goalPlane,
        taskPlane,
        loop,
        agentRunner,
        stateDb,
        now: this.now,
      });
      const daemon = new GoalLoopDaemonService({ taskPlane, worker, stateDb, now: this.now });
      const goal = goalPlane.createGoal({
        objective: 'Certify a long-running goal continuation loop.',
        maxTurns: 5,
        profileId: 'developer',
      });
      await loop.evaluate({
        goalId: goal.id,
        turnSummary: 'Initial pass found more work to continue.',
        sourceSurface: 'native-capability-certification',
      });
      const result = await daemon.run({
        daemonId: 'native-capability-daemon',
        maxTicks: 3,
        maxItems: 1,
        intervalMs: 100,
        stopWhenIdle: true,
      });
      const finalGoal = goalPlane.snapshot().goals.find((entry) => entry.id === goal.id) || null;
      const dbSnapshot = stateDb.snapshot();
      const ready = agentRuns >= 2
        && result.pendingContinuations === 0
        && finalGoal?.status === 'done'
        && dbSnapshot.counts.receipts > 0
        && dbSnapshot.counts.events > 0;
      return {
        id: 'goal-loop-long-session',
        status: ready ? 'ready' : 'partial',
        ticksRequested: 3,
        agentRuns,
        processedContinuations: result.lastDrain?.processed || 0,
        finalPendingContinuations: result.pendingContinuations,
        finalGoalStatus: finalGoal?.status || null,
        receipts: dbSnapshot.counts.receipts,
        events: dbSnapshot.counts.events,
        stateDbBacked: true,
        notes: [
          'Created a real Goal Plane item, queued continuation, drained through daemon and worker, then re-judged to done.',
          `Daemon heartbeat recorded: ${result.safety.heartbeatRecorded ? 'yes' : 'no'}.`,
        ],
      };
    } catch (error) {
      return {
        id: 'goal-loop-long-session',
        status: 'missing',
        ticksRequested: 3,
        agentRuns,
        processedContinuations: 0,
        finalPendingContinuations: 0,
        finalGoalStatus: null,
        receipts: 0,
        events: 0,
        stateDbBacked: true,
        notes: [error instanceof Error ? error.message : String(error)],
      };
    } finally {
      stateDb.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  private collectEvidence(root: string | null, files: string[]): string[] {
    if (!root) return files.map((file) => `not-checked:${file}`);
    return files.map((file) => {
      const fullPath = path.join(root, file);
      return fs.existsSync(fullPath) ? file : `missing: ${file}`;
    });
  }

  private resolveEvidenceRoot(explicit?: string | null): string | null {
    const candidates = [
      explicit ? path.resolve(explicit) : null,
      path.resolve(this.projectRoot, '..', '..', 'zavorth-certification-evidence'),
      path.resolve(this.projectRoot, '..', 'zavorth-certification-evidence'),
      path.resolve(process.cwd(), '..', '..', 'zavorth-certification-evidence'),
    ].filter((entry): entry is string => Boolean(entry));
    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0] || null;
  }

  private aggregate(summary: ZavorthNativeCapabilityCertificationSnapshot['summary']): ZavorthNativeCapabilityCertificationStatus {
    if (summary.missing > 0) return 'missing';
    if (summary.partial > 0) return 'partial';
    return 'ready';
  }
}

function runResult(request: UniversalAgentRequest, reply: string, now: string): UniversalAgentRunResult {
  return {
    ok: true,
    run: {
      id: `run-${request.requestId}`,
      traceId: request.traceId || `trace-${request.requestId}`,
      requestId: request.requestId || 'request',
      sessionId: request.sessionId || 'session',
      userId: request.userId,
      channel: request.channel,
      title: 'Native capability goal continuation',
      input: request.text,
      workspace: request.workspace || null,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
      summary: reply,
      events: [],
      toolExposure: { mode: 'safe', summary: 'safe', tools: [] },
      replyPorts: [],
      modelProfile: {
        providerLabel: 'fake',
        modelLabel: 'deterministic-certification',
        routingPolicy: 'direct',
      },
      approvals: [],
      artifacts: [],
      memorySignals: [],
      metadata: {},
    },
    replies: [{
      id: `reply-${request.requestId}`,
      runId: `run-${request.requestId}`,
      port: request.replyPort || {
        id: 'native-capability',
        label: 'Native capability',
        kind: 'cli',
        status: 'available',
      },
      text: reply,
      createdAt: now,
    }],
  };
}
