#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(rootDir, "assets", "command-center");
const defaultOutDir = path.join(rootDir, ".tmp", "command-center-composer-affordances-qa");

type CliOptions = {
  outDir: string;
  requirePass: boolean;
};

type QaCheck = {
  id: string;
  status: "pass" | "fail";
  detail: string;
};

type SentPayload = {
  message?: string;
  attachments?: Array<Record<string, any>>;
  selectedSkills?: Array<Record<string, any>>;
  voice?: Record<string, any> | null;
};

type QaState = {
  sessionId: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; kind?: string }>;
  sentPayloads: SentPayload[];
};

type QaReport = {
  ok: boolean;
  generatedAt: string;
  url: string;
  outDir: string;
  screenshots: string[];
  checks: QaCheck[];
  metrics: Record<string, unknown>;
};

function readOptions(): CliOptions {
  const outArg = process.argv.slice(2).find((arg) => arg.startsWith("--out="));
  return {
    outDir: path.resolve(rootDir, String(outArg?.split("=").slice(1).join("=") || defaultOutDir).trim()),
    requirePass: process.argv.includes("--require-pass"),
  };
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function safeAssetPath(urlPath: string): string | null {
  const normalized = urlPath === "/" || urlPath === "/control"
    ? "index.html"
    : urlPath.replace(/^\/+/, "");
  const absolute = path.resolve(assetDir, normalized);
  if (!absolute.startsWith(assetDir)) return null;
  return absolute;
}

function json(res: http.ServerResponse, payload: unknown, status = 200): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function commandCenterPayload(state: QaState) {
  return {
    live: true,
    authRequired: false,
    sessionId: state.sessionId,
    modelProfile: {
      providerLabel: "Gemini",
      modelLabel: "gemini-2.5-flash",
      routingPolicy: "gateway",
      supportsTools: true,
    },
    snapshot: {
      activeSessionId: state.sessionId,
      modelProfile: {
        providerLabel: "Gemini",
        modelLabel: "gemini-2.5-flash",
        routingPolicy: "gateway",
        supportsTools: true,
      },
      runs: [],
      activeRun: null,
      workflowJobs: [],
    },
  };
}

function createQaServer(state: QaState): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = requestUrl.pathname;

    if (pathname === "/api/auth/status") {
      json(res, { webReady: true, gatewayReady: true, tokenRequired: false, dashboardTokenConfigured: true });
      return;
    }
    if (pathname === "/api/auth/validate") {
      json(res, { ok: true, valid: true });
      return;
    }
    if (pathname === "/api/web/command-center") {
      json(res, commandCenterPayload(state));
      return;
    }
    if (pathname === "/api/web/catalog") {
      json(res, {
        skills: [
          { id: "web.search", title: "Pesquisar na web", summary: "Pesquisa fontes recentes e confiaveis.", status: "pronta" },
          { id: "file.inspect", title: "Inspecionar arquivo", summary: "Le arquivos textuais anexados ou caminhos locais seguros.", status: "local" },
        ],
      });
      return;
    }
    if (pathname === "/api/web/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "close" });
      res.end(": command-center-composer-affordances-qa\n\n");
      return;
    }
    if (pathname === "/api/web/gateway/sessions/history") {
      json(res, {
        session: { sessionId: state.sessionId, transcript: state.messages },
        snapshot: { sessionId: state.sessionId, messages: state.messages, permissions: [], tasks: [], workflowRuns: [], runs: [] },
      });
      return;
    }
    if (pathname === "/api/web/permissions") {
      json(res, { permissions: [], snapshot: { permissions: [], runs: [] } });
      return;
    }
    if (pathname === "/api/web/artifacts") {
      json(res, { artifacts: [] });
      return;
    }
    if (pathname === "/api/web/runtime/companions" || pathname === "/api/web/gateway/runtime") {
      json(res, { ok: true, items: [] });
      return;
    }
    if (pathname === "/api/web/chat/send" && req.method === "POST") {
      const body = await readBody(req) as SentPayload;
      const message = String(body?.message || "").trim();
      const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
      const selectedSkills = Array.isArray(body?.selectedSkills) ? body.selectedSkills : [];
      const voice = body?.voice && typeof body.voice === "object" ? body.voice : null;
      state.sentPayloads.push(body);
      state.messages.push({ id: `user-${state.messages.length + 1}`, role: "user", content: message });

      const unsupportedAttachments = attachments.filter((attachment) => !String(attachment?.text || "").trim());
      const reply = attachments.length > 0 && unsupportedAttachments.length === attachments.length
        ? "Recebi o anexo, mas ele chegou apenas como metadados. Envie texto, cole o conteudo ou aponte um caminho local para analise real."
        : [
            "Recebi pelo composer real.",
            attachments.length ? `Anexos: ${attachments.map((item) => item.name).join(", ")}.` : "Sem anexos.",
            selectedSkills.length ? `Skills: ${selectedSkills.map((item) => item.id).join(", ")}.` : "Sem skill selecionada.",
            voice ? `Voz: ${voice.transcript}.` : "Sem voz.",
          ].join(" ");

      state.messages.push({ id: `assistant-${state.messages.length + 1}`, role: "assistant", content: reply, kind: "composer-affordance" });
      json(res, {
        sessionId: state.sessionId,
        taskId: null,
        runId: null,
        artifacts: [],
        reply,
        responseDecision: {
          schemaVersion: 1,
          mode: "conversation",
          confidence: "high",
          responsePath: "fast-chat",
          shouldCreateArtifact: false,
          shouldShowArtifactInChat: false,
          artifactPolicy: {
            shouldCreateArtifact: false,
            shouldShowArtifactInChat: false,
            reason: "composer-affordance-qa-does-not-create-artifacts",
          },
        },
        snapshot: { sessionId: state.sessionId, messages: state.messages, permissions: [], tasks: [], workflowRuns: [], runs: [], activeRun: null },
      });
      return;
    }

    const filePath = safeAssetPath(pathname);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath), "Cache-Control": "no-store" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Nao foi possivel abrir servidor local de QA do composer.");
      resolve({ server, url: `http://127.0.0.1:${address.port}/control` });
    });
  });
}

function pushCheck(report: QaReport, id: string, condition: boolean, detail: string): void {
  report.checks.push({ id, status: condition ? "pass" : "fail", detail });
  if (!condition) report.ok = false;
}

function writeReport(report: QaReport): void {
  fs.mkdirSync(report.outDir, { recursive: true });
  fs.writeFileSync(path.join(report.outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(report.outDir, "summary.md"),
    [
      "# Command Center Composer Affordances QA",
      "",
      `Status: ${report.ok ? "PASS" : "FAIL"}`,
      `URL: ${report.url}`,
      "",
      "## Checks",
      "",
      ...report.checks.map((check) => `- [${check.status === "pass" ? "x" : " "}] ${check.id}: ${check.detail}`),
      "",
      "## Screenshots",
      "",
      ...report.screenshots.map((screenshot) => `- ${screenshot}`),
      "",
    ].join("\n"),
    "utf8",
  );
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

async function waitForPayloadCount(state: QaState, expected: number, timeoutMs = 10_000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (state.sentPayloads.length >= expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function installSpeechRecognitionStub(page: any, transcript: string): Promise<void> {
  await page.addInitScript((spokenText: string) => {
    class FakeSpeechRecognition {
      lang = "en-US";
      interimResults = true;
      maxAlternatives = 1;
      onstart: null | (() => void) = null;
      onresult: null | ((event: any) => void) = null;
      onend: null | (() => void) = null;
      onerror: null | (() => void) = null;
      start() {
        setTimeout(() => this.onstart?.(), 0);
        setTimeout(() => {
          const result: any = [{ transcript: spokenText }];
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
        }, 30);
        setTimeout(() => this.onend?.(), 80);
      }
      stop() {
        this.onend?.();
      }
    }
    (window as any).SpeechRecognition = FakeSpeechRecognition;
    (window as any).webkitSpeechRecognition = FakeSpeechRecognition;
  }, transcript);
}

async function runQa(options: CliOptions): Promise<QaReport> {
  const state: QaState = { sessionId: "qa-composer-affordances-session", messages: [], sentPayloads: [] };
  const { server, url } = await createQaServer(state);
  const report: QaReport = { ok: true, generatedAt: new Date().toISOString(), url, outDir: options.outDir, screenshots: [], checks: [], metrics: {} };
  const browser = await chromium.launch({ headless: true });

  try {
    fs.mkdirSync(options.outDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
    await installSpeechRecognitionStub(page, "analise este pedido por voz");
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector("#compose-input", { timeout: 15_000 });
    await page.waitForSelector("#boot-gate.hidden", { timeout: 10_000 });

    const initialScreenshot = path.join(options.outDir, "01-composer-shell.png");
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    report.screenshots.push(initialScreenshot);

    const shellState = await page.evaluate(() => ({
      hasComposer: Boolean(document.getElementById("compose-input")),
      hasAttach: Boolean(document.querySelector("#tool-sheet-trigger, .compose-dock__btn[title=\"Anexar\"]")),
      hasSkills: Boolean(document.querySelector('[data-tool-sheet-action="skills"], .compose-dock__btn[title="Habilidades"]')),
      hasVoice: Boolean(document.querySelector('.compose-dock__btn[title="Voz"]')),
      authState: document.getElementById("core-pulse")?.getAttribute("data-auth-state") || "",
    }));
    report.metrics.shellState = shellState;
    pushCheck(report, "composer-buttons-exist", shellState.hasComposer && shellState.hasAttach && shellState.hasSkills && shellState.hasVoice, "Composer preserva botoes de anexo, skills e voz.");
    pushCheck(report, "runtime-unlocked-for-composer-qa", shellState.authState === "unlocked", "Runtime mockado esta desbloqueado para testar payload real.");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("linha 1: Zavorth deve ler este anexo textual.\nlinha 2: nao criar artefato falso.", "utf8") });
    await page.waitForSelector(".compose-attachment-chip", { timeout: 10_000 });
    const attachmentChipState = await page.evaluate(() => ({
      chips: document.querySelectorAll(".compose-attachment-chip").length,
      chipText: document.querySelector(".compose-attachment-chip")?.textContent || "",
      sendActive: document.getElementById("send-btn")?.classList.contains("active") || false,
      placeholder: (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.placeholder || "",
    }));
    report.metrics.attachmentChipState = attachmentChipState;
    pushCheck(report, "attachment-chip-visible-before-send", attachmentChipState.chips === 1 && /notas\.txt/i.test(attachmentChipState.chipText), "Arquivo anexado aparece como chip antes de enviar.");
    pushCheck(report, "attachment-activates-send", attachmentChipState.sendActive && /arquivo/i.test(attachmentChipState.placeholder), "Anexo ativa envio e orienta o usuario a dizer o que fazer.");

    await sendComposerMessage(page, "resuma o arquivo em uma frase");
    pushCheck(report, "attachment-send-reaches-runtime", await waitForPayloadCount(state, 1), "Envio com anexo chegou ao endpoint de chat.");
    const attachmentPayload = state.sentPayloads[0] || {};
    report.metrics.attachmentPayload = attachmentPayload;
    pushCheck(report, "attachment-payload-has-text-preview", Array.isArray(attachmentPayload.attachments) && attachmentPayload.attachments[0]?.name === "notas.txt" && /Zavorth deve ler/i.test(String(attachmentPayload.attachments[0]?.text || "")), "Payload carrega nome, metadados e preview textual do anexo.");
    pushCheck(report, "attachment-message-does-not-leak-context", String(attachmentPayload.message || "") === "resuma o arquivo em uma frase" && !/Contexto dos arquivos anexados|Arquivo 1:/i.test(String(attachmentPayload.message || "")), "Mensagem visivel continua humana; contexto do arquivo viaja separado no payload.");
    await page.waitForSelector(".chat-attachment-card", { timeout: 10_000 });
    const sentAttachmentState = await page.evaluate(() => ({
      cards: document.querySelectorAll(".chat-attachment-card").length,
      iconText: document.querySelector(".chat-attachment-card__icon")?.textContent || "",
      bodyText: document.querySelector(".chat-attachment-card")?.textContent || "",
      rawHtmlLeak: /<div class=\"chat-attachment|chat-attachment-item/i.test(document.body.innerText),
      operatorPreBlocks: document.querySelectorAll(".echo-group.operator pre").length,
    }));
    report.metrics.sentAttachmentState = sentAttachmentState;
    pushCheck(report, "attachment-card-is-visual-not-raw-html", sentAttachmentState.cards >= 1 && /TXT/i.test(sentAttachmentState.iconText) && /notas/i.test(sentAttachmentState.bodyText), "Anexo enviado aparece como card visual compacto, nao bloco preto com HTML.");
    pushCheck(report, "attachment-card-does-not-render-code-block", !sentAttachmentState.rawHtmlLeak && sentAttachmentState.operatorPreBlocks === 0, "Anexo enviado nao vaza HTML nem vira code block.");

    const attachmentScreenshot = path.join(options.outDir, "02-attachment-sent.png");
    await page.screenshot({ path: attachmentScreenshot, fullPage: true });
    report.screenshots.push(attachmentScreenshot);

    const directSkillsButton = page.locator('.compose-dock__btn[title="Habilidades"]');
    if (await directSkillsButton.count()) {
      await directSkillsButton.click();
    } else {
      await page.locator("#tool-sheet-trigger").click();
      await page.locator('[data-tool-sheet-action="skills"]').click();
    }
    await page.waitForFunction(() => {
      const popover = document.querySelector(".compose-skill-popover");
      return Boolean(popover && !popover.classList.contains("hidden") && document.querySelectorAll(".compose-skill-option").length > 0);
    }, null, { timeout: 10_000 });
    const skillOptions = await page.evaluate(() => Array.from(document.querySelectorAll(".compose-skill-option")).map((node) => ({ id: (node as HTMLElement).dataset.skillId || "", text: node.textContent || "" })));
    report.metrics.skillOptions = skillOptions;
    pushCheck(report, "skills-popover-uses-runtime-catalog", skillOptions.some((skill: any) => skill.id === "web.search"), "Popover de skills le catalogo real do runtime bridge.");
    await page.locator('.compose-skill-option[data-skill-id="web.search"]').click({ force: true });
    const afterSkillInput = await page.locator("#compose-input").inputValue();
    pushCheck(report, "skill-selection-prepares-prompt", /Pesquisar na web|Use Pesquisar na web/i.test(afterSkillInput), "Selecionar skill prepara o pedido no composer sem executar sozinho.");
    await sendComposerMessage(page, "traga duas fontes confiaveis");
    pushCheck(report, "skill-send-reaches-runtime", await waitForPayloadCount(state, 2), "Envio com skill chegou ao endpoint de chat.");
    const skillPayload = state.sentPayloads[1] || {};
    report.metrics.skillPayload = skillPayload;
    pushCheck(report, "selected-skill-payload-preserved", Array.isArray(skillPayload.selectedSkills) && skillPayload.selectedSkills.some((skill) => skill.id === "web.search"), "Payload preserva selectedSkills para o roteador sem depender de banco de palavras.");

    const skillScreenshot = path.join(options.outDir, "03-skill-sent.png");
    await page.screenshot({ path: skillScreenshot, fullPage: true });
    report.screenshots.push(skillScreenshot);

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
          FakeSpeechRecognition.prototype.stop = function() {
            if (this.onend) this.onend();
          };
          window.SpeechRecognition = FakeSpeechRecognition;
          window.webkitSpeechRecognition = FakeSpeechRecognition;
        })();
      `,
    });
    await page.locator('.compose-dock__btn[title="Voz"]').click();
    await page.waitForFunction(() => {
      const input = document.getElementById("compose-input") as HTMLTextAreaElement | null;
      return /analise este pedido por voz/i.test(input?.value || "");
    }, null, { timeout: 10_000 });
    const voiceInputState = await page.evaluate(() => ({ value: (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value || "", overlayHidden: document.getElementById("voice-listening-overlay")?.classList.contains("hidden") || false }));
    report.metrics.voiceInputState = voiceInputState;
    pushCheck(report, "voice-transcript-enters-composer", /analise este pedido por voz/i.test(voiceInputState.value), "Ditado por voz injeta transcricao no composer.");
    await sendComposerMessage(page);
    pushCheck(report, "voice-send-reaches-runtime", await waitForPayloadCount(state, 3), "Envio com voz chegou ao endpoint de chat.");
    const voicePayload = state.sentPayloads[2] || {};
    report.metrics.voicePayload = voicePayload;
    pushCheck(report, "voice-payload-preserved", /analise este pedido por voz/i.test(String(voicePayload.voice?.transcript || "")), "Payload preserva transcricao, idioma e origem da voz.");

    const voiceScreenshot = path.join(options.outDir, "04-voice-sent.png");
    await page.screenshot({ path: voiceScreenshot, fullPage: true });
    report.screenshots.push(voiceScreenshot);

    const binaryPage = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
    await binaryPage.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await binaryPage.waitForSelector("#compose-input", { timeout: 15_000 });
    await binaryPage.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]) });
    await binaryPage.waitForSelector(".compose-attachment-chip", { timeout: 10_000 });
    await binaryPage.evaluate(() => {
      const input = document.getElementById("compose-input") as HTMLTextAreaElement | null;
      if (input) {
        input.value = "o que tem nesta imagem?";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await binaryPage.evaluate(() => document.getElementById("send-btn")?.click());
    pushCheck(report, "binary-attachment-send-reaches-runtime", await waitForPayloadCount(state, 4), "Anexo binario tambem chega como metadados ao runtime.");
    const binaryPayload = state.sentPayloads[3] || {};
    await binaryPage.waitForFunction(() => /metadados|cole o conteudo|caminho local/i.test(document.body.innerText), null, { timeout: 10_000 });
    const binaryState = await binaryPage.evaluate(() => ({ artifactCards: document.querySelectorAll(".zavorth-artifact-card").length, approvalCards: document.querySelectorAll(".zavorth-approval-card").length }));
    report.metrics.binaryPayload = binaryPayload;
    report.metrics.binaryState = binaryState;
    pushCheck(report, "binary-attachment-is-honest-metadata", Array.isArray(binaryPayload.attachments) && binaryPayload.attachments[0]?.name === "foto.png" && !binaryPayload.attachments[0]?.text, "Imagem sem OCR/vision nao finge conteudo; envia metadados honestos.");
    pushCheck(report, "binary-attachment-does-not-create-fake-artifact", binaryState.artifactCards === 0 && binaryState.approvalCards === 0, "Anexo sem preview nao cria artefato ou approval falso.");

    const binaryScreenshot = path.join(options.outDir, "05-binary-unsupported.png");
    await binaryPage.screenshot({ path: binaryScreenshot, fullPage: true });
    report.screenshots.push(binaryScreenshot);

    const noVoicePage = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
    await noVoicePage.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await noVoicePage.waitForSelector("#compose-input", { timeout: 15_000 });
    await noVoicePage.evaluate(() => {
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;
      const feed = document.getElementById("signal-feed");
      if (feed) feed.innerHTML = "";
    });
    await noVoicePage.locator('.compose-dock__btn[title="Voz"]').click();
    await noVoicePage.waitForFunction(() => /Voz ainda|digite|texto transcrito/i.test(document.body.innerText), null, { timeout: 10_000 });
    const noVoiceState = await noVoicePage.evaluate(() => ({ hasNotice: /Voz ainda|digite|texto transcrito/i.test(document.body.innerText), artifactCards: document.querySelectorAll(".zavorth-artifact-card").length, approvalCards: document.querySelectorAll(".zavorth-approval-card").length }));
    report.metrics.noVoiceState = noVoiceState;
    pushCheck(report, "voice-unsupported-shows-honest-notice", noVoiceState.hasNotice && noVoiceState.artifactCards === 0 && noVoiceState.approvalCards === 0, "Sem SpeechRecognition, botao de voz mostra aviso honesto e nao finge funcionamento.");

    const noVoiceScreenshot = path.join(options.outDir, "06-voice-unsupported.png");
    await noVoicePage.screenshot({ path: noVoiceScreenshot, fullPage: true });
    report.screenshots.push(noVoiceScreenshot);

    return report;
  } finally {
    await browser.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const options = readOptions();
runQa(options)
  .then((report) => {
    writeReport(report);
    console.log(JSON.stringify({ ok: report.ok, url: report.url, checks: report.checks, screenshots: report.screenshots, metrics: report.metrics }, null, 2));
    if (!report.ok && options.requirePass) process.exitCode = 1;
  })
  .catch((error) => {
    const report: QaReport = { ok: false, generatedAt: new Date().toISOString(), url: "not-started", outDir: options.outDir, screenshots: [], checks: [{ id: "unexpected-error", status: "fail", detail: String(error?.stack || error?.message || error) }], metrics: {} };
    writeReport(report);
    console.error(`[command-center-composer-affordances-qa] FAIL ${error?.message || error}`);
    if (options.requirePass) process.exitCode = 1;
  });
