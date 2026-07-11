/**
 * Browser-side consumer of Zavorth Code bridge via Vite dev middleware
 * (`/__zavorth/code-bridge`) or optional window bridge from Desktop embed.
 *
 * Chip paint + click-to-open quiet checks panel.
 */

import { escapeHtml } from './html-utils'

export type CodeBridgeCheck = {
  id?: string
  ok?: boolean
  label?: string
  detail?: string
}

export type CodeBridgeSummary = {
  stateDir?: string
  tone: string
  label: string
  detail: string
  opsFresh?: boolean
  companionFresh?: boolean
  ops?: {
    ready?: boolean
    headline?: string
    nextAction?: string
    approvals?: number
    sessions?: number
    providerReady?: boolean
    modelLabel?: string
    updatedAt?: number
    checks?: CodeBridgeCheck[]
  }
  companion?: {
    updatedAt?: number
    pulse?: { headline?: string; ready?: boolean; approvals?: number; sessions?: number }
    lastSessionTitle?: string
  }
  companionStatus?: { online?: boolean; lastSeen?: number; name?: string }
}

const OFFLINE: CodeBridgeSummary = {
  tone: "muted",
  label: "Code offline",
  detail: "No recent Zavorth Code CLI bridge",
  opsFresh: false,
  companionFresh: false,
}

const PANEL_ID = "code-bridge-checks-panel"

let lastSummary: CodeBridgeSummary = OFFLINE
let panelOpen = false
let panelRoot: HTMLElement | null = null
let escapeBound = false

function setText(selector: string, value: string) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value
  })
}

function applyTone(selector: string, tone: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.dataset.codeBridgeTone = tone
    node.classList.toggle("is-code-ready", tone === "ready")
    node.classList.toggle("is-code-warn", tone === "warning")
    node.classList.toggle("is-code-muted", tone === "muted" || tone === "danger")
  })
}

function truncatePath(value: string, max = 52): string {
  const s = String(value || "").trim()
  if (s.length <= max) return s
  const head = Math.max(12, Math.floor(max * 0.45))
  const tail = Math.max(12, max - head - 1)
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

function yn(value: unknown): string {
  if (value === true) return "yes"
  if (value === false) return "no"
  return "—"
}

function formatSessions(summary: CodeBridgeSummary): string {
  const fromOps = summary.ops?.sessions
  if (typeof fromOps === "number" && Number.isFinite(fromOps)) return String(fromOps)
  const fromPulse = summary.companion?.pulse?.sessions
  if (typeof fromPulse === "number" && Number.isFinite(fromPulse)) return String(fromPulse)
  return "—"
}

function checksOf(summary: CodeBridgeSummary): CodeBridgeCheck[] {
  const raw = summary.ops?.checks
  return Array.isArray(raw) ? raw : []
}

function buildPanelBodyHtml(summary: CodeBridgeSummary): string {
  const ops = summary.ops
  const checks = checksOf(summary)
  const checksHtml =
    checks.length === 0
      ? `<div class="code-bridge-panel__empty">No checks in latest ops-bridge</div>`
      : `<ul class="code-bridge-panel__checks" role="list">
          ${checks
            .map((check) => {
              const ok = check.ok === true
              const mark = ok ? "●" : "△"
              const label = escapeHtml(check.label || check.id || "check")
              const detail = check.detail ? `<span class="code-bridge-panel__check-detail">${escapeHtml(check.detail)}</span>` : ""
              return `<li class="code-bridge-panel__check ${ok ? "is-ok" : "is-fail"}">
                <span class="code-bridge-panel__check-mark" aria-hidden="true">${mark}</span>
                <span class="code-bridge-panel__check-body">
                  <span class="code-bridge-panel__check-label">${label}</span>
                  ${detail}
                </span>
              </li>`
            })
            .join("")}
        </ul>`

  const stateDir = summary.stateDir
    ? `<div class="code-bridge-panel__path" title="${escapeHtml(summary.stateDir)}">${escapeHtml(truncatePath(summary.stateDir))}</div>`
    : ""

  const headline = ops?.headline ? escapeHtml(ops.headline) : "—"
  const nextAction = ops?.nextAction ? escapeHtml(ops.nextAction) : "—"
  const modelLabel = ops?.modelLabel ? escapeHtml(ops.modelLabel) : "—"

  return `
    <div class="code-bridge-panel__lead">
      <div class="code-bridge-panel__label" data-code-bridge-panel-label>${escapeHtml(summary.label)}</div>
      <div class="code-bridge-panel__detail">${escapeHtml(summary.detail || "")}</div>
      <div class="code-bridge-panel__tone">tone · ${escapeHtml(summary.tone || "muted")}</div>
    </div>
    <dl class="code-bridge-panel__meta">
      <div><dt>ops.ready</dt><dd>${escapeHtml(yn(ops?.ready))}</dd></div>
      <div><dt>providerReady</dt><dd>${escapeHtml(yn(ops?.providerReady))}</dd></div>
      <div><dt>approvals</dt><dd>${escapeHtml(String(Number(ops?.approvals || 0)))}</dd></div>
      <div><dt>sessions</dt><dd>${escapeHtml(formatSessions(summary))}</dd></div>
      <div class="code-bridge-panel__meta-wide"><dt>model</dt><dd>${modelLabel}</dd></div>
    </dl>
    <div class="code-bridge-panel__section-label">Checks</div>
    ${checksHtml}
    <div class="code-bridge-panel__section-label">Next</div>
    <div class="code-bridge-panel__next">
      <div class="code-bridge-panel__next-row"><span>headline</span><strong>${headline}</strong></div>
      <div class="code-bridge-panel__next-row"><span>nextAction</span><strong>${nextAction}</strong></div>
    </div>
    ${stateDir}
  `
}

function ensurePanelRoot(): HTMLElement {
  if (panelRoot && document.body.contains(panelRoot)) return panelRoot
  const existing = document.getElementById(PANEL_ID)
  if (existing) {
    panelRoot = existing
    return existing
  }

  const root = document.createElement("div")
  root.id = PANEL_ID
  root.className = "code-bridge-panel"
  root.hidden = true
  root.setAttribute("role", "dialog")
  root.setAttribute("aria-modal", "true")
  root.setAttribute("aria-label", "Zavorth Code bridge checks")
  root.innerHTML = `
    <div class="code-bridge-panel__backdrop" data-code-bridge-panel-dismiss></div>
    <div class="code-bridge-panel__frame" role="document">
      <header class="code-bridge-panel__header">
        <div>
          <div class="code-bridge-panel__eyebrow">Code bridge</div>
          <h2 class="code-bridge-panel__title">Checks</h2>
        </div>
        <button type="button" class="code-bridge-panel__close" data-code-bridge-panel-dismiss aria-label="Close">×</button>
      </header>
      <div class="code-bridge-panel__body" data-code-bridge-panel-body></div>
    </div>
  `
  document.body.appendChild(root)

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("[data-code-bridge-panel-dismiss]")) {
      closeCodeBridgePanel()
    }
  })

  panelRoot = root
  return root
}

function paintPanel(summary: CodeBridgeSummary) {
  const root = ensurePanelRoot()
  const body = root.querySelector<HTMLElement>("[data-code-bridge-panel-body]")
  if (body) body.innerHTML = buildPanelBodyHtml(summary)
  root.dataset.tone = summary.tone || "muted"
}

export function openCodeBridgePanel(summary: CodeBridgeSummary = lastSummary) {
  paintPanel(summary)
  const root = ensurePanelRoot()
  root.hidden = false
  root.classList.add("is-open")
  panelOpen = true
  const closeBtn = root.querySelector<HTMLButtonElement>(".code-bridge-panel__close")
  closeBtn?.focus({ preventScroll: true })
}

export function closeCodeBridgePanel() {
  panelOpen = false
  if (!panelRoot) return
  panelRoot.classList.remove("is-open")
  panelRoot.hidden = true
}

export function isCodeBridgePanelOpen() {
  return panelOpen
}

function bindPanelChromeOnce() {
  if (escapeBound) return
  escapeBound = true

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panelOpen) {
      event.preventDefault()
      closeCodeBridgePanel()
    }
  })

  document.querySelectorAll<HTMLElement>("[data-code-bridge]").forEach((chip) => {
    if (!chip.hasAttribute("role")) chip.setAttribute("role", "button")
    if (!chip.hasAttribute("tabindex")) chip.tabIndex = 0
    chip.setAttribute("aria-haspopup", "dialog")
    chip.style.cursor = "pointer"

    chip.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (panelOpen) {
        closeCodeBridgePanel()
      } else {
        openCodeBridgePanel(lastSummary)
      }
    })

    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        if (panelOpen) closeCodeBridgePanel()
        else openCodeBridgePanel(lastSummary)
      }
    })
  })
}

export function renderCodeBridgeChrome(summary: CodeBridgeSummary) {
  lastSummary = summary
  setText("[data-code-bridge-label]", summary.label)
  setText("[data-code-bridge-detail]", summary.detail)
  applyTone("[data-code-bridge]", summary.tone)
  applyTone("[data-code-bridge-label]", summary.tone)

  const approvals = Number(summary.ops?.approvals || 0)
  const approvalText =
    approvals > 0
      ? approvals === 1
        ? "1 Code approval"
        : `${approvals} Code approvals`
      : summary.opsFresh
        ? summary.ops?.ready
          ? "Code CLI ready"
          : "Code not ready"
        : "Code bridge idle"
  setText("[data-code-bridge-approvals]", approvalText)

  if (panelOpen) {
    paintPanel(summary)
  }
}

async function fetchJsonSummary(url: string): Promise<CodeBridgeSummary | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as CodeBridgeSummary
    if (!data || typeof data.label !== "string") return null
    return data
  } catch {
    return null
  }
}

/**
 * Optional gateway origin when Control is not same-origin as ai-gateway.
 * Order: window global → localStorage → meta tag → relative (empty).
 */
export function resolveCodeBridgeBaseUrl(): string {
  const win = window as unknown as { __ZAVORTH_CODE_BRIDGE_URL__?: unknown }
  const fromWindow =
    typeof win.__ZAVORTH_CODE_BRIDGE_URL__ === "string" ? win.__ZAVORTH_CODE_BRIDGE_URL__.trim() : ""
  if (fromWindow) return fromWindow.replace(/\/$/, "")

  try {
    const fromStorage = (localStorage.getItem("zavorth.codeBridge.baseUrl") || "").trim()
    if (fromStorage) return fromStorage.replace(/\/$/, "")
  } catch {
    // private mode / blocked storage
  }

  const meta = document.querySelector('meta[name="zavorth-code-bridge-url"]')
  const fromMeta = (meta?.getAttribute("content") || "").trim()
  if (fromMeta) return fromMeta.replace(/\/$/, "")

  return ""
}

function joinBridgeUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  if (!base) return normalizedPath
  return `${base}${normalizedPath}`
}

/**
 * Resolve Code bridge summary.
 * Order: Desktop IPC → production API → Vite dev middleware.
 * Base URL override via resolveCodeBridgeBaseUrl() for multi-host Control.
 */
export async function fetchCodeBridgeSummary(): Promise<CodeBridgeSummary> {
  // Desktop embed path
  const desktop = (window as unknown as { zavorthDesktop?: { getCodeBridgeSummary?: () => Promise<CodeBridgeSummary> } })
    .zavorthDesktop
  if (desktop?.getCodeBridgeSummary) {
    try {
      return await desktop.getCodeBridgeSummary()
    } catch {
      // fall through
    }
  }

  const base = resolveCodeBridgeBaseUrl()

  // Production gateway (static Control shell on same origin, vite proxy /api → :3001, or absolute base)
  const prod = await fetchJsonSummary(
    joinBridgeUrl(base, "/api/code-bridge?name=Zavorth%20Control"),
  )
  if (prod) return prod

  // Vite-only dev middleware (when gateway is not running)
  const dev = await fetchJsonSummary(joinBridgeUrl(base, "/__zavorth/code-bridge"))
  if (dev) return dev

  return OFFLINE
}

/**
 * Poll Code bridge and paint dashboard nodes with data-code-bridge-* attributes.
 * Click chip → quiet checks panel (re-renders on poll while open).
 * Returns stop().
 */
export function startCodeBridgeUi(pollMs = 5000): () => void {
  let stopped = false
  bindPanelChromeOnce()

  const tick = async () => {
    if (stopped) return
    const summary = await fetchCodeBridgeSummary()
    if (stopped) return
    renderCodeBridgeChrome(summary)
  }

  void tick()
  const handle = window.setInterval(() => {
    void tick()
  }, pollMs)

  return () => {
    stopped = true
    window.clearInterval(handle)
    closeCodeBridgePanel()
  }
}
