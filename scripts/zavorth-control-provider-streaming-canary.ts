#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorth-control-provider-streaming-canary");

type ProviderTarget = {
  providerName: string;
  modelName: string | null;
  source?: string;
  runnable?: boolean;
  reason?: string;
};

type CheckStatus = "pass" | "fail" | "skip";

type ProviderResult = {
  providerName: string;
  modelName: string | null;
  status: CheckStatus;
  url: string;
  detail: string;
  metrics: Record<string, unknown>;
  screenshot: string | null;
};

type Report = {
  ok: boolean;
  mode: "dry-run" | "live";
  generatedAt: string;
  url: string;
  apiBase: string | null;
  outDir: string;
  providers: ProviderResult[];
  checks: Array<{ id: string; status: CheckStatus; detail: string }>;
  safety: {
    fakeServerUsed: false;
    providerFallbackDisabled: true;
    noSecretValuesSerialized: true;
    dashboardBridgeUsed: true;
  };
};

type Options = {
  url: string;
  apiBase: string;
  outDir: string;
  token: string;
  runLive: boolean;
  requirePass: boolean;
  timeoutMs: number;
  providers: ProviderTarget[];
};

function readCliValue(name: string): string {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return String(arg?.slice(prefix.length) || "").trim();
}

function readEnvTokenFromFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*ZAVORTH_WEB_AUTH_TOKEN\s*=\s*(.+?)\s*$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function readEnvValueFromFile(filePath: string, key: string): string {
  if (!fs.existsSync(filePath)) return "";
  const raw = fs.readFileSync(filePath, "utf8");
  const matcher = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(.+?)\\s*$`);
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(matcher);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function readRuntimeTokenFile(): string {
  const tokenFile = path.join(rootDir, "data", "runtime", "web-api-token.txt");
  if (!fs.existsSync(tokenFile)) return "";
  return fs.readFileSync(tokenFile, "utf8").trim();
}

const referenceProviderIds = [
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "anthropic-vertex",
  "byteplus",
  "chutes",
  "comfy",
  "deepseek",
  "github-copilot",
  "google",
  "groq",
  "github-copilot",
  "huggingface",
  "kimi-coding",
  "lmstudio",
  "microsoft",
  "microsoft-foundry",
  "minimax",
  "mistral",
  "qwen",
  "moonshot",
  "nvidia",
  "ollama",
  "openrouter",
  "qianfan",
  "stepfun",
  "together",
  "venice",
  "volcengine",
  "xai",
  "zai",
  "openai",
];

const zavorthProviderIds = [
  "aigateway",
  "gemini",
  "gemini-interactions",
  "bedrock-claude",
  "byteplus",
  "chutes",
  "comfy",
  "deepseek",
  "openai",
  "minimax",
  "openrouter",
  "groq",
  "huggingface",
  "kimi-coding",
  "qwen",
  "puter",
  "opencode",
  "claude-agent-sdk",
  "anthropic-direct",
  "anthropic-vertex",
  "google-genai",
  "lmstudio",
  "microsoft",
  "microsoft-foundry",
  "mistral",
  "moonshot",
  "nvidia",
  "qianfan",
  "stepfun",
  "together",
  "venice",
  "vllm",
  "ollama",
  "xai",
  "zai",
  "custom-openai-compatible",
];

const zavorthRunnableProviderIds = new Set(zavorthProviderIds);

const referenceToZavorthProviderAliases: Record<string, string> = {
  "amazon-bedrock": "bedrock-claude",
  "amazon-bedrock-mantle": "bedrock-claude",
  anthropic: "anthropic-direct",
  google: "gemini",
  volcengine: "byteplus",
};

function defaultProviderTargets(envPath: string): ProviderTarget[] {
  const envValue = (key: string, fallback: string) =>
    String(process.env[key] || readEnvValueFromFile(envPath, key) || fallback).trim();
  const explicitModels: Record<string, string> = {
    aigateway: envValue("AIGateway_MODEL", envValue("ZAVORTH_MODEL_ID", "auto")),
    gemini: envValue("GEMINI_MODEL", "gemini-2.5-flash"),
    "gemini-interactions": envValue("GEMINI_INTERACTIONS_MODEL", envValue("GEMINI_MODEL", "gemini-3.5-flash")),
    deepseek: envValue("DEEPSEEK_MODEL", "deepseek-chat"),
    openai: envValue("OPENAI_MODEL", "gpt-4o-mini"),
    minimax: envValue("MINIMAX_MODEL", "MiniMax-M2.7"),
    openrouter: envValue("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet:beta"),
    groq: envValue("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "github-copilot": envValue("GITHUB_COPILOT_MODEL", "gpt-4o"),
    qwen: envValue("QWEN_MODEL", "openrouter:qwen/qwen3.5-plus-02-15"),
    puter: envValue("QWEN_MODEL", "openrouter:qwen/qwen3.5-plus-02-15"),
    opencode: envValue("OPENCODE_MODEL", "opencode/minimax-m2.5-free"),
    "claude-agent-sdk": envValue("CLAUDE_AGENT_SDK_MODEL", "claude-sonnet-4-6"),
    "anthropic-direct": envValue("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
    "anthropic-vertex": envValue("ANTHROPIC_VERTEX_MODEL", "claude-sonnet-4-6"),
    "bedrock-claude": envValue("BEDROCK_CLAUDE_MODEL", "anthropic.claude-sonnet-4-5-20250929-v1:0"),
    byteplus: envValue("BYTEPLUS_MODEL", "doubao-seed-1-6"),
    chutes: envValue("CHUTES_MODEL", "deepseek-ai/DeepSeek-V3"),
    comfy: envValue("COMFY_MODEL", "local-model"),
    "google-genai": envValue("GOOGLE_GENAI_MODEL", envValue("GEMINI_MODEL", "gemini-2.5-flash")),
    huggingface: envValue("HUGGINGFACE_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),
    "kimi-coding": envValue("KIMI_CODING_MODEL", envValue("MOONSHOT_MODEL", "kimi-k2-0711-preview")),
    lmstudio: envValue("LMSTUDIO_MODEL", "local-model"),
    microsoft: envValue("MICROSOFT_MODEL", "gpt-4o"),
    "microsoft-foundry": envValue("MICROSOFT_FOUNDRY_MODEL", "gpt-4o"),
    mistral: envValue("MISTRAL_MODEL", "mistral-large-latest"),
    moonshot: envValue("MOONSHOT_MODEL", "moonshot-v1-128k"),
    nvidia: envValue("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct"),
    qianfan: envValue("QIANFAN_MODEL", "ernie-4.0-turbo-8k"),
    stepfun: envValue("STEPFUN_MODEL", "step-2-mini"),
    together: envValue("TOGETHER_MODEL", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    venice: envValue("VENICE_MODEL", "llama-3.3-70b"),
    vllm: envValue("VLLM_MODEL", "local-model"),
    ollama: envValue("OLLAMA_MODEL", "llama3.1"),
    xai: envValue("XAI_MODEL", "grok-4"),
    zai: envValue("ZAI_MODEL", "glm-4.5"),
    "custom-openai-compatible": envValue("CUSTOM_OPENAI_COMPATIBLE_MODEL", "custom-model"),
  };

  const byProvider = new Map<string, ProviderTarget>();
  for (const providerName of zavorthProviderIds) {
    byProvider.set(providerName, {
      providerName,
      modelName: explicitModels[providerName] || null,
      source: "zavorth",
      runnable: zavorthRunnableProviderIds.has(providerName),
    });
  }
  for (const referenceId of referenceProviderIds) {
    const zavorthRoute = referenceToZavorthProviderAliases[referenceId] || referenceId;
    const existing = byProvider.get(zavorthRoute);
    if (existing) {
      const currentSource = existing.source || "zavorth";
      existing.source = currentSource.includes(`reference:${referenceId}`)
        ? currentSource
        : `${currentSource}+reference:${referenceId}`;
      continue;
    }
    byProvider.set(zavorthRoute, {
      providerName: zavorthRoute,
      modelName: explicitModels[zavorthRoute] || null,
      source: `reference:${referenceId}`,
      runnable: true,
      reason: `Reference provider "${referenceId}" is executed through Zavorth's native provider-factory compatibility route.`,
    });
  }
  return Array.from(byProvider.values()).sort((left, right) => left.providerName.localeCompare(right.providerName));
}

function hasEnvOrFileValue(key: string): boolean {
  return Boolean(process.env[key] || readEnvValueFromFile(path.join(rootDir, ".env"), key));
}

function envPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function missingProviderCredential(providerName: string): string | null {
  const normalized = providerName.trim().toLowerCase();
  if (normalized === "aigateway" && !hasEnvOrFileValue("AIGateway_API_KEY") && !hasEnvOrFileValue("ZAVORTH_AIGateway_GATEWAY_ENABLED")) return null;
  if (normalized === "openai" && !hasEnvOrFileValue("OPENAI_API_KEY")) return "OPENAI_API_KEY";
  if (normalized === "openrouter" && !hasEnvOrFileValue("OPENROUTER_API_KEY")) return "OPENROUTER_API_KEY";
  if (normalized === "gemini" && !hasEnvOrFileValue("GEMINI_API_KEY")) return "GEMINI_API_KEY";
  if (normalized === "gemini-interactions" && !hasEnvOrFileValue("GEMINI_INTERACTIONS_API_KEY") && !hasEnvOrFileValue("GEMINI_API_KEY")) return "GEMINI_INTERACTIONS_API_KEY or GEMINI_API_KEY";
  if (normalized === "deepseek" && !hasEnvOrFileValue("DEEPSEEK_API_KEY")) return "DEEPSEEK_API_KEY";
  if (normalized === "minimax" && !hasEnvOrFileValue("MINIMAX_API_KEY")) return "MINIMAX_API_KEY";
  if (normalized === "groq" && !hasEnvOrFileValue("GROQ_API_KEY")) return "GROQ_API_KEY";
  if ((normalized === "qwen" || normalized === "puter") && !hasEnvOrFileValue("PUTER_AUTH_TOKEN") && !hasEnvOrFileValue("QWEN_PUTER_AUTH_TOKEN")) return "PUTER_AUTH_TOKEN or QWEN_PUTER_AUTH_TOKEN";
  if (normalized === "opencode" && !hasEnvOrFileValue("OPENCODE_API_KEY")) return "OPENCODE_API_KEY";
  if (normalized === "github-copilot") {
    const hasCopilotCredential = hasEnvOrFileValue("GITHUB_COPILOT_OAUTH_TOKEN")
      || hasEnvOrFileValue("GITHUB_COPILOT_API_KEY")
      || hasEnvOrFileValue("COPILOT_API_KEY");
    if (!hasCopilotCredential && !hasEnvOrFileValue("GITHUB_COPILOT_BASE_URL") && !hasEnvOrFileValue("COPILOT_BASE_URL")) {
      return "GITHUB_COPILOT_OAUTH_TOKEN/COPILOT_API_KEY and GITHUB_COPILOT_BASE_URL/COPILOT_BASE_URL";
    }
    if (!hasCopilotCredential) return "GITHUB_COPILOT_OAUTH_TOKEN, GITHUB_COPILOT_API_KEY, or COPILOT_API_KEY";
    if (!hasEnvOrFileValue("GITHUB_COPILOT_BASE_URL") && !hasEnvOrFileValue("COPILOT_BASE_URL")) return "GITHUB_COPILOT_BASE_URL or COPILOT_BASE_URL";
  }
  if (normalized === "claude-agent-sdk" && !hasEnvOrFileValue("ANTHROPIC_API_KEY") && !hasEnvOrFileValue("CLAUDE_CODE_OAUTH_TOKEN")) return "ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN";
  if (normalized === "anthropic-direct" && !hasEnvOrFileValue("ANTHROPIC_API_KEY")) return "ANTHROPIC_API_KEY";
  if (normalized === "anthropic-vertex" && !hasEnvOrFileValue("ANTHROPIC_VERTEX_PROJECT_ID") && !hasEnvOrFileValue("GOOGLE_CLOUD_PROJECT")) return "ANTHROPIC_VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT";
  if (normalized === "bedrock-claude" && !hasEnvOrFileValue("AWS_REGION") && !hasEnvOrFileValue("AWS_DEFAULT_REGION")) return "AWS_REGION or AWS_DEFAULT_REGION";
  if (normalized === "google-genai" && !hasEnvOrFileValue("GOOGLE_GENAI_API_KEY") && !hasEnvOrFileValue("GEMINI_API_KEY") && !hasEnvOrFileValue("GOOGLE_CLOUD_PROJECT")) return "GOOGLE_GENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_CLOUD_PROJECT";
  if (normalized === "custom-openai-compatible" && (!hasEnvOrFileValue("CUSTOM_OPENAI_COMPATIBLE_BASE_URL") || !hasEnvOrFileValue("CUSTOM_OPENAI_COMPATIBLE_API_KEY"))) return "CUSTOM_OPENAI_COMPATIBLE_BASE_URL and CUSTOM_OPENAI_COMPATIBLE_API_KEY";
  if (["lmstudio", "ollama", "vllm", "comfy"].includes(normalized)) return null;
  if ([
    "byteplus",
    "chutes",
    "huggingface",
    "kimi-coding",
    "microsoft",
    "microsoft-foundry",
    "mistral",
    "moonshot",
    "nvidia",
    "qianfan",
    "stepfun",
    "together",
    "venice",
    "xai",
    "zai",
  ].includes(normalized)) {
    const prefix = envPrefix(normalized);
    const hasApiKey = hasEnvOrFileValue(`${prefix}_API_KEY`);
    const needsBaseUrl = ["microsoft", "microsoft-foundry"].includes(normalized);
    if (!hasApiKey && needsBaseUrl) return `${prefix}_API_KEY and ${prefix}_BASE_URL`;
    if (!hasApiKey) return `${prefix}_API_KEY`;
    if (needsBaseUrl && !hasEnvOrFileValue(`${prefix}_BASE_URL`)) return `${prefix}_BASE_URL`;
  }
  return null;
}

function parseProviders(value: string, defaults: ProviderTarget[]): ProviderTarget[] {
  const defaultModelByProvider = new Map(
    defaults.map((target) => [target.providerName.toLowerCase(), target.modelName]),
  );
  const entries = String(value || defaults.map((target) => `${target.providerName}:${target.modelName || ""}`).join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.map((entry) => {
    const [providerName, ...modelParts] = entry.split(":");
    const defaultTarget = defaults.find((target) => target.providerName.toLowerCase() === providerName.trim().toLowerCase());
    return {
      providerName: providerName.trim(),
      modelName: modelParts.join(":").trim() || defaultModelByProvider.get(providerName.trim().toLowerCase()) || null,
      source: defaultTarget?.source || "cli",
      runnable: defaultTarget?.runnable ?? true,
      reason: defaultTarget?.reason,
    };
  });
}

function readOptions(): Options {
  const tokenArg = readCliValue("token");
  const envToken = String(process.env.ZAVORTH_WEB_AUTH_TOKEN || "").trim();
  const envPath = path.join(rootDir, ".env");
  const envFileToken = readEnvTokenFromFile(envPath);
  const tokenFile = readRuntimeTokenFile();
  return {
    url: readCliValue("url") || "http://127.0.0.1:3000/zavorthControl",
    apiBase: readCliValue("api-base"),
    outDir: path.resolve(rootDir, readCliValue("out") || defaultOutDir),
    token: tokenArg || envToken || envFileToken || tokenFile,
    runLive: process.argv.includes("--run-live") || process.argv.includes("--live"),
    requirePass: process.argv.includes("--require-pass"),
    timeoutMs: Number(readCliValue("timeout-ms") || 90_000) || 90_000,
    providers: parseProviders(readCliValue("providers"), defaultProviderTargets(envPath)),
  };
}

function createReport(options: Options): Report {
  return {
    ok: true,
    mode: options.runLive ? "live" : "dry-run",
    generatedAt: new Date().toISOString(),
    url: options.url,
    apiBase: options.apiBase || null,
    outDir: options.outDir,
    providers: [],
    checks: [],
    safety: {
      fakeServerUsed: false,
      providerFallbackDisabled: true,
      noSecretValuesSerialized: true,
      dashboardBridgeUsed: true,
    },
  };
}

function addCheck(report: Report, id: string, status: CheckStatus, detail: string): void {
  report.checks.push({ id, status, detail });
  if (status === "fail") report.ok = false;
}

function writeReport(report: Report): void {
  fs.mkdirSync(report.outDir, { recursive: true });
  fs.writeFileSync(path.join(report.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(report.outDir, "summary.md"),
    [
      "# ZavorthControl Provider Streaming Canary",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `Mode: ${report.mode}`,
      `URL: ${report.url}`,
      `API base: ${report.apiBase || "same-origin"}`,
      "",
      "## Providers",
      "",
      ...report.providers.map((item) => {
        const source = item.metrics?.source ? ` (${item.metrics.source})` : "";
        return `- [${item.status === "pass" ? "x" : item.status === "skip" ? "-" : " "}] ${item.providerName}${item.modelName ? `:${item.modelName}` : ""}${source}: ${item.detail}`;
      }),
      "",
      "## Checks",
      "",
      ...report.checks.map((item) => `- [${item.status === "pass" ? "x" : item.status === "skip" ? "-" : " "}] ${item.id}: ${item.detail}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

function providerSessionId(providerName: string): string {
  return `provider-stream-${providerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}`;
}

function buildUrl(baseUrl: string, token: string, sessionId: string): string {
  const url = new URL(baseUrl);
  if (token) url.searchParams.set("token", token);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("fresh", String(Date.now()));
  return url.toString();
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.searchParams.has("token")) url.searchParams.set("token", "[redacted]");
    return url.toString();
  } catch {
    return String(value || "").replace(/token=[^&#\s]+/gi, "token=[redacted]");
  }
}

function redactText(value: unknown): string {
  return String(value || "")
    .replace(/token=[^&#\s"']+/gi, "token=[redacted]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[redacted]");
}

type DashboardProxy = {
  url: string;
  close: () => Promise<void>;
};

function contentTypeFor(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function sendStaticFile(response: http.ServerResponse, filePath: string): void {
  response.writeHead(200, {
    "content-type": contentTypeFor(filePath),
    "cache-control": "no-store",
  });
  fs.createReadStream(filePath).pipe(response);
}

function resolveStaticPath(requestUrl: string, staticDir: string): string {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  const pathname = decodeURIComponent(parsed.pathname);
  const normalizedPath =
    pathname === "/" || pathname === "/zavorthControl" || pathname === "/zavorthControl/"
      ? "/index.html"
      : pathname;
  const candidate = path.resolve(staticDir, normalizedPath.replace(/^\/+/, ""));
  if (!candidate.startsWith(staticDir)) return path.join(staticDir, "index.html");
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return path.join(staticDir, "index.html");
}

function proxyApiRequest(
  apiBase: string,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): void {
  const targetUrl = new URL(request.url || "/", apiBase);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const headers = {
    ...request.headers,
    host: targetUrl.host,
    origin: targetUrl.origin,
    referer: `${targetUrl.origin}/zavorthControl`,
  };
  const proxyRequest = transport.request(
    targetUrl,
    {
      method: request.method,
      headers,
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    },
  );
  proxyRequest.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    }
    response.end(JSON.stringify({ ok: false, error: redactText(error.message) }));
  });
  request.pipe(proxyRequest);
}

async function startDashboardProxy(apiBase: string): Promise<DashboardProxy> {
  const staticDir = path.join(rootDir, "src", "zavorth-control", "public", "zavorth-control-vite-shell");
  const indexPath = path.join(staticDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Dashboard build not found at ${indexPath}. Run npm run zavorth-control-vite:build first.`);
  }
  const sockets = new Set<any>();
  const server = http.createServer((request, response) => {
    const requestUrl = request.url || "/";
    if (requestUrl.startsWith("/api/")) {
      proxyApiRequest(apiBase, request, response);
      return;
    }
    sendStaticFile(response, resolveStaticPath(requestUrl, staticDir));
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Dashboard proxy did not expose a TCP address.");
  }
  return {
    url: `http://127.0.0.1:${address.port}/zavorthControl`,
    close: () =>
      new Promise<void>((resolve) => {
        (server as any).closeAllConnections?.();
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
        setTimeout(resolve, 500).unref?.();
      }),
  };
}

async function installObserver(page: any): Promise<void> {
  await page.evaluate(`(() => {
    const metrics = {
      events: [],
      samples: [],
    };
    window.__zavorthProviderStreamingCanary = metrics;
    const chat = window.ZavorthControlChat || {};
    const original = chat.ingestAgentStreamEvent;
    if (typeof original === "function" && !chat.__providerStreamingCanaryWrapped) {
      chat.ingestAgentStreamEvent = function(event, options) {
        const payload = event?.payload || event || {};
        metrics.events.push({
          eventType: payload.eventType || event?.eventType || event?.type || "",
          phase: payload.phase || "",
          done: payload.done === true,
          providerName: payload.providerName || "",
          modelName: payload.modelName || "",
          providerNativeTokenStreaming: payload.providerNativeTokenStreaming === true,
          title: payload.title || "",
          message: payload.message || payload.error || payload.reason || "",
          status: payload.status || "",
          accumulated: payload.accumulated || "",
          delta: payload.delta || "",
          at: Date.now(),
        });
        return original.call(this, event, options);
      };
      chat.__providerStreamingCanaryWrapped = true;
    }
    const feed = document.getElementById("neural-feed") || document.body;
    const sample = () => {
      const groups = Array.from(document.querySelectorAll(".echo-group--agent-stream"));
      const group = groups[groups.length - 1];
      const bubble = group?.querySelector(".echo-bubble");
      if (!bubble) return;
      metrics.samples.push({
        text: String(bubble.textContent || "").replace(/\\s+/g, " ").trim(),
        className: group.className,
        at: Date.now(),
      });
    };
    new MutationObserver(sample).observe(feed, { childList: true, subtree: true, characterData: true, attributes: true });
    sample();
  })()`);
}

async function forceRealtimeConnection(page: any): Promise<void> {
  await page.evaluate(`(() => {
    const bridge = window.ZavorthRuntimeBridge;
    if (!bridge?.state || typeof bridge.connectRealtime !== "function") return false;
    bridge.state.zavorthControl = {
      ...(bridge.state.zavorthControl || {}),
      live: true,
      authRequired: false,
      status: "live-canary",
    };
    bridge.connectRealtime();
    return true;
  })()`);
}

async function sendProviderCanary(page: any, target: ProviderTarget, timeoutMs: number): Promise<Record<string, unknown>> {
  await page.evaluate(`window.__zavorthProviderStreamingCanaryTarget = ${JSON.stringify(target)}`);
  await page.evaluate(`(() => {
    const target = window.__zavorthProviderStreamingCanaryTarget || {};
    const providerName = String(target.providerName || "");
    const modelName = target.modelName ? String(target.modelName) : null;
    const metrics = window.__zavorthProviderStreamingCanary || { events: [], samples: [] };
    window.__zavorthProviderStreamingCanary = metrics;
    try {
      const url = new URL(window.location.href);
      const token = sessionStorage.getItem("zavorth.zavorthControl.webToken") || url.searchParams.get("token") || "";
      const sessionId = url.searchParams.get("sessionId") || "provider-stream-session";
      metrics.sendStartedAt = Date.now();
      window.__zavorthProviderStreamingCanarySend = fetch("/api/web/chat/side", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Zavorth-Token": token } : {}),
        },
        body: JSON.stringify({
          message: [
            "Provider streaming canary.",
            "Provider: " + providerName + ".",
            "Answer with one short sentence. Do not use tools.",
          ].join(" "),
          sessionId,
          sideSessionId: sessionId,
          kind: "provider-streaming-canary",
          providerName,
          modelName: modelName || undefined,
          allowProviderFallback: false,
          composerSettings: { canary: "provider-native-token-streaming" },
        }),
      }).then(async (response) => {
          const rawText = await response.text().catch(() => "");
          let payload = {};
          try {
            payload = rawText ? JSON.parse(rawText) : {};
          } catch {
            payload = { ok: false, rawText: rawText.slice(0, 2000) };
          }
          metrics.lastChatSideResponse = {
            status: response.status,
            ok: response.ok,
            body: typeof payload === "object" && payload ? payload : {},
          };
          if (!response.ok || payload?.ok === false) {
            throw new Error(payload?.detail || payload?.error || ("HTTP " + response.status));
          }
          metrics.sendCompletedAt = Date.now();
          metrics.responseSummary = {
            ok: payload?.ok,
            status: payload?.status,
            sessionId: payload?.sessionId || payload?.snapshot?.sessionId || "",
            taskId: payload?.taskId || payload?.response?.taskId || "",
            runId: payload?.runId || payload?.agentRunId || payload?.response?.runId || "",
            providerName: payload?.providerName || payload?.metadata?.providerName || payload?.response?.providerName || "",
            modelName: payload?.modelName || payload?.metadata?.modelName || payload?.response?.modelName || "",
            streamEventCount: Array.isArray(payload?.streamEvents) ? payload.streamEvents.length : 0,
            hasAssistantReply: Boolean(payload?.assistantReply || payload?.reply || payload?.response?.text || payload?.response?.content),
            keys: Object.keys(payload || {}).slice(0, 24),
          };
        },
        (error) => { metrics.sendError = String(error?.message || error); },
      );
    } catch (error: unknown) {
      metrics.sendError = String(error?.message || error);
    }
  })()`);

  await page.waitForFunction(
    `(() => {
      const metrics = window.__zavorthProviderStreamingCanary || {};
      if (metrics.sendError) return true;
      const events = metrics.events || [];
      const delta = events.find((event) => event.eventType === "agent.stream.assistant" && event.phase === "delta");
      const done = events.find((event) => event.eventType === "agent.stream.assistant" && (event.done || event.phase === "done"));
      return Boolean(delta && done && delta.at <= done.at);
    })()`,
    null,
    { timeout: timeoutMs },
  );

  return await page.evaluate(`(() => {
    const metrics = window.__zavorthProviderStreamingCanary || {};
    const events = metrics.events || [];
    const samples = metrics.samples || [];
    const delta = events.find((event) => event.eventType === "agent.stream.assistant" && event.phase === "delta");
    const done = events.find((event) => event.eventType === "agent.stream.assistant" && (event.done || event.phase === "done"));
    const nativeDelta = events.find((event) => event.eventType === "agent.stream.assistant" && event.phase === "delta" && event.providerNativeTokenStreaming === true);
    const finalSample = samples.slice().reverse().find((sample) => /\\bis-complete\\b/.test(sample.className)) || samples[samples.length - 1] || null;
    return {
      sendStartedAt: metrics.sendStartedAt || 0,
      sendCompletedAt: metrics.sendCompletedAt || 0,
      sendError: metrics.sendError || "",
      responseSummary: metrics.responseSummary || null,
      eventCount: events.length,
      sampleCount: samples.length,
      events: events.slice(-16),
      deltaAt: delta?.at || 0,
      doneAt: done?.at || 0,
      deltaBeforeDone: Boolean(delta && done && delta.at <= done.at),
      nativeTokenStreaming: Boolean(nativeDelta),
      observedProviderNames: Array.from(new Set(events.map((event) => event.providerName).filter(Boolean))),
      observedModelNames: Array.from(new Set(events.map((event) => event.modelName).filter(Boolean))),
      finalText: finalSample?.text || "",
      finalClassName: finalSample?.className || "",
    };
  })()`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runProvider(browser: any, options: Options, target: ProviderTarget): Promise<ProviderResult> {
  const sessionId = providerSessionId(target.providerName);
  const url = buildUrl(options.url, options.token, sessionId);
  const outName = target.providerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  if (target.runnable === false) {
    return {
      providerName: target.providerName,
      modelName: target.modelName,
      status: "skip",
      url: redactUrl(url),
      detail: target.reason || "Provider is listed in the consistency matrix but is not runnable through Zavorth yet.",
      metrics: {
        source: target.source || null,
        runnable: false,
        eventCount: 0,
        deltaBeforeDone: false,
        nativeTokenStreaming: false,
      },
      screenshot: null,
    };
  }
  const missingCredential = missingProviderCredential(target.providerName);
  if (missingCredential) {
    return {
      providerName: target.providerName,
      modelName: target.modelName,
      status: "skip",
      url: redactUrl(url),
      detail: `${missingCredential} is not configured; live provider call was not attempted.`,
      metrics: {
        source: target.source || null,
        missingCredential,
        eventCount: 0,
        deltaBeforeDone: false,
        nativeTokenStreaming: false,
      },
      screenshot: null,
    };
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const runtimeErrors: string[] = [];
  const apiResponses: Array<{ url: string; status: number; contentType: string }> = [];
  page.on("console", (message: any) => {
    if (message.type() === "error" && !/^Failed to load resource:/i.test(message.text())) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error: any) => runtimeErrors.push(String(error?.message || error)));
  page.on("response", (response: any) => {
    const responseUrl = String(response.url() || "");
    if (!responseUrl.includes("/api/")) return;
    apiResponses.push({
      url: redactUrl(responseUrl),
      status: response.status(),
      contentType: String(response.headers()?.["content-type"] || ""),
    });
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("#compose-input", { timeout: 20_000 });
    await page.waitForFunction(`Boolean(window.ZavorthRuntimeBridge && window.ZavorthControlChat)`, null, { timeout: 20_000 });
    await installObserver(page);
    await forceRealtimeConnection(page);
    const metrics = await sendProviderCanary(page, target, options.timeoutMs);
    const screenshot = path.join(options.outDir, `${outName}-streaming.png`);
    await page.screenshot({ path: screenshot, fullPage: true });

    const observedProviders = Array.isArray(metrics.observedProviderNames) ? metrics.observedProviderNames.map(String) : [];
    const providerMatched = observedProviders.some((entry) => entry.toLowerCase() === target.providerName.toLowerCase());
    const passed = Boolean(metrics.deltaBeforeDone && metrics.nativeTokenStreaming && providerMatched && runtimeErrors.length === 0);
    return {
      providerName: target.providerName,
      modelName: target.modelName,
      status: passed ? "pass" : "fail",
      url: redactUrl(url),
      detail: passed
        ? "Native token stream observed in dashboard before done."
        : `Stream canary failed; observed providers=${observedProviders.join(", ") || "none"} errors=${runtimeErrors.join(" | ") || "none"}.`,
      metrics: {
        ...metrics,
        source: target.source || null,
        runtimeErrors,
        apiResponses,
      },
      screenshot,
    };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    let metrics: Record<string, unknown> = {};
    let screenshot: string | null = null;
    try {
      metrics = await page.evaluate(`(() => {
        const metrics = window.__zavorthProviderStreamingCanary || {};
        return {
          sendStartedAt: metrics.sendStartedAt || 0,
          sendCompletedAt: metrics.sendCompletedAt || 0,
          sendError: metrics.sendError || "",
          responseSummary: metrics.responseSummary || null,
          lastChatSideResponse: metrics.lastChatSideResponse || null,
          eventCount: Array.isArray(metrics.events) ? metrics.events.length : 0,
          sampleCount: Array.isArray(metrics.samples) ? metrics.samples.length : 0,
          events: Array.isArray(metrics.events) ? metrics.events.slice(-12) : [],
          finalSample: Array.isArray(metrics.samples) ? metrics.samples.slice(-1)[0] || null : null,
        };
      })()`);
      screenshot = path.join(options.outDir, `${outName}-failed.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
    } catch {
      metrics = {};
      screenshot = null;
    }
    const events = Array.isArray((metrics as any).events) ? (metrics as any).events : [];
    const failureEvent = events.find((event: any) => event?.eventType === "agent.execution.failed" && event?.message);
    return {
      providerName: target.providerName,
      modelName: target.modelName,
      status: "fail",
      url: redactUrl(url),
      detail: failureEvent?.message
        ? `Provider run failed: ${redactText(failureEvent.message)}`
        : redactText(error instanceof Error ? error.message : error),
      metrics: { ...metrics, source: target.source || null, runtimeErrors, apiResponses },
      screenshot,
    };
  } finally {
    await page.evaluate(`window.ZavorthRuntimeBridge?.disconnectRealtime?.("canary-complete")`).catch(() => undefined);
    await page.close().catch(() => undefined);
  }
}

async function main(): Promise<Report> {
  const options = readOptions();
  fs.mkdirSync(options.outDir, { recursive: true });
  let dashboardProxy: DashboardProxy | null = null;
  if (options.runLive && options.apiBase) {
    dashboardProxy = await startDashboardProxy(options.apiBase);
    options.url = dashboardProxy.url;
  }
  const report = createReport(options);

  if (!options.runLive) {
    for (const target of options.providers) {
      report.providers.push({
        providerName: target.providerName,
        modelName: target.modelName,
        status: "skip",
        url: options.url,
        detail: target.runnable === false
          ? (target.reason || "Provider is listed in the consistency matrix but is not runnable through Zavorth yet.")
          : "Dry-run only. Add --run-live to call the real dashboard and providers.",
        metrics: {
          source: target.source || null,
          runnable: target.runnable !== false,
          ...(target.runnable === false ? { consistencyOnly: true } : {}),
        },
        screenshot: null,
      });
    }
    addCheck(report, "live-execution-explicit", "skip", "No live provider call was made without --run-live.");
    writeReport(report);
    await dashboardProxy?.close();
    return report;
  }

  if (!options.token) {
    addCheck(report, "runtime-token-present", "fail", "No Zavorth web token found. Pass --token=... or set ZAVORTH_WEB_AUTH_TOKEN.");
    writeReport(report);
    await dashboardProxy?.close();
    return report;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of options.providers) {
      const result = await runProvider(browser, options, target);
      report.providers.push(result);
      addCheck(report, `provider-${target.providerName}`, result.status, result.detail);
      report.ok = report.checks.every((check) => check.status !== "fail");
      writeReport(report);
    }
  } finally {
    await browser.close().catch(() => undefined);
    await dashboardProxy?.close();
  }

  report.ok = report.checks.every((check) => check.status !== "fail");
  writeReport(report);
  return report;
}

main().then((report) => {
  const failed = report.checks.filter((check) => check.status === "fail");
  console.log(JSON.stringify({
    ok: report.ok,
    mode: report.mode,
    report: path.join(report.outDir, "report.json"),
    summary: path.join(report.outDir, "summary.md"),
    failed,
  }, null, 2));
  if (!report.ok && process.argv.includes("--require-pass")) {
    process.exitCode = 1;
  }
  setTimeout(() => process.exit(process.exitCode || 0), 25).unref?.();
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 25).unref?.();
});
