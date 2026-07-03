import { getDbInstance } from "@/lib/db/core";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";
import { redactExportedLogRows } from "@/lib/logExportRedaction";
import { safeParseIntBounded } from "@/shared/utils/safeParseInt";

/**
 * GET /api/logs/export — export logs as JSON
 * Query params: ?hours=24 (1, 6, 12, 24; default 24)
 *               &type=call-logs|request-logs|proxy-logs (default call-logs)
 */
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const hours = safeParseIntBounded(searchParams.get("hours"), 24, 1, 168);
    const logType = searchParams.get("type") || "call-logs";

    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const db = getDbInstance();

    let rows: unknown[] = [];
    let tableName = "";

    if (logType === "call-logs" || logType === "request-logs") {
      tableName = "call_logs";
      const stmt = db.prepare(
        "SELECT * FROM call_logs WHERE timestamp >= @since ORDER BY timestamp DESC"
      );
      rows = stmt.all({ since });
    } else if (logType === "proxy-logs") {
      tableName = "proxy_logs";
      const stmt = db.prepare(
        "SELECT * FROM proxy_logs WHERE timestamp >= @since ORDER BY timestamp DESC"
      );
      rows = stmt.all({ since });
    }

    const filename = `ZavorthGateway-${tableName}-${hours}h-${new Date().toISOString().slice(0, 10)}.json`;

    const redactedRows = redactExportedLogRows(rows);

    return new Response(
      JSON.stringify({ logs: redactedRows, count: redactedRows.length, hours, type: logType, redacted: true }, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "X-Zavorth-Redaction": "secrets",
        },
      }
    );
  } catch (error) {
    return Response.json(
      { error: { message: (error as Error).message, type: "server_error" } },
      { status: 500 }
    );
  }
}
