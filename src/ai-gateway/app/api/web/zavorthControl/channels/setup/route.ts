import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from "../../../runtime-engine-state";
import { ChannelProviderDoctorService } from "../../../../../../../services/ChannelProviderDoctorService.js";
import { ChannelSetupAssistantService } from "../../../../../../../services/ChannelSetupAssistantService.js";
import { logger } from '@/shared/utils/logger';

export const runtime = "nodejs";

function createService() {
  return new ChannelSetupAssistantService({
    providerDoctorService: new ChannelProviderDoctorService(),
  });
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const service = createService();
    const assistant = service.buildSession({
      channelId: url.searchParams.get("channelId") || url.searchParams.get("selectedId"),
      mode: url.searchParams.get("mode"),
      intentText: url.searchParams.get("query") || url.searchParams.get("q"),
    });

    return NextResponse.json(redactChannelSetupPayload({
      ok: true,
      contractVersion: "2026-06-16.zavorthControl.channel-setup.v1",
      assistant,
      channels: assistant.channels,
    }));
  } catch (error) {
    logger.warn('[route] load operation failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "channel setup unavailable",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({
      ok: false,
      error: "cross-site mutation requests are blocked",
    }, { status: 403 });
  }

  try {
    const body = await readJsonBody(request);
    const action = String(body.action || body.type || "").trim().toLowerCase();
    const service = createService();

    if (action === "apply" || action === "applyscaffold") {
      const result = await service.apply({
        channelId: String(body.channelId || body.selectedId || "").trim(),
        mode: typeof body.mode === "string" ? body.mode : null,
        requestedBy: "zavorth-control",
        extraEntries: Array.isArray(body.extraEntries)
          ? body.extraEntries
              .map((entry) => ({
                key: String((entry as Record<string, unknown>)?.key || "").trim(),
                value: String((entry as Record<string, unknown>)?.value || ""),
              }))
              .filter((entry) => entry.key)
          : undefined,
      });
      return NextResponse.json(redactChannelSetupPayload({
        ok: true,
        action: "applyScaffold",
        receipt: {
          receiptId: `channel-setup:apply:${result.applyReport.channelId}:${Date.parse(result.generatedAt)}`,
          generatedAt: result.generatedAt,
          channelId: result.applyReport.channelId,
          mode: result.applyReport.mode,
          proof: {
            writtenKeys: result.applyReport.env.writtenKeys,
            preservedKeys: result.applyReport.env.preservedKeys,
            created: result.applyReport.env.created,
          },
        },
        result,
      }));
    }

    if (action === "doctor" || action === "testconnection" || action === "test") {
      const result = await service.runDoctor({
        selectedId: String(body.channelId || body.selectedId || "").trim() || null,
        localOnly: body.localOnly !== false,
      });
      return NextResponse.json(redactChannelSetupPayload({
        ok: result.doctor.status !== "failed",
        action: "doctor",
        receipt: {
          receiptId: `channel-setup:doctor:${result.selectedItem?.channelId || "all"}:${Date.parse(result.generatedAt)}`,
          generatedAt: result.generatedAt,
          channelId: result.selectedItem?.channelId || null,
          status: result.doctor.status,
          proof: {
            summary: result.selectedItem?.summary || result.doctor.summary,
          },
        },
        result,
      }), { status: result.doctor.status === "failed" ? 409 : 200 });
    }

    return NextResponse.json({
      ok: false,
      error: "unsupported channel setup action",
      allowedActions: ["applyScaffold", "doctor", "testConnection"],
    }, { status: 400 });
  } catch (error) {
    logger.warn('[route] connection failed', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "channel setup action failed",
    }, { status: 400 });
  }
}

function redactChannelSetupPayload<T>(payload: T): T {
  return redactValue(payload) as T;
}

function redactValue(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, key));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (/^(envFilePath|filePath)$/.test(entryKey)) {
        output[entryKey] = redactLocalPath(String(entryValue || ""));
      } else if (entryKey === "directoriesCreated" && Array.isArray(entryValue)) {
        output[entryKey] = entryValue.map((entry) => redactLocalPath(String(entry || "")));
      } else if (entryKey === "scaffoldEntries" && Array.isArray(entryValue)) {
        output[entryKey] = entryValue.map((entry) => redactScaffoldEntry(entry));
      } else {
        output[entryKey] = redactValue(entryValue, entryKey);
      }
    }
    return output;
  }
  if (typeof value === "string") {
    if (/(token|secret|password|credential|authorization|api[_-]?key)/i.test(key)) {
      return "[redacted]";
    }
    return redactSecretLikeString(redactPathLikeString(value));
  }
  return value;
}

function redactScaffoldEntry(entry: unknown): unknown {
  if (!entry || typeof entry !== "object") return entry;
  const record = entry as Record<string, unknown>;
  const key = String(record.key || "");
  const value = String(record.value || "");
  return {
    ...record,
    value: /(token|secret|password|credential|authorization|api[_-]?key)/i.test(key)
      ? "[redacted]"
      : redactPathLikeString(value),
  };
}

function redactLocalPath(value: string): string {
  if (!value) return "";
  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? `[local path]/${parts[parts.length - 1]}` : "[local path]";
}

function redactPathLikeString(value: string): string {
  return value
    .replace(/[A-Za-z]:\\[^\n\r]+/g, (match) => redactLocalPath(match))
    .replace(/\/(?:Users|home|var|tmp|opt|workspace)\/[^\n\r\s]+/gi, (match) => redactLocalPath(match));
}

function redactSecretLikeString(value: string): string {
  return value
    .replace(/AIzaSy[A-Za-z0-9_-]{20,}/g, "[redacted-api-key]")
    .replace(/\b(sk|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{20,}\b/g, "[redacted-token]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted-token]");
}
