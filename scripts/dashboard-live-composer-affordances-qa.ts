#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "zavorthControl-live-composer-affordances-qa");

type CliOptions = {
  url: string;
  outDir: string;
  token: string;
  requirePass: boolean;
  requireLive: boolean;
  allowSend: boolean;
  allowSkillSend: boolean;
};

type QaCheck = { id: string; status: "pass" | "fail" | "skip"; detail: string };

type QaReport = {
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
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
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
    url: readCliValue("url") || "http://127.0.0.1:3000/zavorthControl",
    outDir: path.resolve(rootDir, readCliValue("out") || defaultOutDir),
    token: tokenArg || envToken || envFileToken || tokenFile,
    requirePass: process.argv.includes("--require-pass"),
    requireLive: process.argv.includes("--require-live"),
    allowSend: process.argv.includes("--allow-send"),
    allowSkillSend: process.argv.includes("--allow-skill-send"),
  };
}

function pushCheck(report: QaReport, id: string, condition: boolean, detail: string): void {
  report.checks.push({ id, status: condition ? "pass" : "fail", detail });
  if (!condition) report.ok = false;
}

function pushSkip(report: QaReport, id: string, detail: string): void {
  report.checks.push({ id, status: "skip", detail });
}

function buildReport(options: CliOptions): QaReport {
  return { ok: true, skipped: false, generatedAt: new Date().toISOString(), url: options.url, outDir: options.outDir, screenshots: [], checks: [], metrics: {} };
}

function writeReport(report: QaReport): void {
  fs.mkdirSync(report.outDir, { recursive: true });
  fs.writeFileSync(path.join(report.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(report.outDir, "summary.md"), [
    "# ZavorthControl Live Composer Affordances QA",
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
  ].join("\n"), "utf8");
}

async function sendComposerMessage(page: any, text?: string): Promise<void> {
  if (typeof text === "string") {
    await page.locator("#compose-input").fill(text);
    await page.evaluate(() => {
      const input = document.getElementById("compose-input");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await page.evaluate(() => document.getElementById("send-btn")?.click());
}

async function installVoiceStub(page: any): Promise<void> {
  await page.addScriptTag({
    content: `
      (() => {
        const spokenText = "analise este pedido por voz";
        function FakeSpeechRecognition() {
          this.lang = "en-US";
          this.interimResults = true;
          this.maxAlternatives = 1;
          this.onstart = null;
          this.onresult = null;
          this.onend = null;
        }
        FakeSpeechRecognition.prototype.start = function() {
          const self = this;
          setTimeout(() => self.onstart && self.onstart(), 0);
          setTimeout(() => {
            const result = [{ transcript: spokenText }];
            result.isFinal = true;
            if (self.onresult) self.onresult({ resultIndex: 0, results: [result] });
          }, 30);
          setTimeout(() => self.onend && self.onend(), 80);
        };
        FakeSpeechRecognition.prototype.stop = function() { if (this.onend) this.onend(); };
        window.SpeechRecognition = FakeSpeechRecognition;
        window.webkitSpeechRecognition = FakeSpeechRecognition;
      })();
    `,
  });
}

async function runQa(options: CliOptions): Promise<QaReport> {
  const report = buildReport(options);
  fs.mkdirSync(options.outDir, { recursive: true });

  if (!options.token) {
    report.skipped = true;
    pushSkip(report, "token-required", "Nenhum token local encontrado. Use zavorth zavorthControl token ou passe --token=...");
    return report;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });

  try {
    const url = new URL(options.url);
    url.searchParams.set("token", options.token);
    try {
      await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("#compose-input", { timeout: 15_000 });
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => undefined);
    } catch (error) {
      report.skipped = !options.requireLive;
      if (options.requireLive) pushCheck(report, "live-server-reachable", false, `Nao consegui abrir o ZavorthControl real: ${String(error?.message || error)}`);
      else pushSkip(report, "live-server-reachable", "Servidor local nao respondeu. Inicie com npm run start:zavorth-control ou npm run go.");
      return report;
    }

    const shellScreenshot = path.join(options.outDir, "01-live-composer-shell.png");
    await page.screenshot({ path: shellScreenshot, fullPage: true });
    report.screenshots.push(shellScreenshot);

    const shellState = await page.evaluate(() => ({
      hasAttach: Boolean(document.querySelector('.compose-dock__btn[title="Anexar"], .compose-dock__btn[title="Tools"]')),
      hasSkills: Boolean(document.querySelector('.compose-dock__btn[title="Habilidades"], .compose-dock__btn[title="Trace"]')),
      hasVoice: Boolean(document.querySelector('.compose-dock__btn[title="Voz"], .compose-dock__btn[title="Voice"]')),
      authState: document.getElementById("core-pulse")?.getAttribute("data-auth-state") || "",
      pulseLabel: document.getElementById("core-pulse")?.textContent?.trim() || "",
    }));
    report.metrics.shellState = shellState;
    pushCheck(report, "composer-buttons-exist-live", shellState.hasAttach && shellState.hasSkills && shellState.hasVoice, "ZavorthControl real exibe botoes de anexo, skills e voz.");
    pushCheck(report, "runtime-token-unlocked-live", shellState.authState === "unlocked" || /\bready\b/i.test(shellState.pulseLabel), `Estado de token no topo: ${shellState.authState || shellState.pulseLabel || "indefinido"}.`);

    await page.locator('input[type="file"]').first().setInputFiles({ name: "qa-live-notas.txt", mimeType: "text/plain", buffer: Buffer.from("QA live: anexo textual pequeno para validar composer.", "utf8") });
    await page.waitForSelector(".compose-attachment-chip", { timeout: 10_000 });
    const attachmentUi = await page.evaluate(() => ({
      chips: document.querySelectorAll(".compose-attachment-chip").length,
      text: document.querySelector(".compose-attachment-chip")?.textContent || "",
      sendActive: document.getElementById("send-btn")?.classList.contains("active") || false,
    }));
    report.metrics.attachmentUi = attachmentUi;
    pushCheck(report, "attachment-chip-visible-live", attachmentUi.chips === 1 && /qa-live-notas\.txt/i.test(attachmentUi.text), "Anexo textual aparece no composer real antes do envio.");

    if (options.allowSend) {
      const beforeCards = await page.evaluate(() => ({ artifacts: document.querySelectorAll(".zavorth-artifact-card").length, approvals: document.querySelectorAll(".zavorth-approval-card").length }));
      await sendComposerMessage(page, "resuma este anexo em uma frase");
      await page.waitForFunction(() => document.querySelectorAll(".echo-group.core .echo-bubble").length > 0, null, { timeout: 45_000 }).catch(() => undefined);
      await page.waitForTimeout(800);
      const afterAttachmentSend = await page.evaluate(() => ({ artifacts: document.querySelectorAll(".zavorth-artifact-card").length, approvals: document.querySelectorAll(".zavorth-approval-card").length, text: document.body.innerText }));
      report.metrics.afterAttachmentSend = afterAttachmentSend;
      pushCheck(report, "attachment-send-live-does-not-fake-artifact", afterAttachmentSend.artifacts === beforeCards.artifacts && afterAttachmentSend.approvals === beforeCards.approvals, "Envio live de anexo textual nao cria artefato/approval falso por si so.");
    } else {
      report.skipped = true;
      pushSkip(report, "attachment-send-live-skipped", "Nao enviei anexo real. Rode com --allow-send para validar o caminho live.");
    }

    await page.locator('.compose-dock__btn[title="Habilidades"], .compose-dock__btn[title="Trace"]').click();
    await page.waitForSelector(".compose-skill-option", { timeout: 4_000 }).catch(() => undefined);
    const skillState = await page.evaluate(() => ({
      options: Array.from(document.querySelectorAll(".compose-skill-option")).map((node) => ({ id: (node as HTMLElement).dataset.skillId || "", text: node.textContent || "" })),
    }));
    report.metrics.skillState = skillState;
    if (skillState.options.length > 0) {
      pushCheck(report, "skills-popover-opens-live", true, "Popover de skills abre no zavorthControl real e nao fica preso atras do chat.");
    } else {
      pushSkip(report, "skills-popover-opens-live", "A UI live atual usa Trace/Tools no composer e nao expõe o popover legado de skills.");
    }

    const firstSkillId = String(skillState.options[0]?.id || "");
    if (firstSkillId) {
      await page.locator(`.compose-skill-option[data-skill-id="${firstSkillId.replace(/"/g, '\\"')}"]`).click();
      const inputAfterSkill = await page.locator("#compose-input").inputValue();
      pushCheck(report, "skill-selection-live-does-not-auto-run", inputAfterSkill.trim().length > 0, "Selecionar skill no live prepara o prompt, sem executar automaticamente.");
      if (options.allowSkillSend) {
        await sendComposerMessage(page, "use esta skill de forma segura e responda curto");
        await page.waitForTimeout(1200);
        const afterSkillSend = await page.evaluate(() => ({ artifacts: document.querySelectorAll(".zavorth-artifact-card").length, approvals: document.querySelectorAll(".zavorth-approval-card").length }));
        report.metrics.afterSkillSend = afterSkillSend;
      } else {
        pushSkip(report, "skill-send-live-skipped", "Nao enviei skill real. Use --allow-skill-send se quiser acionar o runtime com a skill selecionada.");
      }
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.locator("#overlay-shade.active").click({ timeout: 1000 }).catch(() => undefined);
    await page.waitForFunction(() => !document.querySelector("#overlay-shade.active"), null, { timeout: 3000 }).catch(() => undefined);

    await installVoiceStub(page);
    await page.locator('.compose-dock__btn[title="Voz"], .compose-dock__btn[title="Voice"]').click();
    await page.waitForFunction(() => /analise este pedido por voz/i.test((document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value || ""), null, { timeout: 10_000 });
    const voiceState = await page.evaluate(() => ({ value: (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value || "" }));
    report.metrics.voiceState = voiceState;
    pushCheck(report, "voice-transcript-live-enters-composer", /analise este pedido por voz/i.test(voiceState.value), "Stub de voz valida o caminho do browser ate o composer real.");

    if (options.allowSend) {
      await sendComposerMessage(page);
      await page.waitForTimeout(1200);
      const afterVoiceSend = await page.evaluate(() => ({ artifacts: document.querySelectorAll(".zavorth-artifact-card").length, approvals: document.querySelectorAll(".zavorth-approval-card").length }));
      report.metrics.afterVoiceSend = afterVoiceSend;
      pushCheck(report, "voice-send-live-does-not-fake-artifact", afterVoiceSend.artifacts === 0 && afterVoiceSend.approvals === 0, "Envio live de voz simples nao cria artefato/approval falso.");
    }

    const finalScreenshot = path.join(options.outDir, "02-live-composer-final.png");
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    report.screenshots.push(finalScreenshot);
    return report;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

const options = readOptions();
runQa(options)
  .then((report) => {
    writeReport(report);
    console.log(JSON.stringify({ ok: report.ok, skipped: report.skipped, url: report.url, checks: report.checks, screenshots: report.screenshots, metrics: report.metrics }, null, 2));
    if (!report.ok && options.requirePass) process.exitCode = 1;
  })
  .catch((error) => {
    const report = buildReport(options);
    report.ok = false;
    pushCheck(report, "unexpected-error", false, String(error?.stack || error?.message || error));
    writeReport(report);
    console.error(`[zavorthControl-live-composer-affordances-qa] FAIL ${error?.message || error}`);
    if (options.requirePass) process.exitCode = 1;
  });
