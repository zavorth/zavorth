import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function nonNegativeNumber(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

const zavorth_EXPERIMENTAL = truthy("zavorth_EXPERIMENTAL")

// Defaults to false. When enabled, zavorth runs in pure-zavorth mode:
//   — does NOT inherit external agent settings (e.g. legacy ~/.claude paths)
//   — does NOT pick up provider API keys from environment variables
//   — falls back to the zavorth-auto model as the default
// Set zavorth_STANDALONE=true to disable external agent inheritance and env-based
// provider auto-detection.
const zavorth_STANDALONE = truthy("zavorth_STANDALONE")
const zavorth_DISABLE_CLAUDE_CODE_ENV = truthy("zavorth_DISABLE_CLAUDE_CODE")
const zavorth_DISABLE_CLAUDE_CODE = zavorth_STANDALONE || zavorth_DISABLE_CLAUDE_CODE_ENV

const zavorth_DISABLE_EXTERNAL_SKILLS = truthy("zavorth_DISABLE_EXTERNAL_SKILLS")
const zavorth_DISABLE_CLAUDE_CODE_SKILLS =
  zavorth_DISABLE_EXTERNAL_SKILLS || zavorth_DISABLE_CLAUDE_CODE || truthy("zavorth_DISABLE_CLAUDE_CODE_SKILLS")
const copy = process.env["zavorth_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  zavorth_AUTO_SHARE: truthy("zavorth_AUTO_SHARE"),
  zavorth_AUTO_HEAP_SNAPSHOT: truthy("zavorth_AUTO_HEAP_SNAPSHOT"),
  zavorth_GIT_BASH_PATH: process.env["zavorth_GIT_BASH_PATH"],
  zavorth_CONFIG: process.env["zavorth_CONFIG"],
  zavorth_CONFIG_CONTENT: process.env["zavorth_CONFIG_CONTENT"],

  zavorth_DISABLE_AUTOUPDATE: truthy("zavorth_DISABLE_AUTOUPDATE"),

  // Defaults to false (rotation enabled). When enabled, the active log file is
  // never archived to <name>.log.<stamp> on hitting MAX_FILE_SIZE — it grows in
  // place. Useful when an external tool tails/manages the single log file.
  zavorth_DISABLE_LOG_ROTATION: truthy("zavorth_DISABLE_LOG_ROTATION"),

  // Defaults to true (analytics enabled). Set zavorth_ENABLE_ANALYSIS=false
  // to opt out of POSTing model_call/tool_call/agent_request metrics.
  zavorth_ENABLE_ANALYSIS: !falsy("zavorth_ENABLE_ANALYSIS"),
  zavorth_ALWAYS_NOTIFY_UPDATE: truthy("zavorth_ALWAYS_NOTIFY_UPDATE"),
  zavorth_DISABLE_PRUNE: truthy("zavorth_DISABLE_PRUNE"),
  zavorth_DISABLE_TERMINAL_TITLE: truthy("zavorth_DISABLE_TERMINAL_TITLE"),
  zavorth_SHOW_TTFD: truthy("zavorth_SHOW_TTFD"),
  zavorth_PERMISSION: process.env["zavorth_PERMISSION"],
  zavorth_DISABLE_DEFAULT_PLUGINS: truthy("zavorth_DISABLE_DEFAULT_PLUGINS"),
  zavorth_DISABLE_LSP_DOWNLOAD: truthy("zavorth_DISABLE_LSP_DOWNLOAD"),
  zavorth_ENABLE_EXPERIMENTAL_MODELS: truthy("zavorth_ENABLE_EXPERIMENTAL_MODELS"),
  zavorth_DISABLE_AUTOCOMPACT: truthy("zavorth_DISABLE_AUTOCOMPACT"),
  zavorth_DISABLE_MODELS_FETCH: truthy("zavorth_DISABLE_MODELS_FETCH"),
  zavorth_DISABLE_MOUSE: truthy("zavorth_DISABLE_MOUSE"),
  zavorth_OUTPUT_LENGTH_CONTINUATION_LIMIT: number("zavorth_OUTPUT_LENGTH_CONTINUATION_LIMIT") ?? 3,
  zavorth_INVALID_OUTPUT_CONTINUATION_LIMIT: number("zavorth_INVALID_OUTPUT_CONTINUATION_LIMIT") ?? 2,
  zavorth_TEXT_TOOL_CALL_RETRY_LIMIT: number("zavorth_TEXT_TOOL_CALL_RETRY_LIMIT") ?? 2,

  // Consecutive-block repetition detection for streamed reasoning + text.
  // A block of at least N tokens repeating REPEAT_THRESHOLD times consecutively
  // within the last WINDOW_TOKENS tokens triggers recovery (remind → replan → terminate).
  zavorth_TEXT_NGRAM_N: number("zavorth_TEXT_NGRAM_N") ?? 4,
  zavorth_TEXT_REPEAT_THRESHOLD: number("zavorth_TEXT_REPEAT_THRESHOLD") ?? 20,
  zavorth_TEXT_WINDOW_TOKENS: number("zavorth_TEXT_WINDOW_TOKENS") ?? 500,

  // Caps applied to image attachments before a prompt is sent. Both default to
  // undefined (no limit). zavorth_MAX_PROMPT_IMAGES bounds how many images may
  // be sent per request (oldest excess images are dropped); zavorth_MAX_PROMPT_IMAGE_SIZE
  // bounds the decoded byte size of a single image. Values must be positive integers.
  zavorth_MAX_PROMPT_IMAGES: number("zavorth_MAX_PROMPT_IMAGES"),
  zavorth_MAX_PROMPT_IMAGE_SIZE: number("zavorth_MAX_PROMPT_IMAGE_SIZE"),
  zavorth_STANDALONE,
  zavorth_DISABLE_PROVIDER_ENV: zavorth_STANDALONE || truthy("zavorth_DISABLE_PROVIDER_ENV"),
  zavorth_DISABLE_CLAUDE_CODE,
  get zavorth_DISABLE_CLAUDE_CODE_MCP() {
    // MCP compatibility stays on in zavorth-only mode so users can reuse external
    // MCP server configs without inheriting prompts, skills, or provider env keys.
    return zavorth_DISABLE_CLAUDE_CODE_ENV || truthy("zavorth_DISABLE_CLAUDE_CODE_MCP")
  },
  zavorth_DISABLE_CLAUDE_CODE_PROMPT: zavorth_DISABLE_CLAUDE_CODE || truthy("zavorth_DISABLE_CLAUDE_CODE_PROMPT"),
  // Defaults to false (enabled): markdown commands under shared external agent
  // command folders (legacy ~/.claude/commands and project .claude/commands) load
  // as slash commands. Independent of the zavorth-only master switch.
  // Set zavorth_DISABLE_CLAUDE_CODE_COMMANDS=true to disable.
  zavorth_DISABLE_CLAUDE_CODE_COMMANDS: truthy("zavorth_DISABLE_CLAUDE_CODE_COMMANDS"),
  zavorth_DISABLE_CLAUDE_CODE_SKILLS,
  zavorth_DISABLE_EXTERNAL_SKILLS,
  zavorth_DISABLE_CODEX_SKILLS: zavorth_DISABLE_EXTERNAL_SKILLS || truthy("zavorth_DISABLE_CODEX_SKILLS"),
  zavorth_DISABLE_LEGACY_SKILLS: zavorth_DISABLE_EXTERNAL_SKILLS || truthy("zavorth_DISABLE_LEGACY_SKILLS"),
  zavorth_FAKE_VCS: process.env["zavorth_FAKE_VCS"],

  // When enabled, skips all git subprocess calls during project discovery
  // (which git, rev-parse --git-common-dir, rev-parse --show-toplevel) and
  // branch detection. The project is treated as a non-git directory rooted at
  // the working directory. Use to avoid touching git in restricted/sandboxed
  // environments or where git startup probing is undesirable.
  zavorth_DISABLE_GIT: truthy("zavorth_DISABLE_GIT"),
  zavorth_SERVER_PASSWORD: process.env["zavorth_SERVER_PASSWORD"],
  zavorth_SERVER_USERNAME: process.env["zavorth_SERVER_USERNAME"],
  zavorth_ENABLE_QUESTION_TOOL: truthy("zavorth_ENABLE_QUESTION_TOOL"),

  // Defaults to false. The edit tool does pure exact-string matching with
  // explicit error signals. Set zavorth_ENABLE_FUZZY_EDIT=true to opt into the
  // legacy multi-stage fuzzy fallback chain (line-trimmed / block-anchor /
  // whitespace-normalized / indentation-flexible / etc.) when old_string fails
  // to match exactly.
  zavorth_ENABLE_FUZZY_EDIT: truthy("zavorth_ENABLE_FUZZY_EDIT"),

  // Experimental
  zavorth_EXPERIMENTAL,
  zavorth_EXPERIMENTAL_FILEWATCHER: Config.boolean("zavorth_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  zavorth_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("zavorth_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  zavorth_EXPERIMENTAL_ICON_DISCOVERY: zavorth_EXPERIMENTAL || truthy("zavorth_EXPERIMENTAL_ICON_DISCOVERY"),
  zavorth_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("zavorth_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  zavorth_ENABLE_EXA: truthy("zavorth_ENABLE_EXA") || zavorth_EXPERIMENTAL || truthy("zavorth_EXPERIMENTAL_EXA"),
  zavorth_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: number("zavorth_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  // Token-efficient post-cleanse: strip ANSI / fold \r progress bars / redact
  // secrets / elide super-long lines from bash tool output before it is
  // returned to the model. Only applies when the output fits inline — if the
  // output spills to a truncation file, cleaning is skipped so the on-disk
  // archive stays raw. Off by default. Set to 1/true to opt in.
  zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY: truthy("zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY"),
  // Tunables for the token-efficient post-cleanse pipeline (see
  // src/tool/bash_token_efficient_pipeline.ts). Positive integers only;
  // unset / non-positive values fall back to the documented defaults.
  //   MAX_LINE_CHARS   threshold above which a single line is elided  (default 500)
  //   LINE_HEAD_KEEP   chars kept from the head of an elided line     (default 160)
  //   NEVER_WORSE_MARGIN  bytes the cleaned output must beat the raw  (default 0)
  zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY_MAX_LINE_CHARS: number("zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY_MAX_LINE_CHARS") ?? 500,
  zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY_LINE_HEAD_KEEP: number("zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY_LINE_HEAD_KEEP") ?? 160,
  zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY_NEVER_WORSE_MARGIN: number("zavorth_EXPERIMENTAL_TOKEN_EFFICIENCY_NEVER_WORSE_MARGIN") ?? 0,
  zavorth_EXPERIMENTAL_OUTPUT_TOKEN_MAX: number("zavorth_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  zavorth_EXPERIMENTAL_OXFMT: zavorth_EXPERIMENTAL || truthy("zavorth_EXPERIMENTAL_OXFMT"),
  zavorth_EXPERIMENTAL_LSP_TY: truthy("zavorth_EXPERIMENTAL_LSP_TY"),
  zavorth_EXPERIMENTAL_LSP_TOOL: zavorth_EXPERIMENTAL || truthy("zavorth_EXPERIMENTAL_LSP_TOOL"),
  // Defaults to true: dynamic workflow + built-in deep-research are on by default.
  // Set zavorth_EXPERIMENTAL_WORKFLOW_TOOL=false to opt out. The env-var name is
  // kept for backwards compat (long-running experiments still pass it as `1`).
  zavorth_EXPERIMENTAL_WORKFLOW_TOOL: !falsy("zavorth_EXPERIMENTAL_WORKFLOW_TOOL"),
  // Safe-off by default: host Goal Loop / AutonomySchedulePlane covers unattended
  // schedules. Opt in with zavorth_EXPERIMENTAL_CRON=true. Runtime kill switch is
  // zavorth_DISABLE_CRON (checked live every tick).
  zavorth_EXPERIMENTAL_CRON: truthy("zavorth_EXPERIMENTAL_CRON"),
  // Keepalive contract for self-paced loops (spec [S8]). Budget = how many
  // "forget" turns the model gets before the loop is declared model_stopped;
  // delay seconds = the auto-arm horizon used for the keepalive fire. Budget
  // accepts 0 (end immediately on the first turn without a re-arm) for tests
  // and aggressive policies. Both are getters so tests can flip the env var
  // between cases without restarting the process.
  get zavorth_LOOP_KEEPALIVE_BUDGET() {
    return nonNegativeNumber("zavorth_LOOP_KEEPALIVE_BUDGET") ?? 1
  },
  get zavorth_LOOP_KEEPALIVE_DELAY_S() {
    return number("zavorth_LOOP_KEEPALIVE_DELAY_S") ?? 1200
  },
  zavorth_EXPERIMENTAL_MARKDOWN: !falsy("zavorth_EXPERIMENTAL_MARKDOWN"),
  zavorth_MODELS_URL: process.env["zavorth_MODELS_URL"],
  zavorth_MODELS_PATH: process.env["zavorth_MODELS_PATH"],
  zavorth_DISABLE_EMBEDDED_WEB_UI: truthy("zavorth_DISABLE_EMBEDDED_WEB_UI"),
  zavorth_DB: process.env["zavorth_DB"],

  // Defaults to true — all channels share a single zavorth.db. The per-channel
  // DB isolation (zavorth-{channel}.db) is unnecessary for zavorth since we
  // don't ship multiple release channels yet. Use zavorth_HOME to isolate dev
  // environments instead. Set zavorth_DISABLE_CHANNEL_DB=false to restore
  // per-channel isolation.
  zavorth_DISABLE_CHANNEL_DB: !falsy("zavorth_DISABLE_CHANNEL_DB"),
  zavorth_SKIP_MIGRATIONS: truthy("zavorth_SKIP_MIGRATIONS"),
  zavorth_STRICT_CONFIG_DEPS: truthy("zavorth_STRICT_CONFIG_DEPS"),

  zavorth_WORKSPACE_ID: process.env["zavorth_WORKSPACE_ID"],
  zavorth_EXPERIMENTAL_HTTPAPI: truthy("zavorth_EXPERIMENTAL_HTTPAPI"),
  zavorth_EXPERIMENTAL_WORKSPACES: zavorth_EXPERIMENTAL || truthy("zavorth_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.

  // Disables compose-agent-internal skills (e.g. compose:plan, compose:review,
  // compose:tdd). These are hidden workflow-orchestration skills only visible
  // to the compose agent and are NOT part of builtin skills.
  get zavorth_DISABLE_COMPOSE_SKILLS() {
    return truthy("zavorth_DISABLE_COMPOSE_SKILLS")
  },
  // Disables user-facing builtin skills shipped with the binary (e.g.
  // self-extend). Does not affect compose skills — the two sets are
  // independent and non-overlapping.
  get zavorth_DISABLE_BUILTIN_SKILLS() {
    return truthy("zavorth_DISABLE_BUILTIN_SKILLS")
  },
  get zavorth_DISABLE_PROJECT_CONFIG() {
    return truthy("zavorth_DISABLE_PROJECT_CONFIG")
  },
  get zavorth_TUI_CONFIG() {
    return process.env["zavorth_TUI_CONFIG"]
  },
  get zavorth_CONFIG_DIR() {
    return process.env["zavorth_CONFIG_DIR"]
  },
  get zavorth_HOME() {
    return process.env["zavorth_HOME"]
  },
  get zavorth_PURE() {
    return truthy("zavorth_PURE")
  },
  get zavorth_PLUGIN_META_FILE() {
    return process.env["zavorth_PLUGIN_META_FILE"]
  },
  get zavorth_CLIENT() {
    return process.env["zavorth_CLIENT"] ?? "cli"
  },
}
