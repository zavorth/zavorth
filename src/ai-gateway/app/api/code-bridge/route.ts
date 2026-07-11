/**
 * Production Code bridge endpoint for Zavorth Control / Desktop consumers.
 *
 * GET  /api/code-bridge  — summary of ops-bridge + companion-bridge; heartbeats companion-status
 * POST /api/code-bridge  — optional explicit heartbeat { name?: string }
 * OPTIONS                — CORS preflight (CORS_ORIGIN / shared CORS_HEADERS)
 *
 * Auth: management auth (loopback / local Control allowed without token).
 * Contract: zavorth-code/docs/bridge-contract.md
 */
import { NextResponse } from "next/server"
import { requireManagementAuth } from "@/lib/api/requireManagementAuth"
import {
  summarizeCodeBridge,
  writeCompanionStatus,
} from "@/lib/codeBridge"
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function withCorsHeaders(init?: HeadersInit): Record<string, string> {
  return {
    ...CORS_HEADERS,
    ...(init as Record<string, string> | undefined),
  }
}

function attachCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

function heartbeatNameFromRequest(request: Request): string {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get("name")
    if (q && q.trim()) return q.trim()
  } catch {
    // ignore
  }
  return "Zavorth Control"
}

/** CORS preflight for multi-host Control shells */
export function OPTIONS() {
  return handleCorsOptions()
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request)
  if (authError) return attachCors(authError)

  try {
    // Heartbeat so Code TUI sees Control online while this endpoint is polled
    writeCompanionStatus({ name: heartbeatNameFromRequest(request), online: true })
    const summary = summarizeCodeBridge()
    return NextResponse.json(summary, {
      headers: withCorsHeaders({
        "Cache-Control": "no-store",
      }),
    })
  } catch (error) {
    return NextResponse.json(
      {
        tone: "muted",
        label: "Code offline",
        detail: error instanceof Error ? error.message : "code bridge error",
        opsFresh: false,
        companionFresh: false,
        companionStatus: { online: false },
      },
      {
        status: 500,
        headers: withCorsHeaders({ "Cache-Control": "no-store" }),
      },
    )
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request)
  if (authError) return attachCors(authError)

  try {
    let name = "Zavorth Control"
    try {
      const body = (await request.json()) as { name?: unknown }
      if (typeof body?.name === "string" && body.name.trim()) {
        name = body.name.trim()
      }
    } catch {
      // empty body ok
    }
    const status = writeCompanionStatus({ name, online: true })
    return NextResponse.json(
      {
        ok: true,
        status,
        summary: summarizeCodeBridge(),
      },
      { headers: withCorsHeaders() },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "heartbeat failed",
      },
      { status: 500, headers: withCorsHeaders() },
    )
  }
}
