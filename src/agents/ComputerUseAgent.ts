import { EventEmitter } from 'events';
import type { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import { DesktopAutomationTool } from '../tools/DesktopAutomationTool.js';
import fs from 'fs';
import { logger } from '../logger.js';

export type ComputerUseAction = {
  action: 'click-element' | 'type-text' | 'press-key' | 'focus-window' | 'screenshot' | 'list-elements' | 'done';
  windowTitle?: string;
  targetText?: string;
  payload?: string;
  reasoning?: string;
};

export type ComputerUseAgentHooks = {
  onScreenshot?: (input: {
    snapshot: ComputerUseSnapshot;
    screenshotPath: string | null;
  }) => Promise<void> | void;
  onActionPlanned?: (input: {
    snapshot: ComputerUseSnapshot;
    action: ComputerUseAction;
  }) => Promise<ComputerUseAction> | ComputerUseAction;
  onActionExecuted?: (input: {
    snapshot: ComputerUseSnapshot;
    action: ComputerUseAction;
    result: string;
  }) => Promise<void> | void;
};

export type ComputerUseConfig = {
  targetWindow: string;
  objective: string;
  maxIterations?: number;
  delayBetweenActionsMs?: number;
  hooks?: ComputerUseAgentHooks;
};

export type ComputerUseSnapshot = {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  iteration: number;
  maxIterations: number;
  objective: string;
  targetWindow: string;
  lastAction: ComputerUseAction | null;
  lastScreenshotPath: string | null;
  history: Array<{ iteration: number; action: ComputerUseAction; result: string }>;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

/**
 * ComputerUseAgent - autonomous desktop control loop through a vision LLM.
 *
 * The agent captures a screenshot of the target window, sends it to a
 * vision-capable LLM, and asks which UI action should be performed next.
 * The loop continues until the LLM reports "done" or the iteration limit is reached.
 *
 * Architecture:
 *  - Uses DesktopAutomationTool for all UI interactions.
 *  - Converts screenshots to base64 and sends them inline to the LLM.
 *  - Expects structured JSON actions from the LLM.
 *  - Emits events for real-time observability in Zavorth control surfaces.
 *  - Applies safety guardrails through iteration limits, pause/stop flags, and action logs.
 */
export class ComputerUseAgent extends EventEmitter {
  private status: ComputerUseSnapshot['status'] = 'idle';
  private iteration = 0;
  private maxIterations: number;
  private objective = '';
  private targetWindow = '';
  private lastAction: ComputerUseAction | null = null;
  private lastScreenshotPath: string | null = null;
  private history: ComputerUseSnapshot['history'] = [];
  private startedAt: string | null = null;
  private finishedAt: string | null = null;
  private error: string | null = null;
  private stopRequested = false;

  private readonly desktopTool = new DesktopAutomationTool();
  private pauseRequested = false;
  private resumePromise: Promise<void> | null = null;
  private resumeResolver: (() => void) | null = null;

  constructor(
    private readonly llmRuntime: LlmRuntimeService,
    private readonly config: { delayMs?: number } = {},
  ) {
    super();
    this.maxIterations = 25;
  }

  public getSnapshot(): ComputerUseSnapshot {
    return {
      status: this.status,
      iteration: this.iteration,
      maxIterations: this.maxIterations,
      objective: this.objective,
      targetWindow: this.targetWindow,
      lastAction: this.lastAction,
      lastScreenshotPath: this.lastScreenshotPath,
      history: [...this.history],
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      error: this.error,
    };
  }

  public async run(taskConfig: ComputerUseConfig): Promise<ComputerUseSnapshot> {
    if (!this.isExecutionAllowed()) {
      throw new Error(
        'Visual Computer Use is blocked for security. Set ZAVORTH_COMPUTER_USE_ENABLED=true '
        + 'or ZAVORTH_COMPUTER_USE_PROFILE=trusted|dangerous to enable it explicitly.',
      );
    }

    this.objective = taskConfig.objective;
    this.targetWindow = taskConfig.targetWindow;
    this.maxIterations = taskConfig.maxIterations || 25;
    this.iteration = 0;
    this.history = [];
    this.lastAction = null;
    this.lastScreenshotPath = null;
    this.error = null;
    this.stopRequested = false;
    this.pauseRequested = false;
    this.resumePromise = null;
    this.resumeResolver = null;
    this.status = 'running';
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;

    this.emit('agent:started', this.getSnapshot());

    try {
      while (this.iteration < this.maxIterations && !this.stopRequested) {
        await this.waitWhilePaused();
        if (this.stopRequested) {
          break;
        }
        this.iteration++;
        this.emit('agent:iteration', { iteration: this.iteration });

        // Step 1: screenshot the target window.
        const screenshotResult = await this.desktopTool.execute({
          action: 'screenshot',
          windowTitle: this.targetWindow,
        });

        const screenshotPath = this.extractScreenshotPath(screenshotResult);
        this.lastScreenshotPath = screenshotPath;
        if (taskConfig.hooks?.onScreenshot) {
          await taskConfig.hooks.onScreenshot({
            snapshot: this.getSnapshot(),
            screenshotPath,
          });
        }

        // Step 2: load screenshot as base64 for the LLM.
        let base64Image = '';
        if (screenshotPath && fs.existsSync(screenshotPath)) {
          base64Image = fs.readFileSync(screenshotPath).toString('base64');
        }

        if (!base64Image) {
          throw new Error('Screenshot unavailable; stopping Computer Use to avoid blind visual action.');
        }

        // Step 3: ask the LLM what to do next.
        let nextAction = await this.askLlmForNextAction(base64Image);
        if (taskConfig.hooks?.onActionPlanned) {
          nextAction = await taskConfig.hooks.onActionPlanned({
            snapshot: this.getSnapshot(),
            action: nextAction,
          });
        }
        this.lastAction = nextAction;

        if (nextAction.action === 'done') {
          this.status = 'completed';
          this.history.push({ iteration: this.iteration, action: nextAction, result: 'Objective reached.' });
          this.emit('agent:action', { iteration: this.iteration, action: nextAction, result: 'done' });
          break;
        }

        // Step 4: execute the action.
        const actionResult = await this.desktopTool.execute({
          action: nextAction.action,
          windowTitle: nextAction.windowTitle || this.targetWindow,
          targetText: nextAction.targetText || '',
          payload: nextAction.payload || '',
        });

        this.history.push({ iteration: this.iteration, action: nextAction, result: actionResult });
        if (taskConfig.hooks?.onActionExecuted) {
          await taskConfig.hooks.onActionExecuted({
            snapshot: this.getSnapshot(),
            action: nextAction,
            result: actionResult,
          });
        }
        this.emit('agent:action', { iteration: this.iteration, action: nextAction, result: actionResult });

        // Step 5: small delay between actions for UI stability.
        const delay = this.config.delayMs ?? taskConfig.delayBetweenActionsMs ?? 1500;
        await this.sleep(delay);
      }

      if (this.stopRequested) {
        this.status = 'cancelled';
      } else if (this.status !== 'completed') {
        this.status = 'completed';
      }
    } catch (err: any) { const error = err; const e = err;
      this.status = this.stopRequested ? 'cancelled' : 'failed';
      this.error = err.message || String(err);
      this.emit('agent:error', { error: this.error });
    }

    this.finishedAt = new Date().toISOString();
    this.emit('agent:finished', this.getSnapshot());
    return this.getSnapshot();
  }

  public stop(): void {
    this.stopRequested = true;
    this.pauseRequested = false;
    this.resumeResolver?.();
    this.resumeResolver = null;
    this.resumePromise = null;
  }

  public pause(): void {
    if (this.status !== 'running') {
      return;
    }
    this.pauseRequested = true;
    this.status = 'paused';
    this.emit('agent:paused', this.getSnapshot());
  }

  public resume(): void {
    if (!this.pauseRequested) {
      return;
    }
    this.pauseRequested = false;
    this.status = 'running';
    this.resumeResolver?.();
    this.resumeResolver = null;
    this.resumePromise = null;
    this.emit('agent:resumed', this.getSnapshot());
  }

  private isExecutionAllowed(): boolean {
    const explicit = String(process.env.ZAVORTH_COMPUTER_USE_ENABLED || '').trim().toLowerCase();
    if (explicit === 'true') {
      return true;
    }
    if (explicit === 'false') {
      return false;
    }

    const profile = String(
      process.env.ZAVORTH_COMPUTER_USE_PROFILE
      || process.env.ZAVORTH_MCP_PROFILE
      || 'safe',
    ).trim().toLowerCase();
    return profile === 'trusted' || profile === 'dangerous';
  }

  /**
   * Ask the vision LLM to analyze the screenshot and decide the next action.
   */
  private async askLlmForNextAction(base64Screenshot: string): Promise<ComputerUseAction> {
    const historyContext = this.history
      .slice(-5)
      .map((h) => `  Iteration ${h.iteration}: ${h.action.action}(${h.action.targetText || h.action.payload || ''}) -> ${h.result.slice(0, 100)}`)
      .join('\n');

    const prompt = `You are a Desktop Automation Agent ("Computer Use Agent").
Your objective is: "${this.objective}"
Target window: "${this.targetWindow}"
Current iteration: ${this.iteration}/${this.maxIterations}

Recent action history:
${historyContext || '  (no previous action)'}

Analyze the attached window screenshot and decide the next action.
Respond ONLY with raw JSON (no Markdown, no code fence), in this format:
{
  "action": "click-element" | "type-text" | "press-key" | "focus-window" | "list-elements" | "done",
  "windowTitle": "window title if different",
  "targetText": "button or element text for click-element",
  "payload": "text for type-text or key for press-key",
  "reasoning": "short explanation of why this action is appropriate"
}

If the objective has already been reached, return: {"action": "done", "reasoning": "..."}.`;

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; inlineData?: Array<{ mimeType: string; data: string }> }> = [];

    if (base64Screenshot) {
      messages.push({
        role: 'user',
        content: prompt,
        inlineData: [{ mimeType: 'image/png', data: base64Screenshot }],
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt + '\n\n[Screenshot unavailable - decide based on the history]',
      });
    }

    try {
      const response = await this.llmRuntime.chat(messages as any);
      const text = (response.content || '').replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text) as ComputerUseAction;
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Computer Use Agent] JSON parse failed', error);
    return { action: 'done', reasoning: 'Failed to parse LLM response, stopping for safety.' };
  }
  }

  private extractScreenshotPath(result: string): string | null {
    const match = result.match(/Screenshot:\s*(.+\.png)/);
    return match ? match[1].trim() : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.pauseRequested && !this.stopRequested) {
      if (!this.resumePromise) {
        this.resumePromise = new Promise((resolve) => {
          this.resumeResolver = resolve;
        });
      }
      await this.resumePromise;
    }
  }
}
