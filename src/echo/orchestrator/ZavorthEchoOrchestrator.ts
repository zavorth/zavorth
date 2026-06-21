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
        // The LLM sees these as regular tools alongside OS/IOT — it decides
        // autonomously when to use them based on the user's natural language intent.
        try {
            for (const tool of buildVerifiedActionHarnessTools(options.actionGateway)) {
                this.registerTool(tool);
            }
        } catch (error) {
            console.warn('[EchoOrchestrator] Failed to register web Action Harness tools:', error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Registra uma ferramenta no catalogo do Echo.
     */
    public registerTool(tool: IZavorthTool) {
        this.tools[tool.name] = tool;
    }

    /**
     * Retorna uma ferramenta pelo nome.
     */
    public getToolByName(name: string): IZavorthTool | null {
        return this.tools[name] || null;
    }

    /**
     * Lista todas as ferramentas registradas.
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
     * Retorna schemas filtrados por categoria.
     */
    public getSchemasForCategory(category: ToolCategory): ToolDefinition[] {
        const categoryTools = Object.values(this.tools).filter((tool) => tool.category === category);
        return ToolSchemaHelper.toToolDefinitions(categoryTools);
    }

    /**
     * Retorna o historico de execucoes capturado apenas em modo standalone.
     */
    public getExecutionLog(limit?: number): EchoExecutionEntry[] {
        if (!this.capturePipelineHistory) {
            return [];
        }
        return this.compatibilityLog.list(limit);
    }

    /**
     * Registra eventos Echo fora da execucao direta da tool.
     * No runtime principal o ledger canonico assume esse papel.
     */
    public recordExecution(entry: EchoExecutionEntry): void {
        if (!this.capturePipelineHistory) {
            return;
        }
        this.compatibilityLog.append(entry);
    }

    /**
     * Pipeline de execucao de tool apos function calling.
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
                toolCall.result = `Ferramenta ${functionName} nao existe.`;
                this.logExecution(originalPrompt, [toolCall], 'error', startTime);
                return { response: `Erro: A ferramenta ${functionName} nao existe.` };
            }

            const safeParams = SecurityEngine.authorizeExecution(originalPrompt, tool, rawParams);
            const result = await tool.execute(safeParams, context);
            toolCall.durationMs = Date.now() - startTime;
            toolCall.data = result.data;

            if (result.success) {
                toolCall.result = result.message || 'Sucesso';
                this.logExecution(originalPrompt, [toolCall], 'success', startTime);
                return { response: `OK: ${result.message}`, data: result.data };
            }

            toolCall.result = result.error || 'Falha';
            this.logExecution(originalPrompt, [toolCall], 'error', startTime);
            return { response: `FALHA NA FERRAMENTA: ${result.error}`, data: result.data };
        } catch (error: any) {
            toolCall.securityDecision = 'blocked';
            toolCall.result = error.message;
            toolCall.durationMs = Date.now() - startTime;
            this.logExecution(originalPrompt, [toolCall], 'blocked', startTime);
            return { response: `BLOCO DE SEGURANCA. Responda ao usuario com esta justificativa: ${error.message}` };
        }
    }

    /**
     * Registra execucao em historico de compatibilidade apenas no modo standalone.
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
