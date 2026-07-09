import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';

export type ZavorthHiddenCapabilityStatus = 'exposed' | 'partial' | 'hidden' | 'missing';
export type ZavorthHiddenCapabilityDomain =
  | 'skills'
  | 'agents'
  | 'workflows'
  | 'capabilities'
  | 'providers'
  | 'channels'
  | 'google'
  | 'memory'
  | 'documents'
  | 'devices'
  | 'media';

export type ZavorthHiddenCapabilityCandidate = {
  id: string;
  title: string;
  domain: ZavorthHiddenCapabilityDomain;
  summary: string;
  sourceFiles: string[];
  existingSourceFiles: string[];
  missingSourceFiles: string[];
  desiredActionIds: string[];
  exposedActionIds: string[];
  missingActionIds: string[];
  status: ZavorthHiddenCapabilityStatus;
  recommendedAction: string;
};

export type ZavorthHiddenCapabilitySnapshot = {
  generatedAt: string;
  surface: 'hidden-capability-spine';
  projectRoot: string;
  summary: {
    total: number;
    exposed: number;
    partial: number;
    hidden: number;
    missing: number;
    actionIds: number;
  };
  candidates: ZavorthHiddenCapabilityCandidate[];
  commands: {
    scan: string;
    inspect: string;
    expose: string;
  };
};

export type ZavorthCapabilityMaterializationPlan = {
  candidateId: string;
  title: string;
  manifestId: 'capability-spine';
  manifestPath: string;
  actionModulePath: string;
  actionIds: string[];
  missingActionIds: string[];
  testRefs: string[];
  llmSurface: boolean;
  nextSteps: string[];
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
};

type CandidateTemplate = Omit<
  ZavorthHiddenCapabilityCandidate,
  'existingSourceFiles' | 'missingSourceFiles' | 'exposedActionIds' | 'missingActionIds' | 'status' | 'recommendedAction'
>;

const CANDIDATES: CandidateTemplate[] = [
  {
    id: 'google.workspace',
    title: 'Google Workspace native pack',
    domain: 'google',
    summary: 'Expose Gmail, Google Drive, Calendar and Tasks through native governed Personal Ops and Google metadata actions.',
    sourceFiles: [
      'src/services/ZavorthPersonalOpsRuntimeService.ts',
      'src/services/ZavorthPersonalOpsLiveAdapters.ts',
      'src/services/ZavorthNativePowerPackService.ts',
    ],
    desiredActionIds: [
      'google.workspace.status',
      'gmail.search',
      'gmail.draft',
      'gmail.send',
      'google.drive.search',
      'google.drive.read_file',
      'google.calendar.list',
      'google.calendar.create',
      'google.calendar.update',
      'google.tasks.list',
      'google.tasks.create',
      'google.tasks.update',
    ],
  },
  {
    id: 'skills.absorption',
    title: 'Skill absorption and skill bridge',
    domain: 'skills',
    summary: 'Find, inspect, import, materialize and bridge internal or external skills as governed Zavorth abilities.',
    sourceFiles: [
      'src/services/UniversalSkillExpansionService.ts',
      'src/services/ZavorthSkillAbsorptionMaterializationService.ts',
      'src/services/UniversalSkillBridgeRegistryService.ts',
      'src/skills/UniversalSkillBridgeRuntimeService.ts',
    ],
    desiredActionIds: [
      'skills.catalog.list',
      'skills.catalog.inspect',
      'skills.absorb',
      'skills.verify',
      'skills.create',
      'skills.archive',
    ],
  },
  {
    id: 'agents.external-arms',
    title: 'External agents as arms',
    domain: 'agents',
    summary: 'Register, inspect and invoke external agents, subagents and source runtimes as governed arms.',
    sourceFiles: [
      'src/services/ZavorthExternalAgentGatewayService.ts',
      'src/services/SourceAgentRuntimeBridgeService.ts',
      'src/runtime/agent/AgentTeamCompilerService.ts',
      'src/services/ZavorthGovernedSubagentService.ts',
    ],
    desiredActionIds: [
      'agents.external.list',
      'agents.external.register',
      'agents.external.invoke',
      'agents.team.plan',
      'agents.team.dispatch',
      'agents.team.collect',
    ],
  },
  {
    id: 'workflows.dynamic',
    title: 'Dynamic workflows and mission runners',
    domain: 'workflows',
    summary: 'Expose internal workflow scripts, mission flows and daily ops loops through a single governed workflow surface.',
    sourceFiles: [
      'src/services/ZavorthDailyCapabilityFlowService.ts',
      'src/runtime/agent/AgentWorkflowQueueStore.ts',
      'src/services/ZavorthNativeAutonomySpineService.ts',
    ],
    desiredActionIds: [
      'workflows.list',
      'workflows.run',
      'workflows.compose',
      'workflows.status',
      'workflows.cancel',
    ],
  },
  {
    id: 'capabilities.atlas-spine',
    title: 'Capability atlas to Action Harness spine',
    domain: 'capabilities',
    summary: 'Make the Atlas, Candidate Registry, exposure service and lifecycle visible to the central LLM tool surface.',
    sourceFiles: [
      'src/services/ZavorthCapabilityAtlasService.ts',
      'src/services/ZavorthCapabilityCandidateRegistryService.ts',
      'src/services/ZavorthCapabilityActionExposureService.ts',
      'src/services/ZavorthCapabilityLifecycleService.ts',
    ],
    desiredActionIds: [
      'capabilities.hidden.scan',
      'capabilities.hidden.inspect',
      'capabilities.hidden.expose',
      'capabilities.lifecycle.status',
      'capabilities.lifecycle.promote',
    ],
  },
  {
    id: 'providers.mesh',
    title: 'Provider mesh and model routing',
    domain: 'providers',
    summary: 'Expose provider catalog, provider capability matrix, cost/routing checks and model selection as governed actions.',
    sourceFiles: [
      'src/services/ZavorthProviderCapabilityCatalogService.ts',
      'src/services/ZavorthProviderCapabilityMatrixService.ts',
      'src/services/ZavorthXaiRuntimeService.ts',
    ],
    desiredActionIds: [
      'providers.capability_matrix',
      'providers.route.test',
      'providers.select',
      'providers.cost.estimate',
    ],
  },
  {
    id: 'channels.full',
    title: 'Full channel mesh',
    domain: 'channels',
    summary: 'Bring Telegram, Discord, Slack, Matrix-style readiness, reads, drafts and sends under one channel action surface.',
    sourceFiles: [
      'src/services/ZavorthChannelCapabilityAtlasService.ts',
      'src/services/ChannelProgressSurfaceService.ts',
      'src/telegram/bot-gateway/BotGatewayState.ts',
    ],
    desiredActionIds: [
      'channels.list',
      'channels.read',
      'channels.telegram.send',
      'channels.discord.send',
      'channels.slack.send',
      'channels.send_approved',
    ],
  },
  {
    id: 'memory.deep',
    title: 'Deep memory and session recall',
    domain: 'memory',
    summary: 'Connect Mnemos, session search, facts, lifecycle and procedural memory to first-class LLM tools.',
    sourceFiles: [
      'src/services/ZavorthMnemosQueryService.ts',
      'src/services/ZavorthSessionRecallService.ts',
      'src/services/MemoryService.ts',
    ],
    desiredActionIds: [
      'memory.search',
      'mnemos.session_recall',
      'memory.deep.review',
      'memory.deep.resolve',
      'memory.deep.correct',
      'memory.deep.forget',
    ],
  },
  {
    id: 'devices.perception-control',
    title: 'Perception, computer and Android control',
    domain: 'devices',
    summary: 'Expose vision, browser vision, computer control and Android ADB bridges as governed device actions.',
    sourceFiles: [
      'src/contracts/ZavorthVisionControlPlaneContract.ts',
      'scripts/zavorth-browser-vision-bridge-check.mjs',
      'scripts/zavorth-computer-control-plane-check.mjs',
      'scripts/zavorth-android-adb-bridge-check.mjs',
    ],
    desiredActionIds: [
      'media.image.analyze',
      'computer.screenshot',
      'computer.vision',
      'computer.media_control',
      'devices.iot.status',
      'devices.iot.mqtt_publish',
    ],
  },
  {
    id: 'media.generation',
    title: 'Media generation and understanding',
    domain: 'media',
    summary: 'Add native image, video, audio and document extraction actions as governed media tools.',
    sourceFiles: [
      'src/services/ZavorthNativePowerPackService.ts',
      'src/domain/surface/application/EchoSpeechSynthesisService.ts',
    ],
    desiredActionIds: [
      'media.status',
      'media.image.generate',
      'media.image.analyze',
      'media.speech.synthesize',
    ],
  },
  {
    id: 'documents.knowledge-canvas',
    title: 'Documents, wiki and canvas',
    domain: 'documents',
    summary: 'Expose local document extraction, docs/wiki search and canvas rendering as native Action Harness tools.',
    sourceFiles: [
      'src/services/ZavorthWorkspaceKnowledgeService.ts',
      'src/services/ZavorthNativePowerPackService.ts',
    ],
    desiredActionIds: [
      'documents.extract',
      'wiki.search',
      'canvas.render',
    ],
  },
];

const ECHO_ONLY_TOOLS = new Set([
  'os_open_app',
  'os_media_control',
  'os_system_info',
  'os_screenshot',
  'os_screen_vision',
  'iot_home_assistant',
  'iot_mqtt_publish',
  'playwright_browser',
]);

export class ZavorthHiddenCapabilitySpineService {
  private readonly projectRoot: string;
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(): ZavorthHiddenCapabilitySnapshot {
    const actionIds = this.readManifestActionIds();
    const candidates = CANDIDATES.map((candidate) => this.materializeCandidate(candidate, actionIds));
    return {
      generatedAt: this.now().toISOString(),
      surface: 'hidden-capability-spine',
      projectRoot: this.projectRoot,
      summary: {
        total: candidates.length,
        exposed: candidates.filter((candidate) => candidate.status === 'exposed').length,
        partial: candidates.filter((candidate) => candidate.status === 'partial').length,
        hidden: candidates.filter((candidate) => candidate.status === 'hidden').length,
        missing: candidates.filter((candidate) => candidate.status === 'missing').length,
        actionIds: actionIds.size,
      },
      candidates,
      commands: {
        scan: 'zavorth actions preview capabilities.hidden.scan',
        inspect: 'zavorth actions preview capabilities.hidden.inspect --args {"id":"skills.absorption"}',
        expose: 'zavorth actions preview capabilities.hidden.expose --args {"id":"skills.absorption"}',
      },
    };
  }

  public inspect(candidateId: string): ZavorthHiddenCapabilityCandidate | null {
    const id = normalize(candidateId);
    return this.buildSnapshot().candidates.find((candidate) => candidate.id === id) || null;
  }

  public buildMaterializationPlan(candidateId: string): ZavorthCapabilityMaterializationPlan | null {
    const candidate = this.inspect(candidateId);
    if (!candidate) return null;
    return {
      candidateId: candidate.id,
      title: candidate.title,
      manifestId: 'capability-spine',
      manifestPath: 'config/capability-manifests/capability-spine.json',
      actionModulePath: 'src/runtime/actions/modules/capabilitySpine.ts',
      actionIds: candidate.desiredActionIds,
      missingActionIds: candidate.missingActionIds,
      testRefs: [
        'tests/services/ZavorthHiddenCapabilitySpineService.test.ts',
        'tests/runtime/actions/ZavorthCapabilitySpineActions.test.ts',
      ],
      llmSurface: true,
      nextSteps: [
        `Materialize missing actions: ${candidate.missingActionIds.join(', ') || 'none'}.`,
        'Keep preview/apply split, approval gates and receipts for every mutation or external execution.',
        'Publish verified actions through Echo via buildVerifiedActionHarnessTools.',
      ],
    };
  }

  public listWorkflowScripts(): Array<{ script: string; command: string; category: string; runnable: boolean }> {
    const scripts = readPackageScripts(this.projectRoot);
    return Object.entries(scripts)
      .filter(([name]) => /^(qa:|zavorth:|capability|architecture:|security:|workspace:)/u.test(name))
      .map(([script, command]) => ({
        script,
        command,
        category: script.startsWith('qa:') ? 'qa' : script.startsWith('security:') ? 'security' : script.includes('capability') ? 'capability' : 'runtime',
        runnable: script.startsWith('qa:') || script.endsWith(':check') || script === 'security:ci',
      }))
      .sort((left, right) => left.script.localeCompare(right.script));
  }

  private materializeCandidate(template: CandidateTemplate, actionIds: Set<string>): ZavorthHiddenCapabilityCandidate {
    const existingSourceFiles = template.sourceFiles.filter((file) => fs.existsSync(path.join(this.projectRoot, file)));
    const missingSourceFiles = template.sourceFiles.filter((file) => !fs.existsSync(path.join(this.projectRoot, file)));
    const exposedActionIds = template.desiredActionIds.filter((id) => actionIds.has(id));
    const missingActionIds = template.desiredActionIds.filter((id) => !actionIds.has(id));
    const status: ZavorthHiddenCapabilityStatus = existingSourceFiles.length === 0
      ? 'missing'
      : missingActionIds.length === 0
        ? 'exposed'
        : exposedActionIds.length > 0
          ? 'partial'
          : 'hidden';
    return {
      ...template,
      existingSourceFiles,
      missingSourceFiles,
      exposedActionIds,
      missingActionIds,
      status,
      recommendedAction: status === 'hidden'
        ? `Preview exposure with capabilities.hidden.expose for ${template.id}.`
        : status === 'partial'
          ? `Materialize remaining actions: ${missingActionIds.join(', ')}.`
          : status === 'exposed'
            ? 'Already exposed through Action Harness.'
            : 'Implementation files were not found in this checkout.',
    };
  }

  private readManifestActionIds(): Set<string> {
    const ids = new Set<string>();
    const dir = path.join(this.projectRoot, 'config', 'capability-manifests');
    try {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.json')) continue;
        const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as { actions?: Array<{ id?: unknown }> };
        for (const action of parsed.actions || []) {
          const id = normalize(action.id);
          if (id) ids.add(id);
        }
      }
    } catch (error: unknown) {logger.warn('[ZavorthHiddenCapabilitySpineService] Failed to read capability manifests:', error);
      return ids;
    }
    return ids;
  }
}

function readPackageScripts(root: string): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    return parsed.scripts || {};
  } catch (error: unknown) {logger.warn('[ZavorthHiddenCapabilitySpineService] Failed to read package.json scripts:', error);
    return {};
  }
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}
