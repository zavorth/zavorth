#!/usr/bin/env node

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZavorthControlProviderCockpitService } from "../src/services/ZavorthControlProviderCockpitService.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorthControl-provider-cockpit-live-smoke");

type SmokeCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

type SmokeReport = {
  ok: boolean;
  generatedAt: string;
  baseUrl: string;
  endpoint: {
    readinessStatus: number;
    zavorthControlStatus: number;
    blockedLiveStatus: number;
  };
  providerCockpit: {
    status: string;
    totalProviders: number;
    readyProviders: number;
    executionAuthority: boolean | null;
    normalRenderMakesNoNetworkCalls: boolean | null;
  };
  zavorthControl: {
    apiLive: boolean;
    snapshotHasProviderCockpit: boolean;
    providerCountLabel: string;
  };
  checks: SmokeCheck[];
};

function hasArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function debug(message: string): void {
  if (hasArg("debug")) {
    console.error(`[provider-cockpit-live-smoke] ${message}`);
  }
}

function readArg(name: string): string {
  const prefix = `--${name}=`;
  return String(process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "").trim();
}

function pushCheck(report: SmokeReport, id: string, ok: boolean, detail: string): void {
  report.checks.push({ id, ok, detail });
  if (!ok) report.ok = false;
}

function writeReport(report: SmokeReport, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(outDir, "summary.md"),
    [
      "# Provider Cockpit Live Smoke",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `Base URL: ${report.baseUrl}`,
      `Provider Cockpit: ${report.providerCockpit.status}`,
      `Providers: ${report.providerCockpit.readyProviders}/${report.providerCockpit.totalProviders} ready`,
      `Execution authority: ${report.providerCockpit.executionAuthority}`,
      `Normal render makes no network calls: ${report.providerCockpit.normalRenderMakesNoNetworkCalls}`,
      "",
      "## Checks",
      "",
      ...report.checks.map((check) => `- [${check.ok ? "x" : " "}] ${check.id}: ${check.detail}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

async function startInProcessServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const providerCockpitService = new ZavorthControlProviderCockpitService();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname === "/api/providers/readiness" && (url.searchParams.get("live") || url.searchParams.get("probeLive") || url.searchParams.get("allowAllLive"))) {
        writeJson(res, {
          ok: false,
          error: "provider_live_probe_requires_explicit_operator_cli_or_approved_api",
        }, 403);
        return;
      }
      if (url.pathname === "/api/providers/readiness") {
        const providerCockpit = await providerCockpitService.buildProjection({
          providerId: url.searchParams.get("provider") || url.searchParams.get("providerId"),
          selectedProviderId: url.searchParams.get("selectedProvider") || url.searchParams.get("selectedProviderId"),
          includeAdvanced: url.searchParams.get("advanced") === "true",
          live: false,
          allowAllLive: false,
        });
        writeJson(res, {
          ok: true,
          live: false,
          generatedAt: providerCockpit.generatedAt,
          providerCockpit,
          safety: providerCockpit.safety,
        });
        return;
      }
      if (url.pathname === "/api/web/zavorthControl") {
        const providerCockpit = await providerCockpitService.buildProjection({
          includeAdvanced: false,
          live: false,
          allowAllLive: false,
        });
        writeJson(res, {
          ok: true,
          live: true,
          generatedAt: providerCockpit.generatedAt,
          snapshot: {
            generatedAt: providerCockpit.generatedAt,
            source: {
              kind: "universal-agent-runtime",
              label: "Provider Cockpit smoke gateway",
            },
            activeRun: null,
            runs: [],
            workflowJobs: [],
            providerCockpit,
          },
        });
        return;
      }
      if (!res.headersSent) {
        res.statusCode = 404;
        res.end("not found");
      }
    } catch (error: unknown) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify({ ok: false, error: String((error as Error)?.message || error) }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("could not allocate local smoke server port");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function writeJson(res: http.ServerResponse, payload: unknown, status = 200): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("connection", "close");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
}

async function readJson(url: string): Promise<{ status: number; payload: any; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(url, {
    headers: {
      connection: "close",
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const text = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  return { status: response.status, payload, text };
}

function containsSecretLikeText(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /Bearer\s+[A-Za-z0-9._-]{20,}/.test(text)
    || /OPENAI_API_KEY\s*=/.test(text)
    || /ANTHROPIC_API_KEY\s*=/.test(text)
    || /AIza[0-9A-Za-z_-]{20,}/.test(text);
}

async function main(): Promise<SmokeReport> {
  const outDir = path.resolve(rootDir, readArg("out") || defaultOutDir);
  const explicitBaseUrl = readArg("url");
  debug("starting server");
  const started = explicitBaseUrl ? null : await startInProcessServer();
  const baseUrl = explicitBaseUrl || started!.baseUrl;
  debug(`baseUrl=${baseUrl}`);
  debug("fetch readiness");
  const readiness = await readJson(`${baseUrl}/api/providers/readiness`);
  debug(`readiness=${readiness.status}`);
  debug("fetch blocked live");
  const blockedLive = await readJson(`${baseUrl}/api/providers/readiness?live=true&provider=openai`);
  debug(`blockedLive=${blockedLive.status}`);
  debug("fetch Zavorth Control");
  const zavorthControl = await readJson(`${baseUrl}/api/web/zavorthControl`);
  debug(`zavorthControl=${zavorthControl.status}`);

  const providerCockpit = readiness.payload?.providerCockpit || zavorthControl.payload?.snapshot?.providerCockpit || null;
  const zavorthControlProviderCockpit = zavorthControl.payload?.snapshot?.providerCockpit || null;

  const report: SmokeReport = {
    ok: true,
    generatedAt: new Date().toISOString(),
    baseUrl,
    endpoint: {
      readinessStatus: readiness.status,
      zavorthControlStatus: zavorthControl.status,
      blockedLiveStatus: blockedLive.status,
    },
    providerCockpit: {
      status: String(providerCockpit?.status || "missing"),
      totalProviders: Number(providerCockpit?.summary?.totalProviders || 0),
      readyProviders: Number(providerCockpit?.summary?.readyProviders || 0),
      executionAuthority: typeof providerCockpit?.executionAuthority === "boolean" ? providerCockpit.executionAuthority : null,
      normalRenderMakesNoNetworkCalls: typeof providerCockpit?.safety?.normalRenderMakesNoNetworkCalls === "boolean"
        ? providerCockpit.safety.normalRenderMakesNoNetworkCalls
        : null,
    },
    zavorthControl: {
      apiLive: zavorthControl.payload?.live === true,
      snapshotHasProviderCockpit: Boolean(zavorthControlProviderCockpit),
      providerCountLabel: zavorthControlProviderCockpit
        ? `${zavorthControlProviderCockpit.summary.readyProviders}/${zavorthControlProviderCockpit.summary.totalProviders} ready`
        : "missing",
    },
    checks: [],
  };

  pushCheck(report, "readiness-endpoint-ok", readiness.status === 200 && readiness.payload?.ok === true, "GET /api/providers/readiness returns a projection.");
  pushCheck(report, "zavorthControl-endpoint-ok", zavorthControl.status === 200 && zavorthControl.payload?.ok === true, "GET /api/web/zavorthControl returns a runtime snapshot.");
  pushCheck(report, "live-probe-blocked-from-zavorthControl-route", blockedLive.status === 403, "GET readiness route refuses live provider probes.");
  pushCheck(report, "provider-cockpit-attached", Boolean(providerCockpit?.surface === "zavorthControl-provider-cockpit"), "Provider Cockpit projection is attached to live API output.");
  pushCheck(report, "projection-only", providerCockpit?.executionAuthority === false && providerCockpit?.visualMutationApplied === false, "Provider Cockpit remains projection-only.");
  pushCheck(report, "normal-render-no-network", providerCockpit?.safety?.normalRenderMakesNoNetworkCalls === true, "Normal zavorthControl rendering does not run provider network calls.");
  pushCheck(report, "zavorthControl-snapshot-consumes-provider-cockpit", Boolean(zavorthControlProviderCockpit), "ZavorthControl live API snapshot includes Provider Cockpit.");
  pushCheck(report, "no-secret-like-values", !containsSecretLikeText({ readiness: readiness.payload, zavorthControl: zavorthControl.payload }), "Live smoke output contains no raw provider secret patterns.");

  writeReport(report, outDir);
  if (started) {
    debug("closing server");
    started.server.closeAllConnections?.();
    await new Promise<void>((resolve) => started.server.close(() => resolve()));
    debug("server closed");
  }
  return report;
}

main()
  .then((report) => {
    console.log(JSON.stringify({
      ok: report.ok,
      baseUrl: report.baseUrl,
      endpoint: report.endpoint,
      providerCockpit: report.providerCockpit,
      zavorthControl: report.zavorthControl,
    }, null, 2));
    if (!report.ok && hasArg("require-pass")) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(`[zavorthControl-provider-cockpit-live-smoke] FAIL ${error?.message || error}`);
    if (hasArg("require-pass")) process.exitCode = 1;
  });
