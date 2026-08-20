#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, ".tmp", "zavorthControl-provider-cockpit-visual-qa");

type ProviderCockpitVisualQaReport = {
  ok: boolean;
  generatedAt: string;
  htmlPath: string;
  screenshots: string[];
  state: {
    desktopVisible: boolean;
    mobileVisible: boolean;
    providerCountText: string;
    safeRenderText: string;
    commandHints: string[];
    forbiddenSecrets: string[];
  };
};

function hasArg(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function generatePreview(): string {
  fs.mkdirSync(outDir, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(rootDir, "scripts", "zavorthControl-browser-preview.ts"),
      "--fixture=safe-run",
      `--out=${outDir}`,
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: "pipe",
    },
  );
  if (result.status !== 0) {
    throw new Error(`preview generation failed: ${result.stderr || result.stdout}`);
  }
  return path.join(outDir, "index.html");
}

async function inspectViewport(
  htmlPath: string,
  viewport: { width: number; height: number },
  screenshotName: string,
) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const url = `${pathToFileURL(htmlPath).toString()}...fixture=safe-run`;
  await page.goto(url, { waitUntil: "load", timeout: 30_000 });
  await page.waitForSelector('[data-zavorth-provider-cockpit="ready"]', { timeout: 15_000 });
  await page.waitForTimeout(300);
  const screenshot = path.join(outDir, screenshotName);
  await page.screenshot({ path: screenshot, fullPage: true });
  const state = await page.evaluate(() => {
    const panel = document.querySelector('[data-zavorth-provider-cockpit="ready"]');
    const text = panel?.textContent || "";
    const body = document.body.textContent || "";
    const forbiddenPatterns = [
      { label: "openai-key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
      { label: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
      { label: "openai-env", pattern: /OPENAI_API_KEY\s*=/ },
      { label: "anthropic-env", pattern: /ANTHROPIC_API_KEY\s*=/ },
      { label: "google-key", pattern: /AIza[0-9A-Za-z_-]{20,}/ },
    ];
    return {
      visible: Boolean(panel),
      providerCountText: text.match(/\d+\/\d+\s+ready/)?.[0] || "",
      safeRenderText: text.includes("without chamadas de rede no zavorthControl") ? "safe-render" : "",
      commandHints: Array.from(panel?.querySelectorAll("button") || []).map((button) => button.textContent?.trim() || "").filter(Boolean),
      forbiddenSecrets: forbiddenPatterns.filter((entry) => entry.pattern.test(body)).map((entry) => entry.label),
    };
  });
  await browser.close();
  return { screenshot, state };
}

function writeReport(report: ProviderCockpitVisualQaReport): void {
  fs.writeFileSync(
    path.join(outDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outDir, "summary.md"),
    [
      "# Provider Cockpit Visual QA",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `HTML: ${report.htmlPath}`,
      `Desktop visible: ${report.state.desktopVisible}`,
      `Mobile visible: ${report.state.mobileVisible}`,
      `Provider count: ${report.state.providerCountText}`,
      `Safe render: ${report.state.safeRenderText}`,
      `Command hints: ${report.state.commandHints.join(", ")}`,
      `Forbidden secrets: ${report.state.forbiddenSecrets.join(", ") || "none"}`,
      "",
      "## Screenshots",
      "",
      ...report.screenshots.map((screenshot) => `- ${screenshot}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main(): Promise<ProviderCockpitVisualQaReport> {
  const htmlPath = generatePreview();
  const desktop = await inspectViewport(htmlPath, { width: 1440, height: 980 }, "01-provider-cockpit-desktop.png");
  const mobile = await inspectViewport(htmlPath, { width: 390, height: 920 }, "02-provider-cockpit-mobile.png");
  const commandHints = Array.from(new Set([...desktop.state.commandHints, ...mobile.state.commandHints]));
  const forbiddenSecrets = Array.from(new Set([...desktop.state.forbiddenSecrets, ...mobile.state.forbiddenSecrets]));
  const report: ProviderCockpitVisualQaReport = {
    ok: desktop.state.visible
      && mobile.state.visible
      && Boolean(desktop.state.providerCountText)
      && Boolean(desktop.state.safeRenderText)
      && commandHints.some((command) => command.includes("zavorth providers cockpit"))
      && commandHints.some((command) => command.includes("zavorth providers live"))
      && forbiddenSecrets.length === 0,
    generatedAt: new Date().toISOString(),
    htmlPath,
    screenshots: [desktop.screenshot, mobile.screenshot],
    state: {
      desktopVisible: desktop.state.visible,
      mobileVisible: mobile.state.visible,
      providerCountText: desktop.state.providerCountText || mobile.state.providerCountText,
      safeRenderText: desktop.state.safeRenderText || mobile.state.safeRenderText,
      commandHints,
      forbiddenSecrets,
    },
  };
  writeReport(report);
  return report;
}

main()
  .then((report) => {
    console.log(JSON.stringify({
      ok: report.ok,
      htmlPath: report.htmlPath,
      screenshots: report.screenshots,
      state: report.state,
    }, null, 2));
    if (!report.ok && hasArg("require-pass")) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(`[zavorthControl-provider-cockpit-visual-qa] FAIL ${error?.message || error}`);
    if (hasArg("require-pass")) {
      process.exitCode = 1;
    }
  });
