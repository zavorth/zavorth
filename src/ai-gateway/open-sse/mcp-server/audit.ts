import { getDbInstance } from "@/lib/db/core";

export interface McpAuditEntry {
  id: number;
  toolName: string;
  inputHash: string | null;
  outputSummary: string | null;
  durationMs: number | null;
  apiKeyId: string | null;
  success: boolean;
  errorCode: string | null;
  createdAt: string;
}

export interface McpAuditQuery {
  limit: number;
  offset: number;
  tool?: string;
  success?: boolean;
  apiKeyId?: string;
}

export interface McpAuditPage {
  entries: McpAuditEntry[];
  total: number;
}

export interface McpAuditStats {
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
  topTools: { toolName: string; count: number }[];
}

function mapAuditRow(row: Record<string, unknown>): McpAuditEntry {
  return {
    id: typeof row.id === "number" ? row.id : Number(row.id) || 0,
    toolName: typeof row.tool_name === "string" ? row.tool_name : "",
    inputHash: typeof row.input_hash === "string" ? row.input_hash : null,
    outputSummary: typeof row.output_summary === "string" ? row.output_summary : null,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null,
    apiKeyId: typeof row.api_key_id === "string" ? row.api_key_id : null,
    success: row.success === 1 || row.success === true,
    errorCode: typeof row.error_code === "string" ? row.error_code : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export async function queryAuditEntries(query: McpAuditQuery): Promise<McpAuditPage> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.tool) {
    conditions.push("tool_name = ?");
    params.push(query.tool);
  }
  if (query.success !== undefined) {
    conditions.push("success = ?");
    params.push(query.success ? 1 : 0);
  }
  if (query.apiKeyId) {
    conditions.push("api_key_id = ?");
    params.push(query.apiKeyId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = getDbInstance();
  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM mcp_tool_audit ${where}`)
    .get(...params) as { cnt: number };
  const rows = db
    .prepare(
      `
      SELECT * FROM mcp_tool_audit
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `
    )
    .all(...params, query.limit, query.offset) as Array<Record<string, unknown>>;

  return {
    entries: rows.map(mapAuditRow),
    total: totalRow?.cnt ?? 0,
  };
}

export async function getAuditStats(): Promise<McpAuditStats> {
  const db = getDbInstance();

  const totals = db
    .prepare(
      `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as ok,
        AVG(duration_ms) as avgMs
      FROM mcp_tool_audit
      `
    )
    .get() as { total: number; ok: number; avgMs: number };

  const topRows = db
    .prepare(
      `
      SELECT tool_name, COUNT(*) as count
      FROM mcp_tool_audit
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 10
      `
    )
    .all() as Array<{ tool_name: string; count: number }>;

  const total = totals?.total ?? 0;
  const ok = totals?.ok ?? 0;

  return {
    totalCalls: total,
    successRate: total > 0 ? ok / total : 1,
    avgDurationMs: typeof totals?.avgMs === "number" ? totals.avgMs : 0,
    topTools: topRows.map((r) => ({ toolName: r.tool_name, count: r.count })),
  };
}
