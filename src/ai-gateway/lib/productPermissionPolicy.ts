/**
 * Product runtime-permissions → action for Code TUI tools.
 * Shared by the experience permissions evaluate API (gateway truth).
 */
import fs from "fs"
import path from "path"

export type PermissionAction = "allow" | "deny" | "ask"

export type ProductPolicyDoc = {
  profile?: string
  defaults?: Record<string, string>
  safety?: { externalEffectsRequireApproval?: boolean }
}

function resolveWorkspaceRoot(): string {
  const envRoot =
    process.env.ZAVORTH_WORKSPACE_ROOT ||
    process.env.ZAVORTH_MONOREPO_ROOT ||
    process.env.ZAVORTH_HOME
  if (typeof envRoot === "string" && envRoot.trim()) {
    // If ZAVORTH_HOME points at state home, prefer cwd for monorepo config
    const candidate = envRoot.trim()
    if (fs.existsSync(path.join(candidate, "config", "runtime-permissions.json"))) {
      return candidate
    }
  }
  // ai-gateway typically runs with monorepo as cwd
  return process.cwd()
}

export function loadProductPolicyDoc(workspaceRoot?: string): {
  doc: ProductPolicyDoc | null
  path: string | null
} {
  const root = workspaceRoot || resolveWorkspaceRoot()
  const filePath = path.join(root, "config", "runtime-permissions.json")
  try {
    if (!fs.existsSync(filePath)) return { doc: null, path: filePath }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProductPolicyDoc
    return { doc: raw, path: filePath }
  } catch {
    return { doc: null, path: filePath }
  }
}

function mapDefault(raw: string | undefined): PermissionAction | null {
  if (!raw) return null
  const norm = String(raw).trim().toLowerCase()
  if (norm === "allow" || norm === "allowed") return "allow"
  if (norm === "block" || norm === "deny" || norm === "denied") return "deny"
  if (norm === "approval" || norm === "ask" || norm === "prompt") return "ask"
  return null
}

/** Map product default keys → TUI permission id. */
function productKeysForPermission(permission: string): string[] {
  const p = String(permission || "").toLowerCase()
  if (p === "bash" || p === "shell") return ["filesystem.shell", "shell.execute"]
  if (p === "edit" || p === "write" || p === "multiedit" || p === "apply_patch") {
    return ["filesystem.write"]
  }
  if (p === "read" || p === "glob" || p === "grep" || p === "list") {
    return ["filesystem.read"]
  }
  if (p === "webfetch" || p === "websearch" || p === "codesearch") {
    return ["network.fetch"]
  }
  if (p === "external_directory") return ["filesystem.write", "filesystem.read"]
  if (p === "skill") return ["skills.imported", "skills.native"]
  if (p === "task" || p === "actor") return ["subagents.delegate"]
  return []
}

/**
 * Evaluate a single tool permission against product policy.
 * Missing rule → ask (safe default for unknown tools under gateway authority).
 */
export function evaluateProductPermission(
  permission: string,
  _pattern: string = "*",
  doc?: ProductPolicyDoc | null,
): { action: PermissionAction; profile?: string; matchedKey?: string } {
  const { doc: loaded } = doc ? { doc } : loadProductPolicyDoc()
  const policy = doc ?? loaded
  if (!policy?.defaults) {
    return { action: "ask", profile: policy?.profile }
  }
  const defaults = { ...policy.defaults }
  if (policy.safety?.externalEffectsRequireApproval) {
    if (!defaults["filesystem.shell"]) defaults["filesystem.shell"] = "approval"
    if (!defaults["network.fetch"]) defaults["network.fetch"] = "approval"
  }

  for (const key of productKeysForPermission(permission)) {
    const action = mapDefault(defaults[key])
    if (action) {
      return { action, profile: policy.profile, matchedKey: key }
    }
  }
  // Unknown tools under gateway authority require approval by default
  return { action: "ask", profile: policy.profile }
}

export function evaluateProductPermissions(
  permission: string,
  patterns: string[],
  doc?: ProductPolicyDoc | null,
): {
  action: PermissionAction
  profile?: string
  results: Array<{ pattern: string; action: PermissionAction; matchedKey?: string }>
} {
  const results = (patterns.length ? patterns : ["*"]).map((pattern) => {
    const r = evaluateProductPermission(permission, pattern, doc)
    return { pattern, action: r.action, matchedKey: r.matchedKey }
  })
  // Strictest wins: deny > ask > allow
  let action: PermissionAction = "allow"
  for (const r of results) {
    if (r.action === "deny") {
      action = "deny"
      break
    }
    if (r.action === "ask") action = "ask"
  }
  return {
    action,
    profile: results[0] ? evaluateProductPermission(permission, results[0].pattern, doc).profile : undefined,
    results,
  }
}
