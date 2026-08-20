import * as vm from 'node:vm';
import { ToolRegistry } from '../../../tools/ToolRegistry.js';

export interface CodeModeExecutionInput {
  readonly script: string;
  readonly timeoutMs?: number;
  readonly toolRegistry?: ToolRegistry;
  readonly contextVariables?: Record<string, unknown>;
}

export interface CodeModeExecutionResult {
  readonly success: boolean;
  readonly returnValue: unknown;
  readonly logs: readonly string[];
  readonly executedToolCallsCount: number;
  readonly executionTimeMs: number;
  readonly error?: string;
}

export class ToolRuntimeCodeModeEngine {
  private readonly defaultToolRegistry: ToolRegistry;

  constructor(toolRegistry = new ToolRegistry()) {
    this.defaultToolRegistry = toolRegistry;
  }

  public async executeScript(input: CodeModeExecutionInput): Promise<CodeModeExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    let executedToolCallsCount = 0;
    const registry = input.toolRegistry || this.defaultToolRegistry;
    const timeoutMs = input.timeoutMs || 15000;

    const toolsBridge = {
      call: async (toolName: string, params: Record<string, unknown> = {}): Promise<unknown> => {
        executedToolCallsCount++;
        const tool = registry.getTool(toolName);
        if (!tool) {
          throw new Error(`Tool '${toolName}' is not registered in ToolRegistry.`);
        }
        const rawResult = await tool.execute(params);
        try {
          return JSON.parse(rawResult);
        } catch {
          return rawResult;
        }
      },
      readFile: async (filePath: string): Promise<unknown> => {
        return toolsBridge.call('read_file', { path: filePath });
      },
      writeFile: async (filePath: string, content: string): Promise<unknown> => {
        return toolsBridge.call('create_file', { path: filePath, content });
      },
      listDirectory: async (dirPath = '.'): Promise<unknown> => {
        return toolsBridge.call('list_directory', { path: dirPath });
      },
      grep: async (query: string, searchPath = '.'): Promise<unknown> => {
        return toolsBridge.call('deep_search', { query, path: searchPath });
      },
    };

    const sandbox = {
      tools: toolsBridge,
      console: {
        log: (...args: unknown[]) => {
          logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
        },
        warn: (...args: unknown[]) => {
          logs.push(`[WARN] ${args.map((a) => String(a)).join(' ')}`);
        },
        error: (...args: unknown[]) => {
          logs.push(`[ERROR] ${args.map((a) => String(a)).join(' ')}`);
        },
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      ...(input.contextVariables || {}),
    };

    const context = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });

    // Wrap script inside an async IIFE
    const wrappedScript = `(async () => {\n${input.script}\n})()`;

    try {
      const script = new vm.Script(wrappedScript, {
        filename: 'code_mode_runtime.js',
      });

      const promise = script.runInContext(context, {
        timeout: timeoutMs,
        displayErrors: true,
      });

      const returnValue = await promise;
      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        returnValue,
        logs,
        executedToolCallsCount,
        executionTimeMs,
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        returnValue: null,
        logs,
        executedToolCallsCount,
        executionTimeMs,
        error: message,
      };
    }
  }
}
