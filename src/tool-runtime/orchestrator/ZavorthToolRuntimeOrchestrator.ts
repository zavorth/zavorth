import { IZavorthTool, ToolCategory, type ToolExecutionResult } from '../types/IZavorthTool';
import { logger } from '../../logger.js';
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
import type { ProfileAccessGate } from '../tools/browser/ProfileAccessGateContract.js';
import { buildVerifiedActionHarnessTools } from '../tools/web/ActionHarnessTools.js';
import type { ToolDefinition } from '../../providers/ILlmProvider';
import type { EchoExecutionEntry, EchoToolCall } from '../types/EchoTypes';
import { EchoCompatibilityExecutionLogService } from '../../domain/execution/infrastructure/EchoCompatibilityExecutionLogService.js';
import type { ZavorthActionGateway } from '../../runtime/actions/ZavorthActionGateway.js';
import { decideSecurityPolicy } from '../../security/SecurityPolicyBroker.js';
import {
    OperatorContinuityKernel,
    decisionFromBroker,
    digestOperatorPayload,
    resultFromToolOutcome,
    type OperatorContinuityEnvelope,
} from '../../runtime/operator/OperatorContinuityEnvelope.js';
import { asErrorLike } from '../../utils/errorLike.js';

type ZavorthEchoOrchestratorOptions = {
    capturePipelineHistory?: boolean;
    compatibilityLog?: Pick<EchoCompatibilityExecutionLogService, 'append' | 'list'>;
    startBackgroundBridges?: boolean;
    actionGateway?: ZavorthActionGateway;
    continuityKernel?: OperatorContinuityKernel;
    profileAccessGate?: ProfileAccessGate | null;
};

export class ZavorthEchoOrchestrator {
    private tools: Record<string, IZavorthTool> = {};
    private readonly capturePipelineHistory: boolean;
    private readonly compatibilityLog: Pick<EchoCompatibilityExecutionLogService, 'append' | 'list'>;
    private readonly startBackgroundBridges: boolean;
    private readonly continuityKernel: OperatorContinuityKernel;
    private lastContinuityEnvelope: OperatorContinuityEnvelope | null = null;

    constructor(options: ZavorthEchoOrchestratorOptions = {}) {
        this.capturePipelineHistory = options.capturePipelineHistory !== false;
        this.compatibilityLog = options.compatibilityLog || new EchoCompatibilityExecutionLogService();
        this.startBackgroundBridges = options.startBackgroundBridges !== false;
        this.continuityKernel = options.continuityKernel || new OperatorContinuityKernel();

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

        this.registerTool(new PlaywrightActionTool(undefined, options.profileAccessGate ?? null));

        // Register web/browser Action Harness tools.
        // The LLM sees these as regular tools alongside OS/IOT and decides
        // autonomously when to use them based on the user's natural language intent.
        try {
            for (const tool of buildVerifiedActionHarnessTools(options.actionGateway)) {
                this.registerTool(tool);
            }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn(`[EchoOrchestrator] Failed to register web Action Harness tools: ${message}`);
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

    public getLastContinuityEnvelope(): OperatorContinuityEnvelope | null {
        return this.lastContinuityEnvelope;
    }

    /**
     * Tool execution pipeline after function calling.
     */
    public async executePipeline(
        originalPrompt: string,
        functionName: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawParams: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: Record<string, any>,
    ): Promise<{ response: string; // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any }> {
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

            const result = await this.executeToolWithContinuity(
                originalPrompt,
                tool,
                functionName,
                rawParams,
                context,
            );
            toolCall.durationMs = Date.now() - startTime;
            toolCall.data = result.data;

            if (result.success) {
                toolCall.result = result.message || 'Success';
                this.logExecution(originalPrompt, [toolCall], 'success', startTime);
                return { response: `OK: ${result.message}`, data: result.data };
            }

            const continuityStatus = result.data && typeof result.data === 'object'
                ? String((result.data as { operatorContinuity?: { status?: string | null } }).operatorContinuity?.status || '')
                : '';
            if (
                continuityStatus === 'blocked'
                || continuityStatus === 'approval_required'
                || (result.error && /^(SanitizationBlock|SchemaValidationBlock|SandboxBlock):/u.test(result.error))
            ) {
                toolCall.securityDecision = 'blocked';
                toolCall.result = result.error || 'Blocked by operator continuity.';
                this.logExecution(originalPrompt, [toolCall], 'blocked', startTime);
                return {
                    response: `SECURITY BLOCK. Respond to the user with this justification: ${toolCall.result}`,
                    data: result.data,
                };
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

    private async executeToolWithContinuity(
        originalPrompt: string,
        tool: IZavorthTool,
        functionName: string,
        rawParams: unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: Record<string, any>,
    ): Promise<ToolExecutionResult> {
        let safeParams: Record<string, unknown> | null = null;
        const actorId = String(context?.traceId || context?.actorId || '').trim() || null;
        const sealed = await this.continuityKernel.runMutation({
            request: {
                surface: 'echo',
                operation: 'echo.tool.execute',
                target: functionName,
                actorId,
                sourceSurface: String(context?.sourceSurface || 'echo').trim() || 'echo',
                argsDigest: digestOperatorPayload(rawParams),
                metadata: {
                    category: tool.category,
                    dangerLevel: tool.dangerLevel,
                    requiresPermission: tool.requiresPermission,
                },
            },
            correlation: {
                toolCallId: String(context?.toolCallId || '').trim() || null,
                runId: String(context?.runId || '').trim() || null,
                sessionId: String(context?.sessionId || '').trim() || null,
                taskId: String(context?.taskId || '').trim() || null,
                traceId: String(context?.traceId || '').trim() || null,
            },
            decide: () => {
                try {
                    safeParams = SecurityEngine.authorizeExecution(originalPrompt, tool, rawParams);
                    return decisionFromBroker(decideSecurityPolicy({
                        surface: 'tool',
                        operation: 'echo.tool.execute',
                        target: functionName,
                        sourceTrust: 'trusted-user',
                        metadata: {
                            sourceSurface: 'echo',
                            actorId,
                            category: tool.category,
                            dangerLevel: tool.dangerLevel,
                        },
                        toolDecision: {
                            action: 'allow',
                            allowed: true,
                            risk: tool.dangerLevel === 'dangerous' ? 'review' : 'safe',
                            toolName: functionName,
                            surface: 'native-tool',
                            capabilities: ['audit'],
                            requiresConfirmation: false,
                            reasons: [
                                'Echo tool execution is authorized by SecurityEngine and sealed by operator continuity.',
                            ],
                            rule: 'ECHO_TOOL_CONTINUITY',
                        },
                        reasons: [
                            'Echo tool execution was sealed by the operator continuity kernel.',
                        ],
                    }));
                } catch (error: unknown) {
                    const err = asErrorLike(error);
                    return decisionFromBroker(decideSecurityPolicy({
                        surface: 'tool',
                        operation: 'echo.tool.execute',
                        target: functionName,
                        blocked: true,
                        risk: 'forbidden',
                        rule: 'ECHO_SECURITY_ENGINE_BLOCK',
                        reasons: [err.message || String(error)],
                        metadata: {
                            sourceSurface: 'echo',
                            actorId,
                        },
                    }));
                }
            },
            execute: async () => tool.execute(safeParams || {}, context),
            mapResult: (value) => resultFromToolOutcome({
                ok: value.success === true,
                status: value.success ? 'applied' : 'failed',
                summary: value.success
                    ? (value.message || `Echo tool ${functionName} executed successfully.`)
                    : (value.error || value.message || `Echo tool ${functionName} failed.`),
                output: value.data ?? value.message ?? value.error,
                data: {
                    tool: functionName,
                    success: value.success === true,
                },
            }),
        });

        this.lastContinuityEnvelope = sealed.envelope;
        const publicView = this.continuityKernel.toPublicView(sealed.envelope);

        if (!sealed.envelope.decision?.allowed || sealed.value === undefined) {
            const summary = sealed.envelope.result?.summary
                || sealed.envelope.decision?.reasons.join(' ')
                || `Tool ${functionName} blocked by operator continuity.`;
            return {
                success: false,
                error: summary,
                data: { operatorContinuity: publicView },
            };
        }

        const value = sealed.value;
        return {
            ...value,
            data: {
                ...(value.data && typeof value.data === 'object' ? value.data : value.data !== undefined ? { value: value.data } : {}),
                operatorContinuity: publicView,
            },
        };
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

export { ZavorthEchoOrchestrator as ZavorthToolRuntimeOrchestrator };
