import { z } from 'zod';
import { logger } from '../../../logger.js';
import type { Browser, Page } from 'playwright-core';
import { IZavorthTool, ToolCategory, ToolDangerLevel, ToolExecutionResult } from '../../types/IZavorthTool.js';
import { EchoVisionAnalysisService } from '../../../domain/platform-ecosystem/infrastructure/VisionAnalysisService.js';
import {
    isBlockedFilePath,
    resolveBrowserTargetPolicy,
    type BrowserTargetPolicy,
} from '../../security/WhitelistConfig.js';
import { asErrorLike } from '../../../utils/errorLike';

type BrowserSelfHealingSnapshot = {
    attemptedAt: string;
    healed: boolean;
    strategy: 'heuristic' | 'vision' | 'none';
    originalSelector: string | null;
    resolvedSelector: string | null;
    textHint: string | null;
    reason: string | null;
    confidence: number;
    providerName: string | null;
};

type BrowserSessionState = {
    browser: Browser;
    page: Page;
    createdAt: string;
    lastActionAt: string;
    actionCount: number;
    lastKnownUrl: string | null;
    lastTargetPolicy: BrowserTargetPolicy | null;
    lastSelfHealing: BrowserSelfHealingSnapshot | null;
};

type BrowserInteractiveOutcome =
    | {
        ok: true;
        message: string;
        extraData: Record<string, unknown>;
        selfHealing: BrowserSelfHealingSnapshot | null;
      }
    | {
        ok: false;
        error: string;
        data: Record<string, unknown>;
      };

type BrowserRepairCandidate = {
    selector: string | null;
    textHint: string | null;
    reason: string;
    score: number;
};

interface BrowserToolArgs {
    action: string;
    url?: string;
    selector?: string;
    text?: string;
}

interface BrowserToolContext {
    sessionId?: string;
}

interface CSSEscapeUtil {
    escape(value: string): string;
}

export class PlaywrightActionTool implements IZavorthTool {
    public readonly name = 'playwright_browser';
    public readonly description = 'Runs autonomous interactions in a headless web browser: navigate, click, type, extract, screenshot, and close. Returns an action summary and a base64 screenshot of the current page state.';
    public readonly category: ToolCategory = 'WEB';
    public readonly dangerLevel: ToolDangerLevel = 'moderate';
    public readonly requiresPermission = false;

    public readonly schema = z.object({
        action: z.enum(['navigate', 'click', 'type', 'extract', 'screenshot', 'close']),
        url: z.string().optional().describe('URL to navigate to. Used only with the navigate action.'),
        selector: z.string().optional().describe('CSS selector to interact with. Used by click, type, and extract.'),
        text: z.string().optional().describe('Text to type. Used only with the type action.'),
    });

    // Session map isolates instances for multi-tenant safety.
    private static sessions: Map<string, BrowserSessionState> = new Map();

    constructor(
        private readonly visionAnalyzer: Pick<EchoVisionAnalysisService, 'suggestBrowserRepair'> = new EchoVisionAnalysisService(),
    ) {}

    public async execute(args: BrowserToolArgs, context?: BrowserToolContext): Promise<ToolExecutionResult> {
        const sessionId = String(context?.sessionId || 'default_tenant').trim() || 'default_tenant';
        const action = String(args.action || '').trim().toLowerCase();

        try {
            if (action === 'close') {
                const lifecycle = await this.closeBrowser(sessionId);
                return {
                    success: true,
                    message: `Browser for tenant '${sessionId}' closed.`,
                    data: {
                        lifecycle: lifecycle || {
                            sessionId,
                            mode: 'session',
                            status: 'closed',
                            createdAt: null,
                            lastActionAt: null,
                            actionCount: 0,
                            currentUrl: null,
                            title: null,
                        },
                    },
                };
            }

            let resolvedTargetPolicy: BrowserTargetPolicy | null = null;
            if (action === 'navigate') {
                if (!args.url) {
                    return { success: false, message: 'Falta o parametro url.' };
                }
                try {
                    resolvedTargetPolicy = resolveBrowserTargetPolicy(args.url);
                    if (resolvedTargetPolicy.filePath && isBlockedFilePath(resolvedTargetPolicy.filePath)) {
                        return {
                            success: false,
                            error: `Navigation blocked by file policy: ${resolvedTargetPolicy.filePath}`,
                        };
                    }
                } catch (error: unknown) {
                  const err = asErrorLike(error);
                  const errorMessage = error instanceof Error ? err.message : 'URL blocked by browser policy.';
                    return {
                        success: false,
                        error: errorMessage,
                    };
                }
            }

            const session = await this.getSession(sessionId);
            const page = session.page;
            let actionMessage = '';
            let extraData: Record<string, unknown> = {};

            switch (action) {
                case 'navigate':
                    await page.goto(resolvedTargetPolicy!.normalizedUrl, { waitUntil: 'load', timeout: 30000 });
                    actionMessage = `Navigation completed to ${resolvedTargetPolicy!.normalizedUrl}`;
                    break;
                case 'click':
                case 'type':
                case 'extract': {
                    if (!args.selector && action !== 'extract') {
                        return {
                            success: false,
                            message: action === 'click'
                                ? 'Missing selector parameter.'
                                : 'Missing selector or text.',
                        };
                    }
                    if (action === 'type' && !args.text) {
                        return { success: false, message: 'Missing selector or text.' };
                    }
                    if (action === 'extract' && !args.selector) {
                        const bodyText = await page.evaluate(() => document.body.innerText);
                        actionMessage = 'Extracted text from the whole page.';
                        extraData = { extractedText: bodyText };
                        break;
                    }

                    const outcome = await this.runInteractiveActionWithRepair({
                        page,
                        action: action as 'click' | 'type' | 'extract',
                        selector: String(args.selector || '').trim(),
                        text: typeof args.text === 'string' ? args.text : undefined,
                    });
                    if (!outcome.ok) {
                        return {
                            success: false,
                            message: `Error interacting with the site: ${outcome.error}`,
                            error: outcome.error,
                            data: outcome.data,
                        };
                    }
                    actionMessage = outcome.message;
                    extraData = outcome.extraData;
                    break;
                }
                case 'screenshot':
                    actionMessage = 'Passive page screenshot captured.';
                    break;
                default:
                    return { success: false, error: `Unknown Playwright action: ${action}` };
            }

            await page.waitForTimeout(1500);
            this.touchSession(
                sessionId,
                resolvedTargetPolicy,
                page.url(),
                this.readSelfHealing(extraData?.selfHealing),
            );
            return await this.buildResponse(sessionId, page, actionMessage, extraData);
        } catch (error: unknown) {
          const err = asErrorLike(error);
          const errorMessage = error instanceof Error ? err.message : String(error);
            return {
                success: false,
                message: `Error interacting with the site: ${errorMessage}`,
                error: errorMessage,
            };
        }
    }

    private async buildResponse(
        sessionId: string,
        page: Page,
        message: string,
        extraData: Record<string, unknown> = {},
    ): Promise<ToolExecutionResult> {
        const session = PlaywrightActionTool.sessions.get(sessionId) || null;
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        const base64 = screenshotBuffer.toString('base64');
        const currentUrl = this.readCurrentUrl(page);
        const pageTitle = await page.title().catch(() => null);
        const artifactId = `playwright:${sessionId}:${Date.now()}`;

        return {
            success: true,
            message,
            data: {
                ...extraData,
                base64,
                mimeType: 'image/png',
                artifact: {
                    id: artifactId,
                    kind: 'screenshot',
                    mimeType: 'image/png',
                    bytes: screenshotBuffer.byteLength,
                    source: this.name,
                },
                lifecycle: {
                    sessionId,
                    mode: 'session',
                    status: 'active',
                    createdAt: session?.createdAt || null,
                    lastActionAt: session?.lastActionAt || new Date().toISOString(),
                    actionCount: session?.actionCount || 0,
                    currentUrl,
                    title: pageTitle,
                    lastSelfHealing: session?.lastSelfHealing || null,
                },
                policy: session?.lastTargetPolicy
                    ? {
                        scope: session.lastTargetPolicy.scope,
                        hostname: session.lastTargetPolicy.hostname,
                        matchedAllowlist: session.lastTargetPolicy.matchedAllowlist,
                        selfHealingEnabled: true,
                    }
                    : null,
            },
        };
    }

    private async getSession(sessionId: string): Promise<BrowserSessionState> {
        let session = PlaywrightActionTool.sessions.get(sessionId);

        if (!session) {
            const { chromium } = await import('playwright');
            const browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            const page = await browser.newPage();

            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            });
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            const now = new Date().toISOString();
            session = {
                browser,
                page,
                createdAt: now,
                lastActionAt: now,
                actionCount: 0,
                lastKnownUrl: this.readCurrentUrl(page),
                lastTargetPolicy: null,
                lastSelfHealing: null,
            };
            PlaywrightActionTool.sessions.set(sessionId, session);
        }

        return session;
    }

    private touchSession(
        sessionId: string,
        targetPolicy: BrowserTargetPolicy | null,
        currentUrl: string | null,
        selfHealing: BrowserSelfHealingSnapshot | null,
    ): void {
        const session = PlaywrightActionTool.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.actionCount += 1;
        session.lastActionAt = new Date().toISOString();
        session.lastKnownUrl = currentUrl || session.lastKnownUrl;
        if (targetPolicy) {
            session.lastTargetPolicy = targetPolicy;
        }
        if (selfHealing) {
            session.lastSelfHealing = selfHealing;
        }
    }

    private async closeBrowser(sessionId: string): Promise<Record<string, unknown> | null> {
        const session = PlaywrightActionTool.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const lifecycle = {
            sessionId,
            mode: 'session',
            status: 'closed',
            createdAt: session.createdAt,
            lastActionAt: session.lastActionAt,
            actionCount: session.actionCount,
            currentUrl: session.lastKnownUrl,
            title: null,
            lastSelfHealing: session.lastSelfHealing,
            policy: session.lastTargetPolicy
                ? {
                    scope: session.lastTargetPolicy.scope,
                    hostname: session.lastTargetPolicy.hostname,
                    matchedAllowlist: session.lastTargetPolicy.matchedAllowlist,
                }
                : null,
        };

        await session.page.close().catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
        await session.browser.close().catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
        PlaywrightActionTool.sessions.delete(sessionId);
        return lifecycle;
    }

    private async runInteractiveActionWithRepair(input: {
        page: Page;
        action: 'click' | 'type' | 'extract';
        selector: string;
        text?: string;
    }): Promise<BrowserInteractiveOutcome> {
        try {
            const direct = await this.executeInteractiveAction(
                input.page,
                input.action,
                input.selector,
                input.text,
            );
            return {
                ok: true,
                message: direct.message,
                extraData: direct.extraData,
                selfHealing: null,
            };
        } catch (directError: unknown) {
          const err = asErrorLike(directError);
          const error = err;
          const heuristicCandidates = await this.buildRepairCandidates(
                input.page,
                input.selector,
                input.action,
            );
            const heuristicAttempt = await this.tryRepairCandidates(
                input.page,
                input.action,
                input.selector,
                input.text,
                heuristicCandidates,
                {
                    strategy: 'heuristic',
                    providerName: null,
                    confidence: heuristicCandidates[0]?.score ? Math.min(1, heuristicCandidates[0].score / 10) : 0,
                },
            );
            if (heuristicAttempt) {
                return heuristicAttempt;
            }

            const screenshotBuffer = await input.page.screenshot({ type: 'png' });
            const pageTitle = await input.page.title().catch(() => null);
            const candidateHints = heuristicCandidates
                .slice(0, 6)
                .map((entry) => [
                    entry.selector ? `selector=${entry.selector}` : null,
                    entry.textHint ? `text=${entry.textHint}` : null,
                    `score=${entry.score}`,
                    `reason=${entry.reason}`,
                ].filter(Boolean).join(' | '));
            const repairSuggestion = await this.visionAnalyzer.suggestBrowserRepair({
                action: input.action,
                failedSelector: input.selector,
                base64: screenshotBuffer.toString('base64'),
                mimeType: 'image/png',
                currentUrl: this.readCurrentUrl(input.page),
                pageTitle,
                candidateHints,
            });

            const visionCandidates: BrowserRepairCandidate[] = [];
            if (repairSuggestion.selector || repairSuggestion.textHint) {
                visionCandidates.push({
                    selector: repairSuggestion.selector,
                    textHint: repairSuggestion.textHint,
                    reason: repairSuggestion.reason || 'visual repair suggested by the multimodal provider',
                    score: Math.round(Math.max(0, Math.min(1, repairSuggestion.confidence)) * 10),
                });
            }
            const visionAttempt = await this.tryRepairCandidates(
                input.page,
                input.action,
                input.selector,
                input.text,
                visionCandidates,
                {
                    strategy: 'vision',
                    providerName: repairSuggestion.providerName,
                    confidence: repairSuggestion.confidence,
                },
            );
            if (visionAttempt) {
                return visionAttempt;
            }

            return {
                ok: false,
                error: directError instanceof Error ? err.message : String(directError),
                data: {
                    selfHealing: {
                        attemptedAt: new Date().toISOString(),
                        healed: false,
                        strategy: repairSuggestion.selector || repairSuggestion.textHint ? 'vision' : 'none',
                        originalSelector: input.selector,
                        resolvedSelector: repairSuggestion.selector || heuristicCandidates[0]?.selector || null,
                        textHint: repairSuggestion.textHint || heuristicCandidates[0]?.textHint || null,
                        reason: repairSuggestion.reason || 'No fallback could locate the current target.',
                        confidence: repairSuggestion.confidence || 0,
                        providerName: repairSuggestion.providerName,
                    },
                    repairCandidates: candidateHints,
                },
            };
        }
    }

    private async executeInteractiveAction(
        page: Page,
        action: 'click' | 'type' | 'extract',
        selector: string,
        text?: string,
    ): Promise<{ message: string; extraData: Record<string, unknown> }> {
        switch (action) {
            case 'click':
                await page.click(selector, { timeout: 10000 });
                return {
                    message: `Element clicked: ${selector}`,
                    extraData: {},
                };
            case 'type':
                await page.fill(selector, String(text || ''), { timeout: 10000 });
                return {
                    message: `Text "${String(text || '')}" inserted into ${selector}`,
                    extraData: {},
                };
            case 'extract': {
                const extractedText = await page.locator(selector).innerText({ timeout: 10000 });
                return {
                    message: `Extracted text from element ${selector}.`,
                    extraData: { extractedText },
                };
            }
        }
    }

    private async executeInteractiveActionByHint(
        page: Page,
        action: 'click' | 'type' | 'extract',
        candidate: BrowserRepairCandidate,
        text?: string,
    ): Promise<{ message: string; extraData: Record<string, unknown>; resolvedSelector: string | null; textHint: string | null }> {
        if (candidate.selector) {
            const executed = await this.executeInteractiveAction(page, action, candidate.selector, text);
            return {
                ...executed,
                resolvedSelector: candidate.selector,
                textHint: candidate.textHint,
            };
        }

        const textHint = String(candidate.textHint || '').trim();
        if (!textHint) {
            throw new Error('repair candidate has no selector or text hint');
        }

        switch (action) {
            case 'click':
                await page.getByText(textHint, { exact: false }).first().click({ timeout: 10000 });
                return {
                    message: `Element clicked through visible text: ${textHint}`,
                    extraData: {},
                    resolvedSelector: null,
                    textHint,
                };
            case 'extract': {
                const extractedText = await page.getByText(textHint, { exact: false }).first().innerText({ timeout: 10000 });
                return {
                    message: `Text extracted through visible text: ${textHint}`,
                    extraData: { extractedText },
                    resolvedSelector: null,
                    textHint,
                };
            }
            case 'type': {
                const typed = await this.fillByTextHint(page, textHint, String(text || ''));
                return {
                    message: `Text "${String(text || '')}" inserted through text hint: ${typed}`,
                    extraData: {},
                    resolvedSelector: typed.startsWith('text=') ? null : typed,
                    textHint,
                };
            }
        }
    }

    private async fillByTextHint(page: Page, textHint: string, text: string): Promise<string> {
        const attempts: Array<() => Promise<string>> = [
            async () => {
                await page.getByLabel(textHint, { exact: false }).first().fill(text, { timeout: 5000 });
                return `label:${textHint}`;
            },
            async () => {
                await page.getByPlaceholder(textHint, { exact: false }).first().fill(text, { timeout: 5000 });
                return `placeholder:${textHint}`;
            },
            async () => {
                const selector = `[aria-label*="${this.escapeAttributeValue(textHint)}" i]`;
                await page.locator(selector).first().fill(text, { timeout: 5000 });
                return selector;
            },
        ];

        let lastError: unknown = null;
        for (const attempt of attempts) {
            try {
                return await attempt();
            } catch (error: unknown) {logger.warn('[Playwright Action] async operation failed', error);
    lastError = error;
  }
        }

        throw lastError instanceof Error ? lastError : new Error(`Could not find field for "${textHint}"`);
    }

    private async tryRepairCandidates(
        page: Page,
        action: 'click' | 'type' | 'extract',
        originalSelector: string,
        text: string | undefined,
        candidates: BrowserRepairCandidate[],
        meta: {
            strategy: 'heuristic' | 'vision';
            providerName: string | null;
            confidence: number;
        },
    ): Promise<Extract<BrowserInteractiveOutcome, { ok: true }> | null> {
        for (const candidate of candidates) {
            try {
                const repaired = await this.executeInteractiveActionByHint(page, action, candidate, text);
                return {
                    ok: true,
                    message: `${repaired.message} (self-healing ${meta.strategy})`,
                    extraData: {
                        ...repaired.extraData,
                        selfHealing: {
                            attemptedAt: new Date().toISOString(),
                            healed: true,
                            strategy: meta.strategy,
                            originalSelector,
                            resolvedSelector: repaired.resolvedSelector,
                            textHint: repaired.textHint,
                            reason: candidate.reason,
                            confidence: meta.confidence || Math.min(1, candidate.score / 10),
                            providerName: meta.providerName,
                        },
                    },
                    selfHealing: {
                        attemptedAt: new Date().toISOString(),
                        healed: true,
                        strategy: meta.strategy,
                        originalSelector,
                        resolvedSelector: repaired.resolvedSelector,
                        textHint: repaired.textHint,
                        reason: candidate.reason,
                        confidence: meta.confidence || Math.min(1, candidate.score / 10),
                        providerName: meta.providerName,
                    },
                };
            } catch (error: unknown) {// Try the next fallback candidate.
      logger.warn('[Playwright Action] operation failed', error);
    }
        }

        return null;
    }

    private async buildRepairCandidates(
        page: Page,
        selector: string,
        action: 'click' | 'type' | 'extract',
    ): Promise<BrowserRepairCandidate[]> {
        const tokens = this.extractSelectorTokens(selector);
        if (tokens.length === 0) {
            return [];
        }

        const candidates = await page.evaluate(({ tokens, action }) => {
            const selectors = action === 'type'
                ? ['input', 'textarea', 'select', '[contenteditable="true"]']
                : action === 'click'
                    ? ['button', 'a', '[role="button"]', 'input[type="button"]', 'input[type="submit"]']
                    : ['button', 'a', 'label', 'p', 'h1', 'h2', 'h3', 'span', 'div', 'li'];
            const nodes = Array.from(document.querySelectorAll(selectors.join(','))).slice(0, 120);
            return nodes.map((node) => {
                const element = node as HTMLElement;
                const idRaw = String(element.id || '').trim();
                const nameRaw = String(element.getAttribute('name') || '').trim();
                const ariaLabelRaw = String(element.getAttribute('aria-label') || '').trim();
                const placeholderRaw = String(element.getAttribute('placeholder') || '').trim();
                const testIdRaw = String(element.getAttribute('data-testid') || '').trim();
                const roleRaw = String(element.getAttribute('role') || '').trim();
                const textRaw = String(element.innerText || element.textContent || '').trim();
                const id = idRaw.toLowerCase();
                const name = nameRaw.toLowerCase();
                const ariaLabel = ariaLabelRaw.toLowerCase();
                const placeholder = placeholderRaw.toLowerCase();
                const testId = testIdRaw.toLowerCase();
                const role = roleRaw.toLowerCase();
                const text = textRaw.toLowerCase();
                const haystack = [id, name, ariaLabel, placeholder, testId, role, text].filter(Boolean);
                let score = 0;

                for (const token of tokens) {
                    if (id.includes(token)) score += 5;
                    if (name.includes(token)) score += 4;
                    if (testId.includes(token)) score += 5;
                    if (ariaLabel.includes(token)) score += 4;
                    if (placeholder.includes(token)) score += 4;
                    if (role.includes(token)) score += 2;
                    if (text.includes(token)) score += 3;
                }

                let selector = null;
                if (idRaw) {
                    const cssUtil = globalThis as unknown as { CSS?: CSSEscapeUtil };
                    const escapedId = cssUtil.CSS?.escape
                        ? cssUtil.CSS.escape(idRaw)
                        : idRaw.replace(/[^a-zA-Z0-9_-]+/g, '\\$&');
                    selector = `#${escapedId}`;
                } else if (testIdRaw) {
                    selector = `[data-testid="${testIdRaw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
                } else if (nameRaw) {
                    selector = `[name="${nameRaw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
                } else if (ariaLabelRaw) {
                    selector = `[aria-label="${ariaLabelRaw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
                }
                const textHint = textRaw || ariaLabelRaw || placeholderRaw || null;
                const reason = haystack.slice(0, 3).join(' | ');

                return {
                    selector,
                    textHint,
                    score,
                    reason: reason || 'local text match',
                };
            }).filter((entry) => entry.score > 0)
                .sort((left, right) => right.score - left.score)
                .slice(0, 8);
        }, {
            tokens,
            action,
        });

        return Array.isArray(candidates)
            ? candidates.map((entry) => ({
                selector: this.optionalText((entry as Record<string, unknown>).selector),
                textHint: this.optionalText((entry as Record<string, unknown>).textHint),
                reason: this.optionalText((entry as Record<string, unknown>).reason) || 'local text match',
                score: Number((entry as Record<string, unknown>).score || 0),
            }))
            : [];
    }

    private extractSelectorTokens(selector: string): string[] {
        const ignoredTokens = new Set(['data', 'testid', 'data-testid', 'aria', 'label', 'role', 'name']);
        return Array.from(
            new Set(
                String(selector || '')
                    .toLowerCase()
                    .replace(/[[\]#.=:"'()>,/+*\-_]+/g, ' ')
                    .split(/\s+/)
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length >= 3 && !ignoredTokens.has(entry)),
            ),
        ).slice(0, 6);
    }

    private readSelfHealing(value: unknown): BrowserSelfHealingSnapshot | null {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const record = value as Record<string, unknown>;
        return {
            attemptedAt: this.optionalText(record.attemptedAt) || new Date().toISOString(),
            healed: Boolean(record.healed),
            strategy: this.normalizeStrategy(record.strategy),
            originalSelector: this.optionalText(record.originalSelector),
            resolvedSelector: this.optionalText(record.resolvedSelector),
            textHint: this.optionalText(record.textHint),
            reason: this.optionalText(record.reason),
            confidence: Number(record.confidence || 0),
            providerName: this.optionalText(record.providerName),
        };
    }

    private normalizeStrategy(value: unknown): BrowserSelfHealingSnapshot['strategy'] {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized === 'heuristic' || normalized === 'vision'
            ? normalized
            : 'none';
    }

    private optionalText(value: unknown): string | null {
        const normalized = String(value || '').trim();
        return normalized.length > 0 ? normalized : null;
    }

    private escapeAttributeValue(value: string): string {
        return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    private readCurrentUrl(page: Page): string | null {
        try {
            const currentUrl = String(page.url() || '').trim();
            return currentUrl.length > 0 ? currentUrl : null;
        } catch (error: unknown) {logger.warn('[Playwright Action] code compilation failed', error); return null; }
    }
}
