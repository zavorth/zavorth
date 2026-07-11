import { requireManagementAuth } from "@/lib/api/requireManagementAuth"
import {
  evaluateProductPermissions,
  loadProductPolicyDoc,
} from "@/lib/productPermissionPolicy"

/**
 * POST /api/experience/permissions/evaluate
 * Body: { permission: string, pattern?: string, patterns?: string[] }
 * Returns product-policy action for Code TUI tool checks (gateway authority).
 */
export async function POST(request: Request) {
  const authError = await requireManagementAuth(request)
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const b = (body && typeof body === "object" ? body : {}) as {
    permission?: string
    pattern?: string
    patterns?: string[]
  }
  const permission = String(b.permission || "").trim()
  if (!permission) {
    return Response.json({ ok: false, error: "Missing permission" }, { status: 400 })
  }

  const patterns =
    Array.isArray(b.patterns) && b.patterns.length
      ? b.patterns.map(String)
      : [String(b.pattern || "*")]

  const { doc, path: configPath } = loadProductPolicyDoc()
  if (!doc) {
    return Response.json({
      ok: true,
      action: "ask",
      source: "none",
      configPath,
      permission,
      patterns,
      detail: "product runtime-permissions.json not found — default ask",
    })
  }

  const evaluated = evaluateProductPermissions(permission, patterns, doc)
  return Response.json({
    ok: true,
    action: evaluated.action,
    source: "product-config",
    profile: evaluated.profile,
    configPath,
    permission,
    patterns,
    results: evaluated.results,
  })
}

export async function GET() {
  const { doc, path: configPath } = loadProductPolicyDoc()
  return Response.json({
    ok: true,
    hasPolicy: Boolean(doc),
    profile: doc?.profile || null,
    configPath,
    endpoint: "POST /api/experience/permissions/evaluate",
  })
}
