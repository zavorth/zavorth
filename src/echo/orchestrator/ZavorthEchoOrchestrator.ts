import { IZavorthTool, ToolCategory } from '../types/IZavorthTool';
import { ToolSchemaHelper } from '../types/ToolSchemaHelper';
import { SecurityEngine } from '../security/SecurityEngine';
import { SystemOpenAppTool } from '../tools/os/SystemOpenAppTool';
import { SystemMediaTool } from '../tools/os/SystemMediaTool';
import { SystemInfoTool } from '../tools/os/SystemInfoTool';
import { SystemScreenshotTool } from '../tools/os/SystemScreenshotTool';
import { SystemVisionAnalysisTool } from '../tools/os/SystemVisionAnalysisTool.js';
import { HomeAssistantBridge } from '../tools/iot/HomeAssistantBridge';
import { MQTTPublisher } from '../tools/iot/MQTTPublisher';
import { PlaywrightActionTool } from '../tools/browser/PlaywrightActionTool';
import { buildVerifiedActionHarnessTools } from '../tools/web/ActionHarnessTools.js';
import type { ToolDefinition } from '../../providers/ILlmProvider';
import type { EchoExecutionEntry, EchoToolCall } from '../types/EchoTypes';
import { EchoCompatibilityExecutionLogService } from '../../domain/execution/infrastructure/EchoCompatibilityExecutionLogService.js';
import type { ZavorthActionGateway } from '../../runtime/actions/ZavorthActionGateway.js';
import { asErrorLike } from '../../utils/errorLike.js';

type ZavorthEchoOrchestratorOptions = {
    capturePipelineHistory?: boolean;
    compatibilityLog?: Pick<EchoCompatibilityExecutionLogService, 'append' | 'list'>;
    startBackgroundBridges?: boolean;
    actionGateway?: ZavorthActionGateway;
};

export class ZavorthEchoOrchestrator {
    private tools: Record<string, IZavorthTool> = {};
    private readonly capturePipelineHistory: boolean;
    private readonly compatibilityLog: Pick<EchoCompatibilityExecutionLogService, 'append' | 'list'>;
    private readonly startBackgroundBridges: boolean;

    constructor(options: ZavorthEchoOrchestratorOptions = {}) {
        this.capturePipelineHistory = options.capturePipelineHistory !== false;
        this.compatibilityLog = options.compatibilityLog || new EchoCompatibilityExecutionLogService();
        this.startBackgroundBridges = options.startBackgroundBridges !== false;

        this.registerTool(new SystemOpenAppTool());
        this.registerTool(new SystemMediaTool());
        this.registerTool(new SystemInfoTool());
        this.registerTool(new SystemScreenshotTool());
        this.registerTool(new SystemVisionAnalysisTool());

        const haBridge = new HomeAssistantBridge();
        this.registerTool(haBridge);
        if (this.startBackgroundBridges) {
            haBridge.startListeningEvents();
        }
        this.registerTool(new MQTTPublisher());

        this.registerTool(new PlaywrightActionTool());

        // Register web/browser Action Harness tools.
        // The LLM sees these as regular tools alongside OS/IOT and decides
        // autonomously when to use them based on the user's natural language intent.
        try {
            for (const tool of buildVerifiedActionHarnessTools(options.actionGateway)) {
                this.registerTool(tool);
            }
        } catch (error: unknown) {
          const err = asErrorLike(error);
          console.warn('[EchoOrchestrator] Failed to register web Action Harness tools:', error instanceof Error ? err.message : String(error));
        }
    }

    /**
     * Registers a tool in the Echo catalog.
     */
    public registerTool(tool: IZavorthTool) {
        this.tools[tool.name] = tool;
    }

    /**
     * Returns a tool by name.
     */
    public getToolByName(name: string): IZavorthTool | null {
        return this.tools[name] || null;
    }

    /**
     * Lists all registered tools.
     */
    public listAllTools(): ToolDefinition[] {
        return ToolSchemaHelper.toToolDefinitions(Object.values(this.tools));
    }

    /**
     * Returns live tool instances so surface projections can inspect capability
     * lifecycle without reopening a second runtime tree.
     */
    public listRegisteredTools(): IZavorthTool[] {
        return Object.values(this.tools);
    }

    /**
     * Returns schemas filtered by category.
     */
    public getSchemasForCategory(category: ToolCategory): ToolDefinition[] {
        const categoryTools = Object.values(this.tools).filter((tool) => tool.category === category);
        return ToolSchemaHelper.toToolDefinitions(categoryTools);
    }

    /**
     * Returns captured execution history in standalone mode only.
     */
    public getExecutionLog(limit?: number): EchoExecutionEntry[] {
        if (!this.capturePipelineHistory) {
            return [];
        }
        return this.compatibilityLog.list(limit);
    }

    /**
     * Records Echo events outside direct tool execution.
     * In the main runtime, the canonical ledger owns this role.
     */
    public recordExecution(entry: EchoExecutionEntry): void {
        if (!this.capturePipelineHistory) {
            return;
        }
        this.compatibilityLog.append(entry);
    }

    /**
     * Tool execution pipeline after function calling.
     */
    public async executePipeline(
        originalPrompt: string,
        functionName: string,
        rawParams: any,
        context?: Record<string, any>,
    ): Promise<{ response: string; data?: any }> {
        const startTime = Date.now();
        const toolCall: EchoToolCall = {
            toolName: functionName,
            args: rawParams,
            securityDecision: 'approved',
            result: '',
            durationMs: 0,
        };

        try {
            const tool = this.tools[functionName];
            if (!tool) {
                toolCall.securityDecision = 'blocked';
                toolCall.result = `Tool ${functionName} does not exist.`;
                this.logExecution(originalPrompt, [toolCall], 'error', startTime);
                return { response: `Error: tool ${functionName} does not exist.` };
            }

            const safeParams = SecurityEngine.authorizeExecution(originalPrompt, tool, rawParams);
            const result = await tool.execute(safeParams, context);
            toolCall.durationMs = Date.now() - startTime;
            toolCall.data = result.data;

            if (result.success) {
                toolCall.result = result.message || 'Success';
                this.logExecution(originalPrompt, [toolCall], 'success', startTime);
                return { response: `OK: ${result.message}`, data: result.data };
            }

            toolCall.result = result.error || 'Failure';
            this.logExecution(originalPrompt, [toolCall], 'error', startTime);
            return { response: `TOOL FAILURE: ${result.error}`, data: result.data };
        } catch (error: unknown) {
          const err = asErrorLike(error);
          toolCall.securityDecision = 'blocked';
            toolCall.result = err.message;
            toolCall.durationMs = Date.now() - startTime;
            this.logExecution(originalPrompt, [toolCall], 'blocked', startTime);
            return { response: `SECURITY BLOCK. Respond to the user with this justification: ${err.message}` };
        }
    }

    /**
     * Records execution in compatibility history in standalone mode only.
     */
    private logExecution(
        prompt: string,
        toolCalls: EchoToolCall[],
        status: EchoExecutionEntry['status'],
        startTime: number,
    ): void {
        if (!this.capturePipelineHistory) {
            return;
        }
        this.compatibilityLog.append({
            id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            prompt,
            llmRaw: null,
            toolCalls,
            finalResponse: toolCalls.map((toolCall) => toolCall.result).join('; '),
            status,
            durationMs: Date.now() - startTime,
        });
    }
}
