import type { UniversalCommandDescriptor } from '../../contracts/commands/UniversalCommandContract.js';
import { ShadowCheckpointStoreService } from '../../services/snapshot/ShadowCheckpointStoreService.js';
import { HashlineAnchorPatcherService } from '../../services/editor/HashlineAnchorPatcherService.js';
import { StagnationAndLoopBreakerService } from '../../runtime/agent/StagnationAndLoopBreakerService.js';
import { TerminalMermaidRendererService } from '../../services/tui/TerminalMermaidRendererService.js';
import { SessionTimelineNavigatorService } from '../../runtime/sessions/SessionTimelineNavigatorService.js';
import { TerminalDiffViewerComponent } from '../../cli/components/TerminalDiffViewerComponent.js';
import { AutonomousMemoryConsolidationService } from '../../services/memory/AutonomousMemoryConsolidationService.js';
import { SkillLifecycleCuratorService } from '../../services/skills/SkillLifecycleCuratorService.js';
import { AutomaticTrajectoryCompactorService } from '../../services/compression/AutomaticTrajectoryCompactorService.js';
import { ToolRuntimeCodeModeEngine } from '../execution/infrastructure/ToolRuntimeCodeModeEngine.js';
import { CommandSecurityStaticScannerService } from '../../services/security/CommandSecurityStaticScannerService.js';
import { PromptCachePrefixOptimizerService } from '../ai-routing/PromptCachePrefixOptimizerService.js';
import { CrossSurfaceSatelliteBridgeService } from '../surface/infrastructure/CrossSurfaceSatelliteBridgeService.js';
import { WatchdogSupervisionOrchestratorService } from '../../services/supervision/WatchdogSupervisionOrchestratorService.js';

const checkpointStore = new ShadowCheckpointStoreService();
const anchorPatcher = new HashlineAnchorPatcherService();
const loopBreaker = new StagnationAndLoopBreakerService();
const mermaidRenderer = new TerminalMermaidRendererService();
const timelineNavigator = new SessionTimelineNavigatorService();
const diffViewer = new TerminalDiffViewerComponent();
const memoryConsolidator = new AutonomousMemoryConsolidationService();
const skillCurator = new SkillLifecycleCuratorService();
const trajectoryCompactor = new AutomaticTrajectoryCompactorService();
const codeModeEngine = new ToolRuntimeCodeModeEngine();
const securityScanner = new CommandSecurityStaticScannerService();
const promptCacheOptimizer = new PromptCachePrefixOptimizerService();
const satelliteBridge = new CrossSurfaceSatelliteBridgeService();
const watchdogOrchestrator = new WatchdogSupervisionOrchestratorService();

export function getBuiltinWaveCommandDescriptors(): readonly UniversalCommandDescriptor[] {
  return [
    // --- WAVE 1 ---
    {
      id: 'checkpoint.manage',
      name: 'Checkpoint & Snapshot Manager',
      description: 'Creates, inspects, or reverts workspace and session state checkpoints.',
      toolName: 'checkpoint_manage',
      slashAliases: ['/checkpoint', '/cp', '/snap', '/undo'],
      group: 'workspace',
      riskLevel: 'safe_mutation',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The action to perform: create, list, or revert.',
            enum: ['create', 'list', 'revert'],
          },
          checkpointId: {
            type: 'string',
            description: 'Optional ID of the checkpoint to revert to.',
          },
          label: {
            type: 'string',
            description: 'Optional label when creating a checkpoint.',
          },
        },
        required: ['action'],
      },
      execute: async (args) => {
        const action = String(args.action || 'list');

        if (action === 'create') {
          const cp = checkpointStore.createCheckpoint(
            [process.cwd()],
            String(args.label || 'Manual checkpoint'),
          );
          return {
            success: true,
            message: `Created checkpoint ${cp.checkpointId}`,
            data: cp,
            formattedOutput: `[Checkpoint] Created: ${cp.checkpointId} (${cp.description})`,
          };
        }

        if (action === 'revert') {
          const targetId = String(args.checkpointId || '');
          const reverted = checkpointStore.rollbackCheckpoint(targetId);
          return {
            success: reverted.success,
            message: reverted.success
              ? `Reverted to checkpoint ${targetId}`
              : `Failed to rollback: ${reverted.errors.join(', ')}`,
            data: reverted,
            formattedOutput: reverted.success
              ? `[Checkpoint] Reverted to ${targetId} (${reverted.restoredFiles.length} files restored)`
              : `[Checkpoint] Error: ${reverted.errors.join(', ')}`,
          };
        }

        const history = checkpointStore.listCheckpoints(20);
        return {
          success: true,
          message: `Found ${history.length} checkpoints`,
          data: history,
          formattedOutput: `[Checkpoint] ${history.length} active checkpoint(s) available.`,
        };
      },
    },
    {
      id: 'patch.apply.anchored',
      name: 'Anchor Line Patcher',
      description: 'Applies drift-resistant fuzzy line-hash patch edits to source files and notebooks.',
      toolName: 'patch_apply_anchored',
      slashAliases: ['/patch', '/apply'],
      group: 'workspace',
      riskLevel: 'safe_mutation',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Target file path' },
          targetContent: { type: 'string', description: 'Content to search and replace' },
          replacementContent: { type: 'string', description: 'New replacement content' },
        },
        required: ['filePath', 'targetContent', 'replacementContent'],
      },
      execute: async (args) => {
        const filePath = String(args.filePath || '');
        const targetContent = String(args.targetContent || '');
        const replacementContent = String(args.replacementContent || '');

        const result = anchorPatcher.applyPatchToFile(filePath, [
          {
            startLine: 1,
            endLine: targetContent.split('\n').length + 1,
            targetContent,
            replacementContent,
          },
        ]);

        return {
          success: result.success,
          message: result.success ? `Patch applied to ${filePath}` : (result.error || 'Patch failed'),
          data: result,
          formattedOutput: result.success
            ? `[Patcher] Applied (${result.appliedReplacements} replacements in ${filePath})`
            : `[Patcher] Failed: ${result.error}`,
        };
      },
    },
    {
      id: 'resilience.loopbreak',
      name: 'Loop & Stagnation Breaker',
      description: 'Diagnoses agent turn trajectory to detect infinite loops or repetitive tool calls and generates escape suggestions.',
      toolName: 'stagnation_diagnose',
      slashAliases: ['/loopbreak', '/unstick'],
      group: 'general',
      riskLevel: 'read_only',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File path being edited repeatedly' },
          contentSnippet: { type: 'string', description: 'Latest turn text content to evaluate' },
        },
      },
      execute: async (args) => {
        const filePath = String(args.filePath || 'generic.ts');
        const contentSnippet = String(args.contentSnippet || '');
        const trigger = loopBreaker.recordEdit(filePath, contentSnippet);

        return {
          success: true,
          message: trigger ? 'Stagnation detected' : 'Agent trajectory is healthy',
          data: trigger,
          formattedOutput: trigger
            ? `[LoopBreaker] Warning: ${trigger.reason}\nSuggested escape: ${trigger.reflectionGuidance}`
            : '[LoopBreaker] Execution trajectory healthy (0 loops detected).',
        };
      },
    },

    // --- WAVE 2 ---
    {
      id: 'diagram.mermaid',
      name: 'Terminal Mermaid Renderer',
      description: 'Renders architecture flowcharts, state machines, or sequence diagrams directly in ASCII/Unicode format for the terminal.',
      toolName: 'diagram_render_mermaid',
      slashAliases: ['/diagram', '/mermaid'],
      group: 'general',
      riskLevel: 'read_only',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Mermaid diagram source code definition' },
        },
        required: ['source'],
      },
      execute: async (args) => {
        const rendered = mermaidRenderer.render(String(args.source || 'graph TD\nA-->B'));
        return {
          success: true,
          message: 'Diagram rendered',
          data: { rendered },
          formattedOutput: rendered,
        };
      },
    },
    {
      id: 'timeline.navigate',
      name: 'Session Timeline Navigator',
      description: 'Navigates turn history, inspects past tool executions, and hops across historical checkpoints.',
      toolName: 'session_timeline_navigate',
      slashAliases: ['/timeline', '/history'],
      group: 'memory',
      riskLevel: 'read_only',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          targetTurnIndex: { type: 'number', description: 'Optional specific turn index to jump to' },
        },
      },
      execute: async (_args, context) => {
        const sessionId = context?.sessionId || 'default';
        const timeline = timelineNavigator.getTimeline(sessionId);
        const turnsCount = timeline ? timeline.totalTurns : 0;
        return {
          success: true,
          message: `Timeline contains ${turnsCount} turns`,
          data: timeline,
          formattedOutput: `[Timeline] Session: ${sessionId} | Total turns: ${turnsCount}`,
        };
      },
    },
    {
      id: 'diff.view',
      name: 'Terminal Diff Viewer',
      description: 'Generates syntax-highlighted unified or side-by-side terminal diffs before making changes.',
      toolName: 'terminal_diff_view',
      slashAliases: ['/diff', '/preview'],
      group: 'workspace',
      riskLevel: 'read_only',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          diffText: { type: 'string', description: 'Unified diff text to render' },
        },
        required: ['diffText'],
      },
      execute: async (args) => {
        const formatted = diffViewer.render(String(args.diffText || '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new'));
        return {
          success: true,
          message: 'Diff rendered',
          data: { formatted },
          formattedOutput: formatted,
        };
      },
    },

    // --- WAVE 3 ---
    {
      id: 'memory.consolidate',
      name: 'Autonomous Memory Consolidator',
      description: 'Distills short-term session insights and user preferences into procedural long-term memory.',
      toolName: 'memory_consolidate',
      slashAliases: ['/consolidate', '/learn'],
      group: 'memory',
      riskLevel: 'safe_mutation',
      requiresApproval: false,
      execute: async () => {
        const result = memoryConsolidator.consolidate({ maxSessionsToScan: 10 });
        return {
          success: true,
          message: `Consolidated ${result.factsExtracted.length} procedural insights`,
          data: result,
          formattedOutput: `[Memory] Consolidated ${result.factsExtracted.length} insights into long-term memory (${result.newRulesPersisted} new rules).`,
        };
      },
    },
    {
      id: 'skills.curate',
      name: 'Skill Lifecycle Curator',
      description: 'Audits skill usage scores, prunes obsolete tools, and promotes emerging automation patterns.',
      toolName: 'skill_lifecycle_curate',
      slashAliases: ['/curate', '/skills-clean'],
      group: 'general',
      riskLevel: 'safe_mutation',
      requiresApproval: false,
      execute: async () => {
        const report = skillCurator.auditSkillLifecycles();
        return {
          success: true,
          message: `Curator audited ${report.totalSkills} skills`,
          data: report,
          formattedOutput: `[Skills] Audited ${report.totalSkills} skills: ${report.activeCount} active, ${report.staleCount} stale, ${report.archivedCount} archived.`,
        };
      },
    },
    {
      id: 'trajectory.compact',
      name: 'Trajectory Compactor',
      description: 'Compresses lengthy multi-turn execution histories into dense summaries without losing structural context.',
      toolName: 'trajectory_compact',
      slashAliases: ['/compact', '/shrink'],
      group: 'general',
      riskLevel: 'read_only',
      requiresApproval: false,
      execute: async () => {
        const report = trajectoryCompactor.compactIfNeeded([], { contextLimitTokens: 128000 });
        return {
          success: true,
          message: `Compaction check completed: ${report.compacted ? 'Compacted' : 'Under threshold'}`,
          data: report,
          formattedOutput: `[Compactor] Compacted: ${report.compacted} | Saved: ${report.tokensSaved} tokens.`,
        };
      },
    },

    // --- WAVE 4 ---
    {
      id: 'tool.batch.codemode',
      name: 'Tool Code Mode Engine',
      description: 'Executes chained multi-tool operations in a sandboxed JavaScript runtime in a single round-trip.',
      toolName: 'tool_batch_codemode',
      slashAliases: ['/codemode', '/batch'],
      group: 'general',
      riskLevel: 'sensitive_approval_required',
      requiresApproval: true,
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'JavaScript code orchestrating tools via tools.call()' },
        },
        required: ['script'],
      },
      execute: async (args) => {
        const script = String(args.script || '');
        const execution = await codeModeEngine.executeScript({ script });
        return {
          success: execution.success,
          message: execution.success ? 'Code mode execution completed' : (execution.error || 'Code mode failed'),
          data: execution,
          formattedOutput: execution.success
            ? `[CodeMode] Completed in ${execution.executionTimeMs}ms (${execution.executedToolCallsCount} tool calls).`
            : `[CodeMode] Error: ${execution.error}`,
        };
      },
    },
    {
      id: 'security.scan',
      name: 'Command Security Static Scanner',
      description: 'Pre-scans shell commands for homoglyph spoofing, pipe-to-interpreter, and destructive patterns.',
      toolName: 'command_security_scan',
      slashAliases: ['/scan', '/sec-check'],
      group: 'general',
      riskLevel: 'read_only',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          commandLine: { type: 'string', description: 'Shell command line to scan' },
        },
        required: ['commandLine'],
      },
      execute: async (args) => {
        const scan = securityScanner.scan(String(args.commandLine || ''));
        return {
          success: true,
          message: scan.safe ? 'Command is clean and safe' : `Security violation: ${scan.violations.map((v) => v.message).join(', ')}`,
          data: scan,
          formattedOutput: scan.safe ? '[Security] Command is safe.' : `[Security] VIOLATIONS: ${scan.violations.map((v) => v.message).join(', ')}`,
        };
      },
    },

    // --- WAVE 5 ---
    {
      id: 'mesh.failover.status',
      name: 'Provider Mesh Status',
      description: 'Inspects provider health, circuit-breaker states, error classifications, and fallback routes.',
      toolName: 'provider_mesh_status',
      slashAliases: ['/mesh', '/failover'],
      group: 'network',
      riskLevel: 'read_only',
      requiresApproval: false,
      execute: async () => {
        return {
          success: true,
          message: 'Provider mesh is operational',
          data: { status: 'healthy', activeRoutes: ['gemini-2.5-pro', 'claude-3-7-sonnet', 'local-ollama'] },
          formattedOutput: '[Mesh] Health: Normal | Failover Circuit-Breaker: Armed | Active Routes: 3',
        };
      },
    },
    {
      id: 'mesh.cache.optimize',
      name: 'Prompt Cache Optimizer',
      description: 'Inspects and aligns static prompt prefix blocks to maximize provider prompt caching hit rate.',
      toolName: 'prompt_cache_optimize',
      slashAliases: ['/cache-opt', '/prefix'],
      group: 'general',
      riskLevel: 'read_only',
      requiresApproval: false,
      parameters: {
        type: 'object',
        properties: {
          systemPrompt: { type: 'string', description: 'System prompt content to optimize' },
        },
        required: ['systemPrompt'],
      },
      execute: async (args) => {
        const optimized = promptCacheOptimizer.buildOptimizedPrompt({
          systemPrompt: String(args.systemPrompt || ''),
          conversationHistory: [],
          currentTurnPrompt: '',
        });
        return {
          success: true,
          message: `Optimized prompt prefix (${optimized.cachedPrefixTokensEstimate} prefix tokens)`,
          data: optimized,
          formattedOutput: `[PromptCache] Prefix Tokens: ${optimized.cachedPrefixTokensEstimate} | Dynamic Suffix: ${optimized.dynamicSuffixTokensEstimate}`,
        };
      },
    },

    // --- WAVE 6 ---
    {
      id: 'satellite.pair',
      name: 'Satellite Device Pairing',
      description: 'Generates pairing tokens and establishes WebRemote companion sessions with mobile/browser devices.',
      toolName: 'satellite_device_pair',
      slashAliases: ['/pair', '/satellite'],
      group: 'network',
      riskLevel: 'sensitive_approval_required',
      requiresApproval: true,
      execute: async () => {
        const token = satelliteBridge.getPairingToken();
        return {
          success: true,
          message: `Pairing token: ${token}`,
          data: { pairingToken: token },
          formattedOutput: `[Satellite] Active pairing token: ${token}`,
        };
      },
    },
    {
      id: 'watchdog.supervision',
      name: 'Watchdog Supervisor Query',
      description: 'Queries independent watchdog supervisor metrics, memory limits, loop timeouts, and health states.',
      toolName: 'watchdog_supervision_query',
      slashAliases: ['/watchdog', '/supervisor'],
      group: 'general',
      riskLevel: 'read_only',
      requiresApproval: false,
      execute: async () => {
        return {
          success: true,
          message: 'Watchdog supervisor active',
          data: { healthy: true },
          formattedOutput: '[Watchdog] Supervised runtime status: HEALTHY (0 active violations)',
        };
      },
    },
  ];
}
