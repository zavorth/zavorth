export type McpToolAuditLevel = "none" | "summary" | "full";

export interface McpToolDefinition {
  name: string;
  description: string;
  scopes: string[];
  phase: string;
  auditLevel: McpToolAuditLevel;
  sourceEndpoints: string[];
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "get_status",
    description: "Get the current gateway and MCP server status including transport and heartbeat.",
    scopes: ["status:read"],
    phase: "stable",
    auditLevel: "summary",
    sourceEndpoints: ["/api/mcp/status"],
  },
  {
    name: "get_audit_log",
    description: "Query the MCP tool audit log with filtering by tool, success, and API key.",
    scopes: ["audit:read"],
    phase: "stable",
    auditLevel: "summary",
    sourceEndpoints: ["/api/mcp/audit"],
  },
  {
    name: "get_audit_stats",
    description: "Get aggregate audit statistics including success rate and top tools.",
    scopes: ["audit:read"],
    phase: "stable",
    auditLevel: "summary",
    sourceEndpoints: ["/api/mcp/audit/stats"],
  },
  {
    name: "list_tools",
    description: "List all available MCP tools exposed by the gateway.",
    scopes: ["tools:read"],
    phase: "stable",
    auditLevel: "none",
    sourceEndpoints: ["/api/mcp/tools"],
  },
  {
    name: "get_tags",
    description: "Get the currently available Ollama model tags from the local catalog.",
    scopes: ["models:read"],
    phase: "stable",
    auditLevel: "none",
    sourceEndpoints: ["/api/tags"],
  },
  {
    name: "translate_request",
    description: "Translate an API request between provider formats.",
    scopes: ["translator:write"],
    phase: "beta",
    auditLevel: "summary",
    sourceEndpoints: ["/api/translator/translate"],
  },
  {
    name: "get_diversity_report",
    description: "Get the provider diversity report for auto-combo routing.",
    scopes: ["analytics:read"],
    phase: "beta",
    auditLevel: "summary",
    sourceEndpoints: ["/api/analytics/diversity"],
  },
];

export const MCP_TOOL_MAP: Record<string, McpToolDefinition> = Object.fromEntries(
  MCP_TOOLS.map((tool) => [tool.name, tool])
);
