import { NextResponse } from "next/server";
import {
  getSettings,
  getProviderConnections,
  getProviderNodes,
  getCombos,
  getApiKeys,
} from "@/lib/localDb";
import {
  createZavorthSettingsBackup,
  createZavorthSettingsBackupFilename,
  redactZavorthSettingsBackupSecrets,
} from "@/lib/db/jsonBackupAdapters";
import { requireStrictManagementAuth } from "@/lib/api/requireManagementAuth";

/**
 * GET /api/settings/export-json
 * Exports a Zavorth settings backup JSON that can be re-imported by the
 * current gateway storage layer.
 */
export async function GET(request: Request) {
  const authError = await requireStrictManagementAuth(request);
  if (authError) return authError;

  try {
    const rawSettings = await getSettings();

    // REDACT sensitive security keys to maintain Zero-Trust posture
    // even if the admin shares their backup file.
    // Use destructuring (not delete) to avoid mutating a potentially cached object.
    const { password: _pw, requireLogin: _rl, ...safeSettings } = rawSettings;

    const providerConnections = await getProviderConnections();
    const providerNodes = await getProviderNodes();
    const combos = await getCombos();
    const apiKeys = await getApiKeys();

    const exportData = redactZavorthSettingsBackupSecrets(createZavorthSettingsBackup({
      settings: safeSettings,
      providerConnections,
      providerNodes,
      combos,
      apiKeys,
    }));

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${createZavorthSettingsBackupFilename()}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {console.error("[API] Error exporting JSON backup:", error);
    return NextResponse.json({ error: "Failed to export JSON" }, { status: 500 });
  }
}
