#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorthControl-live-chat-qa");

type CliOptions = {
  url: string;
  outDir: string;
  token: string;
  requirePass: boolean;
  requireLive: boolean;
  allowSend: boolean;
  allowOperationalSend: boolean;
};

type QaCheck = {
  id: string;
  status: "pass" | "fail" | "skip";
  detail: string;
};

type LiveChatQaReport = {
  ok: boolean;
  skipped: boolean;
  generatedAt: string;
  url: string;
  outDir: string;
  screenshots: string[];
  checks: QaCheck[];
  metrics: Record<string, unknown>;
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
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, "");
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
  const allowOperationalSend = process.argv.includes("--allow-operational-send");
  return {
    url: readCliValue("url") || "http://127.0.0.1:3000/zavorthControl",
    outDir: path.resolve(rootDir, readCliValue("out") || defaultOutDir),
    token: tokenArg || envToken || envFileToken || tokenFile,
    requirePass: process.argv.includes("--require-pass"),
    requireLive: process.argv.includes("--require-live"),
    allowSend: process.argv.includes("--allow-send") || allowOperationalSend,
    allowOperationalSend,
  };
}

function pushCheck(report: LiveChatQaReport, id: string, condition: boolean, detail: string): void {
  report.checks.push({ id, status: condition ? "pass" : "fail", detail });
  if (!condition) {
    report.ok = false;
  }
}

function pushSkip(report: LiveChatQaReport, id: string, detail: string): void {
  report.checks.push({ id, status: "skip", detail });
}

function writeReport(report: LiveChatQaReport): void {
  fs.mkdirSync(report.outDir, { recursive: true });
  fs.writeFileSync(path.join(report.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(report.outDir, "summary.md"),
    [
      "# ZavorthControl Live Chat QA",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}${report.skipped ? " (skipped)" : ""}`,
      `URL: ${report.url}`,
      "",
      "## Checks",
      "",
      ...report.checks.map((check) => {
        const marker = check.status === "pass" ? "x" : check.status === "skip" ? "-" : " ";
        return `- [${marker}] ${check.id}: ${check.detail}`;
      }),
      "",
      "## Screenshots",
      "",
      ...report.screenshots.map((screenshot) => `- ${screenshot}`),
      "",
    ].join("\n"),
    "utf8",
  );
}

function buildReport(options: CliOptions): LiveChatQaReport {
  return {
    ok: true,
    skipped: false,
    generatedAt: new Date().toISOString(),
    url: options.url,
    outDir: options.outDir,
    screenshots: [],
    checks: [],
    metrics: {},
  };
}

async function sendComposerMessage(page: any, text: string): Promise<void> {
  await page.locator("#compose-input").fill(text);
  await page.evaluate(() => {
    const input = document.getElementById("compose-input");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => {
    document.getElementById("send-btn")?.click();
  });
}

async function waitForCoreReply(page: any, initialCoreCount: number): Promise<boolean> {
  try {
    await page.waitForFunction(
      (count: number) => document.querySelectorAll(".echo-group.core .echo-bubble").length > count,
      initialCoreCount,
      { timeout: 45_000 },
    );
    return true;
  } catch {
    return false;
  }
}

async function runQa(options: CliOptions): Promise<LiveChatQaReport> {
  const report = buildReport(options);
  fs.mkdirSync(options.outDir, { recursive: true });

  if (!options.token) {
    report.skipped = true;
    pushSkip(report, "token-required", "Nenhum token local encontrado. Use zavorth zavorthControl token ou passe --token=...");
    return report;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
  });

  try {
    const url = new URL(options.url);
    url.searchParams.set("token", options.token);
    report.url = options.url;

    try {
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("#compose-input", { timeout: 15_000 });
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
    } catch (error) {
      report.skipped = !options.requireLive;
      if (options.requireLive) {
        pushCheck(report, "live-server-reachable", false, `Nao consegui abrir o ZavorthControl real: ${String(error?.message || error)}`);
      } else {
        pushSkip(report, "live-server-reachable", "Servidor local nao respondeu. Inicie com npm run start:zavorth-control ou npm run go.");
      }
      return report;
    }

    const shellScreenshot = path.join(options.outDir, "01-live-shell.png");
    await page.screenshot({ path: shellScreenshot, fullPage: true });
    report.screenshots.push(shellScreenshot);

    const shellState = await page.evaluate(() => ({
      hasCoreFrame: Boolean(document.getElementById("core-frame")),
      hasComposer: Boolean(document.getElementById("compose-input")),
      hasSendButton: Boolean(document.getElementById("send-btn")),
      authState: document.getElementById("core-pulse")?.getAttribute("data-auth-state") || "",
      pulseLabel: document.querySelector("#core-pulse .bridge__pulse-label")?.textContent?.trim()
        || document.getElementById("core-pulse")?.textContent?.trim()
        || "",
      modelLabels: Array.from(document.querySelectorAll(".echo-meta__model")).map((node) => node.textContent?.trim() || "").filter(Boolean),
    }));
    report.metrics.shellState = shellState;
    pushCheck(report, "preserves-user-zavorthControl-shell", shellState.hasCoreFrame && shellState.hasComposer && shellState.hasSendButton, "ZavorthControl bonito original carregou como shell real.");
    pushCheck(report, "runtime-token-unlocked", shellState.authState === "unlocked" || /\bready\b/i.test(shellState.pulseLabel), `Estado de token no topo: ${shellState.authState || shellState.pulseLabel || "indefinido"}.`);

    if (!options.allowSend) {
      report.skipped = true;
      pushSkip(report, "chat-send-skipped", "Nao enviei mensagem real. Rode com --allow-send para testar o caminho feliz do chat.");
      return report;
    }

    await page.evaluate(() => {
      const signalFeed = document.getElementById("signal-feed");
      if (signalFeed) signalFeed.innerHTML = "";
      const qa = {
        scrollSamples: [] as Array<{ top: number; height: number; client: number; bottomGap: number }>,
        toasts: [] as string[],
      };
      (window as any).__zavorthLiveChatQa = qa;
      const observer = new MutationObserver(() => {
        qa.toasts = Array.from(document.querySelectorAll(".signal-toast")).map((node) => node.textContent?.trim() || "");
      });
      if (signalFeed) observer.observe(signalFeed, { childList: true, subtree: true });
      (window as any).__zavorthLiveChatQaObserver = observer;
      const stream = document.getElementById("neural-stream");
      (window as any).__zavorthLiveChatQaInterval = window.setInterval(() => {
        if (!stream) return;
        qa.scrollSamples.push({
          top: stream.scrollTop,
          height: stream.scrollHeight,
          client: stream.clientHeight,
          bottomGap: stream.scrollHeight - stream.clientHeight - stream.scrollTop,
        });
      }, 25);
    });

    const beforeSimple = await page.evaluate(() => {
      const stream = document.getElementById("neural-stream");
      if (stream) stream.scrollTop = stream.scrollHeight;
      const qa = (window as any).__zavorthLiveChatQa;
      if (qa) qa.scrollSamples = [];
      const top = stream?.scrollTop || 0;
      const height = stream?.scrollHeight || 0;
      const client = stream?.clientHeight || 0;
      return { top, height, client, bottomGap: Math.max(0, height - client - top) };
    });

    const initialCoreCount = await page.evaluate(() => document.querySelectorAll(".echo-group.core .echo-bubble").length);
    await sendComposerMessage(page, "oi");
    const gotCoreReply = await waitForCoreReply(page, initialCoreCount);
    await page.waitForTimeout(900);

    const simpleState = await page.evaluate(() => {
      const qa = (window as any).__zavorthLiveChatQa || { scrollSamples: [], toasts: [] };
      const samples = qa.scrollSamples || [];
      const minTop = samples.reduce((min: number, sample: any) => Math.min(min, Number(sample.top || 0)), Number.POSITIVE_INFINITY);
      const maxBottomGap = samples.reduce((max: number, sample: any) => Math.max(max, Number(sample.bottomGap || 0)), 0);
      const modelLabels = Array.from(document.querySelectorAll(".echo-meta__model")).map((node) => node.textContent?.trim() || "").filter(Boolean);
      const toasts = Array.from(document.querySelectorAll(".signal-toast")).map((node) => node.textContent?.trim() || "");
      return {
        artifactCards: document.querySelectorAll(".zavorth-artifact-card").length,
        approvalCards: document.querySelectorAll(".zavorth-approval-card").length,
        coreReplies: document.querySelectorAll(".echo-group.core .echo-bubble").length,
        toasts,
        minTop,
        maxBottomGap,
        sampleCount: samples.length,
        modelLabels,
      };
    });

    report.metrics.beforeSimple = beforeSimple;
    report.metrics.simpleState = simpleState;
    pushCheck(report, "simple-oi-gets-core-reply", gotCoreReply, "Um 'oi' real recebe resposta do Zavorth.");
    pushCheck(report, "simple-chat-has-no-artifact-card", simpleState.artifactCards === 0, "Saudacao nao mostra card de artefato no zavorthControl real.");
    pushCheck(report, "simple-chat-has-no-approval-card", simpleState.approvalCards === 0, "Saudacao nao pede aprovacao nem acorda ferramenta perigosa.");
    pushCheck(report, "no-message-sent-toast", !simpleState.toasts.some((toast: string) => /mensagem enviada/i.test(toast)), "Enviar mensagem nao cria popup 'mensagem enviada'.");
    pushCheck(
      report,
      "no-scroll-jump-after-send",
      Number(simpleState.minTop) >= Math.max(0, Number(beforeSimple.top) - 160)
        && Number(simpleState.maxBottomGap) <= Number(beforeSimple.bottomGap || 0) + 260,
      "Chat nao salta para o topo antes de voltar ao fim.",
    );
    pushCheck(report, "current-model-label-is-real", simpleState.modelLabels.some((label: string) => !/^Gemini\s*$/i.test(label) && label.length > 0), "Modelo exibido no chat vem do runtime, nao texto fixo genérico.");

    const simpleScreenshot = path.join(options.outDir, "02-live-simple-chat.png");
    await page.screenshot({ path: simpleScreenshot, fullPage: true });
    report.screenshots.push(simpleScreenshot);

    if (!options.allowOperationalSend) {
      pushSkip(report, "operational-send-skipped", "Nao enviei comando operacional real. Use --allow-operational-send para testar approval sem clicar em aprovar.");
      return report;
    }

    const beforeOperationalArtifactCards = await page.evaluate(() => document.querySelectorAll(".zavorth-artifact-card").length);
    await sendComposerMessage(page, "rode npm test no terminal");
    await page.waitForFunction(() => document.querySelectorAll(".zavorth-approval-card").length > 0, null, { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(600);
    const approvalState = await page.evaluate(() => ({
      approvalCards: document.querySelectorAll(".zavorth-approval-card").length,
      artifactCards: document.querySelectorAll(".zavorth-artifact-card").length,
      text: document.querySelector(".zavorth-approval-card")?.textContent || "",
    }));
    report.metrics.approvalState = approvalState;
    pushCheck(report, "approval-card-appears-for-risky-command", approvalState.approvalCards > 0, "Comando de terminal real para em approval; o QA nunca clica em aprovar.");
    pushCheck(report, "approval-does-not-create-artifact", approvalState.artifactCards === beforeOperationalArtifactCards, "Comando aguardando aprovacao nao cria artefato falso.");

    const approvalScreenshot = path.join(options.outDir, "03-live-approval-card.png");
    await page.screenshot({ path: approvalScreenshot, fullPage: true });
    report.screenshots.push(approvalScreenshot);

    return report;
  } finally {
    await page.evaluate(() => {
      const interval = (window as any).__zavorthLiveChatQaInterval;
      const observer = (window as any).__zavorthLiveChatQaObserver;
      if (interval) window.clearInterval(interval);
      observer?.disconnect?.();
    }).catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

const options = readOptions();
runQa(options)
  .then((report) => {
    writeReport(report);
    console.log(JSON.stringify({
      ok: report.ok,
      skipped: report.skipped,
      url: report.url,
      checks: report.checks,
      screenshots: report.screenshots,
      metrics: report.metrics,
    }, null, 2));
    if (!report.ok && options.requirePass) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    const report = buildReport(options);
    report.ok = false;
    pushCheck(report, "unexpected-error", false, String(error?.stack || error?.message || error));
    writeReport(report);
    console.error(`[zavorthControl-live-chat-qa] FAIL ${error?.message || error}`);
    if (options.requirePass) {
      process.exitCode = 1;
    }
  });
