import { createEffect, createMemo, createSignal, onMount, Show } from "solid-js"
import os from "os"
import path from "path"
import { InstallationVersion } from "@/installation/version"
import { Locale } from "@/util"
import { ZavorthMascot, type MascotMood } from "../component/zavorth-mascot"
import { useLanguage } from "../context/language"
import { useLocal } from "../context/local"
import { useProject } from "../context/project"
import { useSync } from "../context/sync"
import { useRoute } from "../context/route"
import { useKV } from "../context/kv"
import { writeCompanionBridge } from "../util/companion-bridge"
import { buildOpsSnapshot, toOpsBridgePayload, writeOpsBridge } from "../util/ops-bridge"
import { TuiPluginRuntime } from "../plugin"
import { buildPulse } from "../util/pulse"
import { touchRitual, type RitualState } from "../util/ritual"
import { useTheme } from "../context/theme"
import { useToast } from "../ui/toast"
import { shouldShow as firstTouchShouldShow, markSeen as firstTouchMarkSeen } from "../util/first-touch"

/**
 * Home welcome — compact hero + scannable status.
 *
 * Layout (airy, few lines — not a form wall):
 *   [mascot]  title
 *             welcome
 *             ● status · next action          (one row)
 *             folder · git · sess · mcp       (one muted strip)
 *             continue (if any)
 *             tip
 */
export function WelcomeBox() {
  const local = useLocal()
  const project = useProject()
  const sync = useSync()
  const route = useRoute()
  const kv = useKV()
  const t = useLanguage().t
  const toast = useToast()
  const { theme } = useTheme()
  const [username, setUsername] = createSignal("Developer")

  let ritualTouched = false
  createEffect(() => {
    if (!kv.ready || ritualTouched) return
    ritualTouched = true
    const next = touchRitual(kv.get("ritual_state") as RitualState | undefined)
    kv.set("ritual_state", next)
  })

  const ritual = createMemo((): RitualState | undefined => {
    return kv.get("ritual_state") as RitualState | undefined
  })

  const streakLabel = createMemo(() => {
    const state = ritual()
    if (!state || state.enabled === false) return undefined
    if (state.days < 1) return undefined
    if (state.days === 1) return t("tui.ritual.streak_one")
    return t("tui.ritual.streak", { days: state.days })
  })

  onMount(() => {
    try {
      const name = os.userInfo().username
      if (name) setUsername(name.charAt(0).toUpperCase() + name.slice(1))
    } catch {
      // keep fallback
    }
  })

  const workspaceName = createMemo(() => {
    const dir = project.instance.directory() || process.cwd()
    const base = path.basename(dir.replace(/[\\/]+$/, "")) || dir
    return base
  })

  const branch = createMemo(() => sync.data.vcs?.branch)

  const pulse = createMemo(() => {
    const parsed = local.model.parsed()
    const providerReady = !!local.model.current()
    const approvals = Object.values(sync.data.permission ?? {}).reduce((sum, list) => sum + (list?.length ?? 0), 0)

    return buildPulse({
      sessions: sync.data.session ?? [],
      permissionsBySession: sync.data.permission ?? {},
      mcp: sync.data.mcp ?? {},
      agentsCount: local.agent.list().length,
      providerReady,
      modelLabel: `${parsed.model} · ${parsed.provider}`,
      workspace: workspaceName(),
      branch: branch(),
      copy: {
        ready: t("tui.pulse.ready"),
        needsProvider: t("tui.pulse.needs_provider"),
        needsApproval: t("tui.pulse.needs_approval", { count: approvals }),
        nextChat: t("tui.pulse.next_chat"),
        nextConnect: t("tui.pulse.next_connect"),
        nextApprove: t("tui.pulse.next_approve"),
        firstLight: t("tui.pulse.first_light"),
      },
    })
  })

  const statusFg = createMemo(() => {
    const p = pulse()
    if (p.ready) return theme.success
    if (!p.providerReady || p.approvals > 0) return theme.warning
    return theme.text
  })

  const mascotMood = createMemo((): MascotMood => {
    const p = pulse()
    if (p.approvals > 0) return "waiting"
    if (!p.providerReady) return "thinking"
    if (p.ready) return "done"
    return "idle"
  })

  const productTitle = createMemo(() => {
    const v = (InstallationVersion || "dev").trim()
    if (!v || v === "local" || v === "dev") return "Zavorth Code"
    if (v.startsWith("v")) return `Zavorth ${v}`
    if (/^\d/.test(v)) return `Zavorth v${v}`
    return `Zavorth · ${v}`
  })

  const latestSession = createMemo(() => {
    const sessions = sync.data.session ?? []
    return sessions
      .filter((s) => s.parentID === undefined)
      .toSorted((a, b) => b.time.updated - a.time.updated)[0]
  })

  /** Compact scannable strip — short tokens, not full sentences */
  const metaLine = createMemo(() => {
    const p = pulse()
    const parts: string[] = [workspaceName()]
    if (branch()) parts.push(`git ${branch()}`)
    parts.push(p.sessions === 0 ? "0 sess" : `${p.sessions} sess`)
    if (p.mcpTotal > 0) parts.push(`MCP ${p.mcpConnected}/${p.mcpTotal}`)
    if (p.agents > 0) parts.push(`${p.agents} agents`)
    const streak = streakLabel()
    if (streak) parts.push(streak)
    return parts.join(" · ")
  })

  createEffect(() => {
    const p = pulse()
    const latest = latestSession()
    void writeCompanionBridge({
      version: 1,
      updatedAt: Date.now(),
      product: "zavorth-code",
      pulse: {
        headline: p.headline,
        ready: p.ready,
        approvals: p.approvals,
        sessions: p.sessions,
      },
      lastSessionId: latest?.id,
      lastSessionTitle: latest?.title,
    }).catch(() => {})

    // Home pulse path also refreshes ops-bridge (full checks + MCP). Best-effort.
    const parsed = local.model.parsed()
    const snapshot = buildOpsSnapshot({
      providerReady: p.providerReady,
      providerLabel: parsed.provider,
      modelLabel: parsed.model,
      mcp: sync.data.mcp ?? {},
      lspCount: (sync.data.lsp ?? []).length,
      permissionsBySession: sync.data.permission ?? {},
      sessions: sync.data.session ?? [],
      copy: {
        providerOk: t("tui.ops.provider_ok"),
        providerMissing: t("tui.ops.provider_missing"),
        mcpOk: t("tui.ops.mcp_ok"),
        mcpPartial: t("tui.ops.mcp_partial"),
        mcpNone: t("tui.ops.mcp_none"),
        lspOk: t("tui.ops.lsp_ok"),
        lspNone: t("tui.ops.lsp_none"),
        approvalsOk: t("tui.ops.approvals_ok"),
        approvalsPending: t("tui.ops.approvals_pending", { count: p.approvals }),
        sessionsOk: t("tui.ops.sessions_ok", { count: p.sessions }),
        sessionsNone: t("tui.ops.sessions_none"),
        readyYes: t("tui.ops.ready_yes"),
        readyNo: t("tui.ops.ready_no"),
        nextConnect: t("tui.ops.next_connect"),
        nextApprove: t("tui.ops.next_approve"),
        nextChat: t("tui.ops.next_chat"),
      },
    })
    void writeOpsBridge(
      toOpsBridgePayload({
        snapshot,
        providerReady: p.providerReady,
        modelLabel: p.modelLabel || undefined,
        mcpConnected: p.mcpConnected,
        mcpTotal: p.mcpTotal,
      }),
    ).catch(() => {})
  })

  // First time home pulse needs a provider — one-shot tip
  createEffect(() => {
    if (pulse().providerReady) return
    if (!firstTouchShouldShow(kv, "needs_provider")) return
    firstTouchMarkSeen(kv, "needs_provider")
    toast.show({
      variant: "info",
      message: t("tui.tip.needs_provider"),
      duration: 4500,
    })
  })

  return (
    <box
      borderStyle="rounded"
      borderColor={theme.borderSubtle}
      backgroundColor={theme.backgroundPanel}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexDirection="row"
      gap={3}
      width="100%"
      flexShrink={0}
    >
      {/* Mascot — square sampling at md (18×8), correct proportions */}
      <box flexShrink={0} justifyContent="center" paddingTop={0}>
        <ZavorthMascot mood={mascotMood()} size="md" />
      </box>

      {/* Content column — airy hierarchy, never stacked form labels */}
      <box flexDirection="column" flexGrow={1} gap={1} minWidth={24}>
        {/* Identity — title then welcome, tight */}
        <box flexDirection="column" gap={0}>
          <text fg={theme.primary}>
            <span style={{ bold: true }}>{productTitle()}</span>
          </text>
          <text fg={theme.textMuted}>{t("tui.home.welcome", { name: username() })}</text>
        </box>

        {/* Status + next on ONE line (no "pronto" over "próximo" stack) */}
        <text>
          <span style={{ fg: statusFg(), bold: true }}>{pulse().headline}</span>
          <span style={{ fg: theme.borderSubtle }}> · </span>
          <span style={{ fg: theme.textMuted }}>{pulse().nextAction}</span>
        </text>

        {/* Workspace meta — one quiet strip */}
        <text fg={theme.textMuted}>{metaLine()}</text>

        {/* Continue — single line, clickable */}
        <Show when={latestSession()}>
          {(session) => (
            <box
              flexShrink={0}
              onMouseUp={() => {
                route.navigate({ type: "session", sessionID: session().id })
              }}
            >
              <text fg={theme.textMuted}>
                {t("tui.home.continue_yesterday")}
                <span style={{ fg: theme.borderSubtle }}> · </span>
                <span style={{ fg: theme.text }}>
                  {Locale.truncate(session().title || t("tui.home.session_untitled"), 40)}
                </span>
                <span style={{ fg: theme.borderSubtle }}>
                  {" · "}
                  {Locale.todayTimeOrDateTime(session().time.updated)}
                </span>
              </text>
            </box>
          )}
        </Show>

        {/* Tip — last, muted, one line */}
        <text fg={theme.textMuted}>{t("tui.pulse.init_tip")}</text>

        <TuiPluginRuntime.Slot name="home_pulse" mode="append" />
      </box>
    </box>
  )
}
