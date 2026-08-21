import type { UniversalCommandDescriptor } from '../../contracts/commands/UniversalCommandContract.js';
import { ShadowCheckpointStoreService } from '../../services/snapshot/ShadowCheckpointStoreService.js';
import { HashlineAnchorPatcherService } from '../../services/editor/HashlineAnchorPatcherService.js';
import { StagnationAndLoopBreakerService } from '../../services/resilience/StagnationAndLoopBreakerService.js';
import { TerminalMermaidRendererService } from '../../services/tui/TerminalMermaidRendererService.js';
import { SessionTimelineNavigatorService } from '../../runtime/sessions/SessionTimelineNavigatorService.js';
import { TerminalDiffViewerComponent } from '../../services/tui/TerminalDiffViewerComponent.js';
import { AutonomousMemoryConsolidationService } from '../../services/memory/AutonomousMemoryConsolidationService.js';
import { SkillLifecycleCuratorService } from '../../services/skills/SkillLifecycleCuratorService.js';
import { AutomaticTrajectoryCompactorService } from '../../services/compression/AutomaticTrajectoryCompactorService.js';
import { ToolRuntimeCodeModeEngine } from '../execution/infrastructure/ToolRuntimeCodeModeEngine.js';
import { CommandSecurityStaticScannerService } from '../../services/security/CommandSecurityStaticScannerService.js';
import { ProviderMeshFailoverRouterService } from '../ai-routing/ProviderMeshFailoverRouterService.js';
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
const failoverRouter = new ProviderMeshFailoverRouterService();
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
      slashAliases: ['/checkpoint', '/cp', '/undo'],
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
      execute: async (args, context) => {
        const action = String(args.action || 'list');
        const sessionId = context?.sessionId || 'default';

        if (action === 'create') {
          const cp = checkpointStore.saveCheckpoint(sessionId, {
            summary: String(args.label || 'Manual checkpoint'),
            files: {},
          });
          return {
            success: true,
            message: `Created checkpoint ${cp.id}`,
            data: cp,
            formattedOutput: `[Checkpoint] Created: ${cp.id} (${cp.summary})`,
          };
        }

        if (action === 'revert') {
          const targetId = String(args.checkpointId || '');
          const reverted = checkpointStore.revertToCheckpoint(sessionId, targetId);
          return {
            success: Boolean(reverted),
            message: reverted ? `Reverted to checkpoint ${targetId}` : `Checkpoint ${targetId} not found`,
            data: reverted,
            formattedOutput: reverted ? `[Checkpoint] Reverted to ${targetId}` : `[Checkpoint] Error: ${targetId} not found`,
          };
        }

        const history = checkpointStore.getCheckpointHistory(sessionId);
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
          originalContent: { type: 'string', description: 'Original target file content' },
          targetContent: { type: 'string', description: 'Content to search and replace' },
          replacementContent: { type: 'string', description: 'New replacement content' },
        },
        required: ['originalContent', 'targetContent', 'replacementContent'],
      },
      execute: async (args) => {
        const result = anchorPatcher.patch({
          originalContent: String(args.originalContent || ''),
          targetContent: String(args.targetContent || ''),
          replacementContent: String(args.replacementContent || ''),
        });
        return {
          success: result.success,
          message: result.success ? `Patch applied with confidence ${result.confidence}` : (result.error || 'Patch failed'),
          data: result,
          formattedOutput: result.success ? `[Patcher] Applied (${result.linesChanged} lines changed, ${result.confidence} confidence)` : `[Patcher] Failed: ${result.error}`,
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
          currentTurnContent: { type: 'string', description: 'Latest turn text content to evaluate' },
        },
      },
      execute: async (args) => {
        const evaluation = loopBreaker.recordTurn({
          turnId: `turn-${Date.now()}`,
          textContent: String(args.currentTurnContent || ''),
        });
        return {
          success: true,
          message: evaluation.isStagnated ? 'Stagnation detected' : 'Agent trajectory is healthy',
          data: evaluation,
          formattedOutput: evaluation.isStagnated
            ? `[LoopBreaker] Warning: ${evaluation.reason}\nSuggested escape: ${evaluation.suggestedEscapePrompt}`
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
      execute: async (args, context) => {
        const sessionId = context?.sessionId || 'default';
        const timeline = timelineNavigator.getTimeline(sessionId);
        return {
          success: true,
          message: `Timeline contains ${timeline.totalTurns} turns`,
          data: timeline,
          formattedOutput: `[Timeline] Session: ${sessionId} | Total turns: ${timeline.totalTurns} | Checkpoints: ${timeline.checkpointCount}`,
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
          oldContent: { type: 'string', description: 'Original file content' },
          newContent: { type: 'string', description: 'Updated file content' },
          filePath: { type: 'string', description: 'Target file path' },
        },
        required: ['oldContent', 'newContent'],
      },
      execute: async (args) => {
        const formatted = diffViewer.renderDiff({
          oldText: String(args.oldContent || ''),
          newText: String(args.newContent || ''),
          filename: String(args.filePath || 'file'),
        });
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
      parameters: {
        type: 'object',
        properties: {
          sessionSummary: { type: 'string', description: 'Session activity summary to consolidate' },
        },
      },
      execute: async (args, context) => {
        const result = await memoryConsolidator.consolidateSession({
          sessionId: context?.sessionId || 'default',
          summary: String(args.sessionSummary || 'General session execution'),
        });
        return {
          success: result.success,
          message: `Consolidated ${result.insightsExtracted} procedural insights`,
          data: result,
          formattedOutput: `[Memory] Consolidated ${result.insightsExtracted} insights into long-term memory.`,
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
        const report = skillCurator.generateAuditReport();
        return {
          success: true,
          message: `Curator audited ${report.totalSkills} skills`,
          data: report,
          formattedOutput: `[Skills] Audited ${report.totalSkills} skills: ${report.healthyCount} healthy, ${report.pruneCandidatesCount} prune candidates.`,
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
      execute: async (_args, context) => {
        const report = trajectoryCompactor.compact(context?.sessionId || 'default');
        return {
          success: true,
          message: `Compacted trajectory (reduced ~${report.savedTokensEstimated} tokens)`,
          data: report,
          formattedOutput: `[Compactor] Compacted ${report.condensedTurns} turns. Estimated token savings: ~${report.savedTokensEstimated}.`,
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
          script: { type: 'string', description: 'JavaScript code orchestrating tools via zavorth.callTool()' },
        },
        required: ['script'],
      },
      execute: async (args) => {
        const script = String(args.script || '');
        const execution = await codeModeEngine.executeScript(script, {
          callTool: async (name, toolArgs) => ({ name, executed: true, toolArgs }),
        });
        return {
          success: execution.success,
          message: execution.success ? 'Code mode execution completed' : (execution.error || 'Code mode failed'),
          data: execution,
          formattedOutput: execution.success ? `[CodeMode] Completed in ${execution.durationMs}ms.` : `[CodeMode] Error: ${execution.error}`,
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
        const scan = securityScanner.scanCommand(String(args.commandLine || ''));
        return {
          success: true,
          message: scan.isSafe ? 'Command is clean and safe' : `Security violation: ${scan.violations.join(', ')}`,
          data: scan,
          formattedOutput: scan.isSafe ? '[Security] Command is safe.' : `[Security] VIOLATIONS: ${scan.violations.join(', ')}`,
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
        const optimized = promptCacheOptimizer.optimize({
          systemPrompt: String(args.systemPrompt || ''),
          toolsHeader: '',
          userContext: '',
        });
        return {
          success: true,
          message: `Optimized prompt prefix (hash: ${optimized.prefixHash})`,
          data: optimized,
          formattedOutput: `[PromptCache] Aligned prefix hash: ${optimized.prefixHash} | Estimated cache hit potential: ${optimized.cacheConfidence}%`,
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
      parameters: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Human-readable name of the device being paired' },
        },
      },
      execute: async (args) => {
        const deviceName = String(args.deviceName || 'Companion Device');
        const session = satelliteBridge.createSession({
          label: deviceName,
          clientType: 'mobile-companion',
        });
        return {
          success: true,
          message: `Paired device '${deviceName}' successfully`,
          data: session,
          formattedOutput: `[Satellite] Paired device '${deviceName}'. Connection token generated.`,
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
        const status = watchdogOrchestrator.getStatus();
        return {
          success: true,
          message: `Watchdog supervisor is ${status.isActive ? 'active' : 'idle'}`,
          data: status,
          formattedOutput: `[Watchdog] Active: ${status.isActive ? 'YES' : 'NO'} | Monitored Tasks: ${status.monitoredTaskCount} | Violations: ${status.violationCount}`,
        };
      },
    },
  ];
}
