#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "command-center-live-visual-qa");

type CliOptions = {
  url: string;
  outDir: string;
  token: string;
  requirePass: boolean;
};

type LiveVisualQaReport = {
  ok: boolean;
  generatedAt: string;
  url: string;
  screenshots: string[];
  state: {
    pulseLabel: string;
    authState: string;
    activeSector: string;
    currentCrumb: string;
    overviewTitle: string;
    forbiddenDemoData: string[];
  };
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
    const match = line.match(/^\s*ZAVORTH_WEB_AUTH_TOKEN\s*=\s*(.+)\s*$/);
    if (match) {
      return match[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function readRuntimeTokenFile(): string {
  const tokenFile = path.join(rootDir, "data", "runtime", "web-api-token.txt");
  if (!fs.existsSync(tokenFile)) return "";
  return fs.readFileSync(tokenFile, "utf8").trim();
}

function readOptions(): CliOptions {
  const tokenArg = readCliValue("token");
  const envToken = String(process.env.ZAVORTH_WEB_AUTH_TOKEN || "").trim();
  const envFileToken = readEnvTokenFromFile(path.join(rootDir, ".env"));
  const tokenFile = readRuntimeTokenFile();
  return {
    url: readCliValue("url") || "http://127.0.0.1:3000/control",
    outDir: path.resolve(rootDir, readCliValue("out") || defaultOutDir),
    token: tokenArg || envToken || envFileToken || tokenFile,
    requirePass: process.argv.includes("--require-pass"),
  };
}

function writeReport(report: LiveVisualQaReport, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outDir, "summary.md"),
    [
      "# Command Center Live Visual QA",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `URL: ${report.url}`,
      `Pulse: ${report.state.pulseLabel} (${report.state.authState})`,
      `Setor: ${report.state.activeSector}`,
      `Crumb: ${report.state.currentCrumb}`,
      `Overview: ${report.state.overviewTitle}`,
      `Demo data proibida: ${report.state.forbiddenDemoData.join(", ") || "nenhuma"}`,
      "",
      "## Screenshots",
      "",
      ...report.screenshots.map((screenshot) => `- ${screenshot}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main(): Promise<LiveVisualQaReport> {
  const options = readOptions();
  fs.mkdirSync(options.outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
  });

  const url = new URL(options.url);
  if (options.token) {
    url.searchParams.set("token", options.token);
  }

  let state: LiveVisualQaReport["state"];
  const chatScreenshot = path.join(options.outDir, "01-chat-unlocked.png");
  const overviewScreenshot = path.join(options.outDir, "02-overview-unlocked.png");

  try {
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("#core-pulse", { timeout: 15_000 });
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForFunction(
      () => document.getElementById("core-pulse")?.dataset?.authState === "unlocked",
      { timeout: 20_000 },
    ).catch(() => undefined);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: chatScreenshot, fullPage: true });

    await page.locator('.dock-node[data-sector="overview"]').click({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: overviewScreenshot, fullPage: true });

    state = await page.evaluate(() => {
      const forbidden = ["12,847", "3.2M", "$4.82", "RTX 4090", "A100", "1528652069", "code-writer", "memory-compaction"];
      const text = document.body.innerText;
      const pulse = document.getElementById("core-pulse");
      return {
        pulseLabel: pulse?.querySelector(".bridge__pulse-label")?.textContent?.trim()
          || pulse?.textContent?.trim()
          || "",
        authState: pulse?.dataset?.authState || "",
        activeSector: document.querySelector(".sector.active")?.id || "",
        currentCrumb: document.getElementById("bridge-current")?.textContent?.trim() || "",
        overviewTitle: document.querySelector("#sector-overview .page-title")?.textContent?.trim()
          || document.querySelector("#sector-overview .dashboard-title")?.textContent?.trim()
          || document.querySelector("#sector-overview h1, #sector-overview h2")?.textContent?.trim()
          || (document.getElementById("sector-overview")?.textContent?.match(/\bOverview\b/) ? "Overview" : "")
          || "",
        forbiddenDemoData: forbidden.filter((entry) => text.includes(entry)),
      };
    });
  } finally {
    await browser.close().catch(() => undefined);
  }

  const report: LiveVisualQaReport = {
    ok: (state.authState === "unlocked" || /\bready\b/i.test(state.pulseLabel))
      && state.activeSector === "sector-overview"
      && Boolean(state.overviewTitle)
      && state.forbiddenDemoData.length === 0,
    generatedAt: new Date().toISOString(),
    url: options.url,
    screenshots: [chatScreenshot, overviewScreenshot],
    state,
  };
  writeReport(report, options.outDir);
  return report;
}

main()
  .then((report) => {
    console.log(JSON.stringify({
      ok: report.ok,
      pulse: report.state.pulseLabel,
      authState: report.state.authState,
      activeSector: report.state.activeSector,
      overviewTitle: report.state.overviewTitle,
      screenshots: report.screenshots,
      forbiddenDemoData: report.state.forbiddenDemoData,
    }, null, 2));
    if (!report.ok && readOptions().requirePass) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(`[command-center-live-visual-qa] FAIL ${error?.message || error}`);
    if (readOptions().requirePass) {
      process.exitCode = 1;
    }
  });
