import { cmd } from "@/cli/cmd/cmd"
import { tui } from "./app"
import { Rpc } from "@/util"
import { type rpc } from "./worker"
import path from "path"
import { fileURLToPath } from "url"
import { UI } from "@/cli/ui"
import { Log } from "@/util"
import { errorMessage } from "@/util/error"
import { withTimeout } from "@/util/timeout"
import { withNetworkOptions, resolveNetworkOptionsNoConfig } from "@/cli/network"
import { Filesystem } from "@/util"
import type { GlobalEvent } from "@zavorth/sdk/v2"
import type { EventSource } from "./context/sdk"
import { win32DisableProcessedInput, win32InstallCtrlCGuard } from "./win32"
import { writeHeapSnapshot } from "v8"
import { TuiConfig } from "./config/tui"
import { zavorth_PROCESS_ROLE, zavorth_RUN_ID, ensureRunID, sanitizedProcessEnv } from "@/util/zavorth-process"
import { checkTrust, markTrusted } from "@/project/workspace-trust"
import { t } from "@/cli/i18n"
import { InstallationVersion } from "@/installation/version"
import { pickTagline } from "./util/taglines"
import { EOL } from "os"

declare global {
  const ZAVORTH_WORKER_PATH: string
}

type RpcClient = ReturnType<typeof Rpc.client<typeof rpc>>

function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
    const result = await client.call("fetch", {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    })
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  }
  return fn as typeof fetch
}

function createEventSource(client: RpcClient): EventSource {
  return {
    subscribe: async (handler) => {
      return client.on<GlobalEvent>("global.event", (e) => {
        handler(e)
      })
    },
  }
}

async function target() {
  if (typeof ZAVORTH_WORKER_PATH !== "undefined") return ZAVORTH_WORKER_PATH
  const dist = new URL("./cli/cmd/tui/worker.js", import.meta.url)
  if (await Filesystem.exists(fileURLToPath(dist))) return dist
  return new URL("./worker.ts", import.meta.url)
}

async function input(value?: string) {
  const piped = process.stdin.isTTY ? undefined : await Bun.stdin.text()
  if (!value) return piped
  if (!piped) return value
  return piped + "\n" + value
}

/** Zavorth brand green for pre-TUI trust card (matches WelcomeBox accent). */
const TRUST_GREEN = "\x1b[38;2;63;122;66m"
const TRUST_GREEN_SOFT = "\x1b[38;2;100;160;105m"
const TRUST_MUTED = "\x1b[90m"
const TRUST_TEXT = "\x1b[97m"
const TRUST_RESET = "\x1b[0m"
const TRUST_BOLD = "\x1b[1m"
const TRUST_DANGER = "\x1b[38;2;224;108;117m"
const TRUST_WARN = "\x1b[38;2;229;192;123m"

function stripAnsi(value: string) {
  return value.replace(/\x1b\[[0-9;]*m/g, "")
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    if (!line) {
      line = word
      continue
    }
    if (line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
      continue
    }
    line += " " + word
  }
  if (line) lines.push(line)
  return lines
}

function padLine(content: string, inner: number) {
  const visible = stripAnsi(content)
  const pad = Math.max(0, inner - visible.length)
  return content + " ".repeat(pad)
}

/** Rounded trust card printed before the TUI boots (clack has no card layout). */
function renderTrustCard(params: {
  title: string
  directory: string
  sections: Array<{ kind: "muted" | "text" | "danger" | "warn"; text: string }>
  tone: "normal" | "dangerous"
}) {
  const cols = Math.max(48, Math.min(process.stdout.columns || 72, 72))
  const inner = cols - 4
  const border = params.tone === "dangerous" ? TRUST_WARN : TRUST_GREEN
  const titleColor = params.tone === "dangerous" ? TRUST_WARN : TRUST_GREEN_SOFT

  const rows: string[] = []
  const pushBlank = () => rows.push("")
  const pushRaw = (raw: string) => rows.push(raw)
  const pushWrapped = (text: string, color: string) => {
    for (const line of wrapText(text, inner)) pushRaw(color + line + TRUST_RESET)
  }

  pushRaw(titleColor + TRUST_BOLD + params.title + TRUST_RESET)
  pushBlank()
  pushWrapped(params.directory, TRUST_TEXT)
  pushBlank()
  for (const section of params.sections) {
    const color =
      section.kind === "danger"
        ? TRUST_DANGER
        : section.kind === "warn"
          ? TRUST_WARN
          : section.kind === "text"
            ? TRUST_TEXT
            : TRUST_MUTED
    pushWrapped(section.text, color)
    pushBlank()
  }
  // drop trailing blank
  while (rows.length && rows[rows.length - 1] === "") rows.pop()

  const top = `${border}╭${"─".repeat(inner + 2)}╮${TRUST_RESET}`
  const bottom = `${border}╰${"─".repeat(inner + 2)}╯${TRUST_RESET}`
  const body = rows
    .map((row) => `${border}│${TRUST_RESET} ${padLine(row, inner)} ${border}│${TRUST_RESET}`)
    .join(EOL)

  process.stderr.write(EOL + top + EOL + body + EOL + bottom + EOL + EOL)
}

/** True when machine-readable / non-interactive output should stay quiet. */
function isJsonMode() {
  if (process.env.ZAVORTH_FORMAT === "json") return true
  const eq = process.argv.find((a) => a.startsWith("--format="))
  if (eq?.slice("--format=".length) === "json") return true
  const idx = process.argv.indexOf("--format")
  if (idx >= 0 && process.argv[idx + 1] === "json") return true
  return false
}

/**
 * One-line branded boot banner printed after trust, before the TUI takes over.
 * Format: `◆ Zavorth Code vX  ·  <tagline>`
 * Env: ZAVORTH_TAGLINE=random|default|off (default random). Suppressed when not TTY, off, or JSON mode.
 */
function printBootBanner() {
  if (isJsonMode()) return
  if (!process.stderr.isTTY) return
  const tagline = pickTagline(process.env.ZAVORTH_TAGLINE)
  if (!tagline) return
  const version = InstallationVersion
  const line =
    `${TRUST_GREEN}◆${TRUST_RESET} ` +
    `${TRUST_BOLD}${TRUST_TEXT}Zavorth Code${TRUST_RESET} ` +
    `${TRUST_MUTED}v${version}${TRUST_RESET}` +
    `  ${TRUST_MUTED}·${TRUST_RESET}  ` +
    `${TRUST_GREEN_SOFT}${tagline}${TRUST_RESET}`
  process.stderr.write(line + EOL)
}

async function promptWorkspaceTrust(directory: string, level: "untrusted" | "dangerous"): Promise<boolean> {
  const prompts = await import("@clack/prompts")

  if (level === "dangerous") {
    const isRoot = path.parse(directory).root === directory
    const title = t(isRoot ? "trust.dangerous.title_root" : "trust.dangerous.title_home")
    const body = t(isRoot ? "trust.dangerous.body_root" : "trust.dangerous.body_home")
    const advice = t(isRoot ? "trust.dangerous.advice_root" : "trust.dangerous.advice_home")
    renderTrustCard({
      title: "◆ " + title,
      directory,
      tone: "dangerous",
      sections: [
        { kind: "text", text: body },
        { kind: "danger", text: "· " + t("trust.plugin_warn") },
        { kind: "warn", text: "· " + advice },
      ],
    })
    const result = await prompts.select({
      message: t("trust.prompt.choose"),
      options: [
        { label: t("trust.dangerous.option.no"), value: false, hint: t("trust.hint.recommended") },
        { label: t("trust.dangerous.option.yes"), value: true },
      ],
    })
    if (prompts.isCancel(result)) return false
    return result
  }

  renderTrustCard({
    title: "◆ " + t("trust.title"),
    directory,
    tone: "normal",
    sections: [
      { kind: "muted", text: t("trust.safety_check") },
      { kind: "text", text: "· " + t("trust.capabilities") },
      { kind: "danger", text: "· " + t("trust.plugin_warn") },
    ],
  })
  const result = await prompts.select({
    message: t("trust.prompt.choose"),
    options: [
      { label: t("trust.option.yes"), value: true, hint: t("trust.hint.continue") },
      { label: t("trust.option.no"), value: false },
    ],
  })
  if (prompts.isCancel(result)) return false
  return result
}

export const TuiThreadCommand = cmd({
  command: "$0 [project]",
  describe: "start zavorth tui",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start zavorth in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("prompt", {
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("never-ask", {
        type: "boolean",
        describe:
          "start in never-ask mode — auto-decide without asking (permissions excluded), toggle at runtime with /never-ask",
        default: false,
      })
      .option("trust", {
        type: "boolean",
        describe: "skip workspace trust prompt and trust the directory",
        default: false,
      }),
  handler: async (args) => {
    // Keep ENABLE_PROCESSED_INPUT cleared even if other code flips it.
    // (Important when running under `bun run` wrappers on Windows.)
    const unguard = win32InstallCtrlCGuard()
    try {
      // Must be the very first thing — disables CTRL_C_EVENT before any Worker
      // spawn or async work so the OS cannot kill the process group.
      win32DisableProcessedInput()

      if (args.fork && !args.continue && !args.session) {
        UI.error("--fork requires --continue or --session")
        process.exitCode = 1
        return
      }

      // Resolve relative --project paths from PWD, then use the real cwd after
      // chdir so the thread and worker share the same directory key.
      const root = Filesystem.resolve(process.env.PWD ?? process.cwd())
      const next = args.project
        ? Filesystem.resolve(path.isAbsolute(args.project) ? args.project : path.join(root, args.project))
        : Filesystem.resolve(process.cwd())
      const file = await target()
      try {
        process.chdir(next)
      } catch {
        UI.error("Failed to change directory to " + next)
        return
      }
      const cwd = Filesystem.resolve(process.cwd())

      if (!args.trust) {
        const trustLevel = await checkTrust(cwd)
        if (trustLevel !== "trusted") {
          const accepted = await promptWorkspaceTrust(cwd, trustLevel)
          if (!accepted) {
            process.exit(0)
            return
          }
          if (trustLevel === "untrusted") await markTrusted(cwd)
        }
      }

      const env = sanitizedProcessEnv({
        [zavorth_PROCESS_ROLE]: "worker",
        [zavorth_RUN_ID]: ensureRunID(),
      })

      const worker = new Worker(file, {
        env,
      })
      worker.onerror = (e) => {
        Log.Default.error("thread error", {
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          error: e.error,
        })
      }

      const client = Rpc.client<typeof rpc>(worker)
      const error = (e: unknown) => {
        Log.Default.error("process error", { error: errorMessage(e) })
      }
      const reload = () => {
        client.call("reload", undefined).catch((err) => {
          Log.Default.warn("worker reload failed", {
            error: errorMessage(err),
          })
        })
      }
      process.on("uncaughtException", error)
      process.on("unhandledRejection", error)
      process.on("SIGUSR2", reload)

      let stopped = false
      const stop = async () => {
        if (stopped) return
        stopped = true
        process.off("uncaughtException", error)
        process.off("unhandledRejection", error)
        process.off("SIGUSR2", reload)
        await withTimeout(client.call("shutdown", undefined), 5000).catch((error) => {
          Log.Default.warn("worker shutdown failed", {
            error: errorMessage(error),
          })
        })
        worker.terminate()
      }

      const prompt = await input(args.prompt)
      const config = await TuiConfig.get()

      const network = resolveNetworkOptionsNoConfig(args)
      const external =
        process.argv.includes("--port") ||
        process.argv.includes("--hostname") ||
        process.argv.includes("--mdns") ||
        network.mdns ||
        network.port !== 0 ||
        network.hostname !== "127.0.0.1"

      const transport = external
        ? {
            url: (await client.call("server", network)).url,
            fetch: undefined,
            events: undefined,
          }
        : {
            url: "http://zavorth.internal",
            fetch: createWorkerFetch(client),
            events: createEventSource(client),
          }

      setTimeout(() => {
        client.call("checkUpgrade", { directory: cwd }).catch(() => {})
      }, 1000).unref?.()

      // After trust, before TUI: one-line brand banner (TTY only; ZAVORTH_TAGLINE=off to suppress).
      printBootBanner()

      try {
        await tui({
          url: transport.url,
          async onSnapshot() {
            const tui = writeHeapSnapshot("tui.heapsnapshot")
            const server = await client.call("snapshot", undefined)
            return [tui, server]
          },
          config,
          directory: cwd,
          fetch: transport.fetch,
          events: transport.events,
          args: {
            continue: args.continue,
            sessionID: args.session,
            agent: args.agent,
            model: args.model,
            prompt,
            fork: args.fork,
            neverAsk: args["never-ask"],
          },
        })
      } finally {
        await stop()
      }
    } finally {
      unguard?.()
    }
    process.exit(0)
  },
})
// scratch
