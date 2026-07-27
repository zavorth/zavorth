import { SkillHandler } from "./types";

export const builtinSkills: Record<string, SkillHandler> = {
  file_read: async (input, context) => {
    const { path } = input as { path: string };
    if (!path || typeof path !== "string") {
      throw new Error("Missing required field: path");
    }
    return { success: false, path, error: "No file-read adapter is connected to this gateway.", context: context.apiKeyId };
  },

  file_write: async (input, context) => {
    const { path, content } = input as { path: string; content: string };
    if (!path || !content) {
      throw new Error("Missing required fields: path, content");
    }
    return { success: false, path, requestedBytes: content.length, error: "No file-write adapter is connected to this gateway.", context: context.apiKeyId };
  },

  http_request: async (input, context) => {
    const { url, method = "GET" } = input as { url: string; method?: string };
    if (!url) {
      throw new Error("Missing required field: url");
    }
    return { success: false, url, method, error: "No HTTP adapter is connected to this gateway.", context: context.apiKeyId };
  },

  web_search: async (input, context) => {
    const { query, limit = 10 } = input as { query: string; limit?: number };
    if (!query) {
      throw new Error("Missing required field: query");
    }
    return {
      success: false,
      query,
      results: [],
      error: "No search adapter is connected to this gateway.",
      context: context.apiKeyId,
    };
  },

  eval_code: async (input, context) => {
    const { code, language = "javascript" } = input as { code: string; language?: string };
    if (!code) {
      throw new Error("Missing required field: code");
    }
    return { success: false, language, error: "No code execution adapter is connected to this gateway.", context: context.apiKeyId };
  },

  execute_command: async (input, context) => {
    const { command, args = [] } = input as { command: string; args?: string[] };
    if (!command) {
      throw new Error("Missing required field: command");
    }
    return {
      success: false,
      command,
      args,
      error: "No command execution adapter is connected to this gateway.",
      context: context.apiKeyId,
    };
  },
};

export function registerBuiltinSkills(executor: any): void {
  for (const [name, handler] of Object.entries(builtinSkills)) {
    executor.registerHandler(name, handler);
  }
}
