import fs from 'node:fs';
import path from 'node:path';

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
export type ZavorthParitySource = 'hermes' | 'openclaw';
export type ZavorthParityToolStatus = 'native' | 'partial' | 'planned';

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
    parityHermes: string;
    parityOpenClaw: string;
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

export type ZavorthParityTool = {
  sourceToolId: string;
  sourceLabel: string;
  category: string;
  zavorthActionId: string;
  zavorthToolName: string;
  status: ZavorthParityToolStatus;
};

export type ZavorthParityPack = {
  source: ZavorthParitySource;
  generatedAt: string;
  summary: {
    total: number;
    native: number;
    partial: number;
    planned: number;
  };
  tools: ZavorthParityTool[];
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
    summary: 'Add native image, video, audio and document extraction actions comparable to Hermes/OpenClaw media plugins.',
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

const HERMES_TOOLS: Array<Omit<ZavorthParityTool, 'status'>> = [
  tool('web_search', 'Web search', 'web', 'web.search', 'web_search'),
  tool('web_extract', 'Web extract', 'web', 'web.fetch_url', 'web_fetch_url'),
  tool('terminal', 'Terminal command', 'shell', 'shell.run_allowlisted', 'shell_run_allowlisted'),
  tool('process', 'Process manager', 'shell', 'shell.preview_command', 'shell_preview_command'),
  tool('read_file', 'Read file', 'workspace', 'workspace.read_file', 'workspace_read_file'),
  tool('write_file', 'Write file', 'workspace', 'workspace.write_file', 'workspace_write_file'),
  tool('patch', 'Patch file', 'workspace', 'workspace.patch_file', 'workspace_patch_file'),
  tool('search_files', 'Search files', 'workspace', 'workspace.search_files', 'workspace_search_files'),
  tool('vision_analyze', 'Vision analyze', 'vision', 'computer.vision', 'computer_vision'),
  tool('image_generate', 'Image generate', 'media', 'media.image.generate', 'media_image_generate'),
  tool('skills_list', 'Skills list', 'skills', 'skills.catalog.list', 'skills_catalog_list'),
  tool('skill_view', 'Skill view', 'skills', 'skills.catalog.inspect', 'skills_catalog_inspect'),
  tool('skill_manage', 'Skill manage', 'skills', 'skills.absorb', 'skills_absorb'),
  tool('browser_navigate', 'Browser navigate', 'browser', 'browser.open', 'browser_open'),
  tool('browser_snapshot', 'Browser snapshot', 'browser', 'browser.extract', 'browser_extract'),
  tool('browser_click', 'Browser click', 'browser', 'browser.click', 'browser_click'),
  tool('browser_type', 'Browser type', 'browser', 'browser.type', 'browser_type'),
  tool('browser_scroll', 'Browser scroll', 'browser', 'browser.click', 'browser_click'),
  tool('browser_back', 'Browser back', 'browser', 'browser.open', 'browser_open'),
  tool('browser_press', 'Browser press', 'browser', 'browser.type', 'browser_type'),
  tool('browser_get_images', 'Browser get images', 'browser', 'browser.screenshot', 'browser_screenshot'),
  tool('browser_vision', 'Browser vision', 'browser', 'browser.screenshot', 'browser_screenshot'),
  tool('browser_console', 'Browser console', 'browser', 'browser.extract', 'browser_extract'),
  tool('browser_cdp', 'Browser CDP', 'browser', 'playwright_browser', 'playwright_browser'),
  tool('browser_dialog', 'Browser dialog', 'browser', 'browser.click', 'browser_click'),
  tool('text_to_speech', 'Text to speech', 'media', 'media.speech.synthesize', 'media_speech_synthesize'),
  tool('todo', 'Todo planner', 'workflows', 'tasks.board.status', 'tasks_board_status'),
  tool('memory', 'Persistent memory', 'memory', 'memory.deep.review', 'memory_deep_review'),
  tool('session_search', 'Session search', 'memory', 'memory.deep.resolve', 'memory_deep_resolve'),
  tool('clarify', 'Clarify', 'agent-core', 'action.schema.lookup', 'action_schema_lookup'),
  tool('execute_code', 'Execute code', 'sandbox', 'sandbox.run_code', 'sandbox_run_code'),
  tool('delegate_task', 'Delegate task', 'agents', 'agents.external.invoke', 'agents_external_invoke'),
  tool('cronjob', 'Cron jobs', 'automation', 'workflows.run', 'workflows_run'),
  tool('send_message', 'Send message', 'channels', 'channels.send_approved', 'channels_send_approved'),
  tool('ha_list_entities', 'Home Assistant list entities', 'iot', 'iot_home_assistant', 'iot_home_assistant'),
  tool('ha_get_state', 'Home Assistant get state', 'iot', 'iot_home_assistant', 'iot_home_assistant'),
  tool('ha_list_services', 'Home Assistant list services', 'iot', 'iot_home_assistant', 'iot_home_assistant'),
  tool('ha_call_service', 'Home Assistant call service', 'iot', 'iot_home_assistant', 'iot_home_assistant'),
  tool('kanban_show', 'Kanban show', 'workflows', 'tasks.board.status', 'tasks_board_status'),
  tool('kanban_list', 'Kanban list', 'workflows', 'tasks.board.status', 'tasks_board_status'),
  tool('kanban_complete', 'Kanban complete', 'workflows', 'tasks.board.triage', 'tasks_board_triage'),
  tool('kanban_block', 'Kanban block', 'workflows', 'tasks.board.triage', 'tasks_board_triage'),
  tool('kanban_heartbeat', 'Kanban heartbeat', 'workflows', 'background.status', 'background_status'),
  tool('kanban_comment', 'Kanban comment', 'workflows', 'tasks.board.decompose', 'tasks_board_decompose'),
  tool('kanban_create', 'Kanban create', 'workflows', 'tasks.board.decompose', 'tasks_board_decompose'),
  tool('kanban_link', 'Kanban link', 'workflows', 'tasks.board.decompose', 'tasks_board_decompose'),
  tool('kanban_unblock', 'Kanban unblock', 'workflows', 'tasks.board.triage', 'tasks_board_triage'),
  tool('computer_use', 'Computer use', 'devices', 'computer.vision', 'computer_vision'),
];

const OPENCLAW_TOOLS: Array<Omit<ZavorthParityTool, 'status'>> = [
  tool('file_fetch', 'File fetch', 'workspace', 'workspace.read_file', 'workspace_read_file'),
  tool('dir_list', 'Directory list', 'workspace', 'workspace.list_directory', 'workspace_list_directory'),
  tool('dir_fetch', 'Directory fetch', 'workspace', 'workspace.search_files', 'workspace_search_files'),
  tool('file_write', 'File write', 'workspace', 'workspace.write_file', 'workspace_write_file'),
  tool('browser.navigate', 'Browser navigate', 'browser', 'browser.open', 'browser_open'),
  tool('browser.click', 'Browser click', 'browser', 'browser.click', 'browser_click'),
  tool('browser.type', 'Browser type', 'browser', 'browser.type', 'browser_type'),
  tool('browser.screenshot', 'Browser screenshot', 'browser', 'browser.screenshot', 'browser_screenshot'),
  tool('browser.extract', 'Browser extract', 'browser', 'browser.extract', 'browser_extract'),
  tool('duckduckgo_search', 'DuckDuckGo search', 'web', 'web.search', 'web_search'),
  tool('brave_search', 'Brave search', 'web', 'web.search', 'web_search'),
  tool('exa_search', 'Exa search', 'web', 'web.search', 'web_search'),
  tool('firecrawl_search', 'Firecrawl search', 'web', 'web.search', 'web_search'),
  tool('parallel_search', 'Parallel search', 'web', 'web.search', 'web_search'),
  tool('perplexity_search', 'Perplexity search', 'web', 'web.search', 'web_search'),
  tool('searxng_search', 'SearXNG search', 'web', 'web.search', 'web_search'),
  tool('tavily_search', 'Tavily search', 'web', 'web.search', 'web_search'),
  tool('tavily_extract', 'Tavily extract', 'web', 'web.fetch_url', 'web_fetch_url'),
  tool('web_readability.extract', 'Readability extract', 'web', 'web.fetch_url', 'web_fetch_url'),
  tool('document_extract', 'Document extract', 'documents', 'documents.extract', 'documents_extract'),
  tool('memory_search', 'Memory search', 'memory', 'memory.deep.review', 'memory_deep_review'),
  tool('memory_get', 'Memory get', 'memory', 'memory.deep.resolve', 'memory_deep_resolve'),
  tool('wiki.search', 'Wiki search', 'documents', 'wiki.search', 'wiki_search'),
  tool('diffs.view', 'Diff viewer', 'workspace', 'workspace.diff_file', 'workspace_diff_file'),
  tool('canvas.render', 'Canvas render', 'media', 'canvas.render', 'canvas_render'),
  tool('llm_task', 'JSON LLM task', 'agents', 'agents.external.invoke', 'agents_external_invoke'),
  tool('lobster.workflow', 'Lobster workflow', 'workflows', 'workflows.run', 'workflows_run'),
  tool('open_prose.run', 'OpenProse workflow', 'workflows', 'workflows.run', 'workflows_run'),
  tool('google.gmail', 'Google Gmail', 'google', 'gmail.search', 'gmail_search'),
  tool('google.drive', 'Google Drive', 'google', 'google.drive.search', 'google_drive_search'),
  tool('google.calendar', 'Google Calendar', 'google', 'google.calendar.list', 'google_calendar_list'),
  tool('discord.send', 'Discord send', 'channels', 'channels.send_approved', 'channels_send_approved'),
  tool('slack.send', 'Slack send', 'channels', 'channels.send_approved', 'channels_send_approved'),
  tool('telegram.send', 'Telegram send', 'channels', 'channels.send_approved', 'channels_send_approved'),
  tool('matrix.send', 'Matrix send', 'channels', 'channels.send_approved', 'channels_send_approved'),
  tool('whatsapp.send', 'WhatsApp send', 'channels', 'channels.send_approved', 'channels_send_approved'),
  tool('codex.agent', 'Codex agent runtime', 'agents', 'agents.external.invoke', 'agents_external_invoke'),
  tool('copilot.agent', 'Copilot agent runtime', 'agents', 'agents.external.invoke', 'agents_external_invoke'),
  tool('openshell.sandbox', 'OpenShell sandbox', 'sandbox', 'sandbox.run_code', 'sandbox_run_code'),
];

function tool(
  sourceToolId: string,
  sourceLabel: string,
  category: string,
  zavorthActionId: string,
  zavorthToolName: string,
): Omit<ZavorthParityTool, 'status'> {
  return { sourceToolId, sourceLabel, category, zavorthActionId, zavorthToolName };
}

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
        parityHermes: 'zavorth actions preview capabilities.parity.hermes',
        parityOpenClaw: 'zavorth actions preview capabilities.parity.openclaw',
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

  public buildParityPack(source: ZavorthParitySource): ZavorthParityPack {
    const actionIds = this.readManifestActionIds();
    const templates = source === 'hermes' ? HERMES_TOOLS : OPENCLAW_TOOLS;
    const tools = templates.map((entry) => ({
      ...entry,
      status: this.resolveParityStatus(entry.zavorthActionId, actionIds),
    }));
    return {
      source,
      generatedAt: this.now().toISOString(),
      summary: {
        total: tools.length,
        native: tools.filter((tool) => tool.status === 'native').length,
        partial: tools.filter((tool) => tool.status === 'partial').length,
        planned: tools.filter((tool) => tool.status === 'planned').length,
      },
      tools,
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

  private resolveParityStatus(targetId: string, actionIds: Set<string>): ZavorthParityToolStatus {
    if (actionIds.has(targetId) || ECHO_ONLY_TOOLS.has(targetId)) return 'native';
    const domain = targetId.split('.')[0];
    if ([...actionIds].some((id) => id.startsWith(`${domain}.`))) return 'partial';
    return 'planned';
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
    } catch {
      return ids;
    }
    return ids;
  }
}

function readPackageScripts(root: string): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    return parsed.scripts || {};
  } catch {
    return {};
  }
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}
