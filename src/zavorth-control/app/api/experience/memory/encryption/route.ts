import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { ZavorthMemoryEncryptionStatusService, type ZavorthMemoryEncryptionMode } from "../../../../../../services/ZavorthMemoryEncryptionStatusService";
import { readJsonBody } from "../../experienceRouteSupport";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const service = new ZavorthMemoryEncryptionStatusService();
  const url = new URL(request.url);
  const status = service.buildStatus({
    dbPath: readOptionalString(url.searchParams.get("dbPath")),
    mode: readMode(url.searchParams.get("mode")),
    keyPath: readOptionalString(url.searchParams.get("keyPath")),
    keyStore: readKeyStore(url.searchParams.get("keyStore")),
    driverPackages: readDrivers(url.searchParams.get("drivers")),
  });

  return Response.json({
    ok: true,
    surface: url.searchParams.get("surface") || "web",
    status,
  });
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  const action = String(body.action || "preview").trim().toLowerCase();
  const service = new ZavorthMemoryEncryptionStatusService();
  const input = {
    dbPath: readOptionalString(body.dbPath),
    mode: readMode(body.mode),
    key: typeof body.key === "string" ? body.key : null,
    keyPath: readOptionalString(body.keyPath),
    keyStore: readKeyStore(body.keyStore),
    backupPath: readOptionalString(body.backupPath),
    driverPackages: Array.isArray(body.driverPackages)
      ? body.driverPackages.map((entry) => String(entry || "").trim()).filter(Boolean)
      : readDrivers(body.drivers),
  };

  const receipt = action === "apply" || action === "enable"
    ? service.applyMigration(input)
    : action === "rollback" || action === "restore"
      ? service.rollbackMigration(input)
      : service.previewMigration(input);

  return Response.json({
    ok: receipt.status !== "failed",
    receipt,
    status: service.buildStatus(input),
  }, {
    status: receipt.status === "blocked" ? 409 : receipt.status === "failed" ? 500 : 200,
  });
}

function readOptionalString(value: unknown): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function readMode(value: unknown): ZavorthMemoryEncryptionMode | null {
  const text = String(value || "").trim().toLowerCase();
  return text === "off" || text === "opportunistic" || text === "required" ? text : null;
}

function readKeyStore(value: unknown): "auto" | "file" | "os" | null {
  const text = String(value || "").trim().toLowerCase();
  return text === "auto" || text === "file" || text === "os" ? text : null;
}

function readDrivers(value: unknown): string[] | undefined {
  const text = String(value || "").trim();
  if (!text) return undefined;
  return text.split(",").map((entry) => entry.trim()).filter(Boolean);
}
