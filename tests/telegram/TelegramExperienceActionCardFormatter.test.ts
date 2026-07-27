import { TelegramExperienceActionCardFormatter } from '../../src/telegram/TelegramExperienceActionCardFormatter.js';
import { TelegramExperienceActionCardRegistry } from '../../src/telegram/TelegramExperienceActionCardRegistry.js';
import type { ExperienceSnapshot } from '../../src/services/experience/ExperienceContracts.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

function makeSnapshot(): ExperienceSnapshot {
  return {
    contractVersion: 'ExperienceSnapshot/v1',
    generatedAt: '2026-05-21T12:00:00.000Z',
    surface: 'telegram',
    sessionId: 'session-1',
    workspace: 'C:/repo',
    agent: {
      status: 'attention',
      label: 'Zavorth',
      summary: 'Waiting for approval.',
      activeRunId: 'run-1',
      activeRunStatus: 'waiting_approval',
      modelLabel: 'model',
      providerLabel: 'provider',
    },
    journey: {
      id: 'journey-1',
      kind: 'code-task',
      title: 'Corrigir bug',
      summary: 'Aguardando decision.',
      status: 'waiting_approval',
      steps: [],
    },
    chat: { messages: [], suggestions: [] },
    approvals: [{
      id: 'approval-secret-id',
      runId: 'run-1',
      title: 'Rodar validaction',
      reason: 'Runs a local command.',
      risk: 'attention',
      status: 'pending',
      createdAt: '2026-05-21T12:00:00.000Z',
      actions: [],
    }],
    timeline: [],
    receipts: [],
    memory: { signals: [], summary: 'Memory ready.' },
    learning: { candidates: [], summary: 'Sem candidatos.', pending: 0 },
    trust: {
      status: 'attention',
      title: 'Approval pending',
      summary: '1 action waiting for.',
      risk: 'attention',
      approvalCount: 1,
      sandbox: { mode: 'copy-sandbox', available: true, detail: 'Sandbox local.' },
      preferences: [],
      actions: [],
    },
    daily: {
      summary: '1 approval pendente.',
      activeTask: 'Corrigir bug',
      health: 'attention',
      nextSteps: ['Revisar approval'],
      pendingApprovals: 1,
      pendingLearning: 0,
    },
    actionCards: [{
      contractVersion: 'ExperienceActionCard/v1',
      id: 'card:approval:approval-secret-id',
      source: 'approval',
      title: 'Rodar validaction',
      summary: 'Runs a local command.',
      risk: 'attention',
      status: 'pending',
      scope: 'C:/repo',
      sandbox: 'copy-sandbox',
      affectedFiles: ['src/app.ts'],
      affectedCommands: ['npm run runtime:check'],
      ttlSeconds: 120,
      receiptHint: 'Receipt de decision.',
      createdAt: '2026-05-21T12:00:00.000Z',
      actions: [{
        id: 'approve:approval-secret-id',
        label: 'Aprovar',
        kind: 'approval',
        command: 'zavorth approve approval-secret-id',
        route: null,
        risk: 'attention',
        requiresApproval: false,
        reason: 'Autoriza.',
      }],
    }],
    diffReviews: [{
      contractVersion: 'ExperienceDiffReview/v1',
      id: 'diff-review:run-1:1',
      runId: 'run-1',
      title: 'Diff governado',
      summary: '1 file, 1 hunk, +1/-0.',
      status: 'pending',
      risk: 'safe',
      files: [{
        id: 'file-1',
        path: 'src/app.ts',
        status: 'pending',
        addedLines: 1,
        removedLines: 0,
        hunks: [],
      }],
      actions: [],
    }],
    executionGraph: { contractVersion: 'ExperienceExecutionGraph/v1', nodes: [], edges: [] },
    autoHealing: {
      contractVersion: 'ExperienceAutoHealing/v1',
      status: 'idle',
      attempt: 0,
      maxAttempts: 3,
      lastErrorSummary: null,
      proposedCorrection: null,
      validationCommand: null,
      budget: {
        elapsedMs: 0,
        maxElapsedMs: 120000,
        tokenBudget: null,
        tokensUsed: null,
        estimatedCostUsd: null,
        cancellable: false,
        cancelCommand: null,
      },
      cancelRequested: false,
    },
    contextRecovery: {
      contractVersion: 'ExperienceContextRecovery/v1',
      id: 'context-1',
      status: 'idle',
      question: 'ok',
      options: [],
      overflow: {
        totalOptions: 0,
        shownOptions: 0,
        hasOverflow: false,
        dashboardCommand: 'zavorth open',
      },
    },
    reasoningSummary: {
      understood: 'Corrigir bug',
      risk: 'attention',
      tools: [],
      approvalReason: 'Runs a local command.',
      result: 'Waiting for approval.',
      nextAction: 'Decida approval-secret-id.',
    },
    nextActions: [],
    health: { status: 'attention', summary: '1 approval pendente.', warnings: [] },
  };
}

describe('TelegramExperienceActionCardFormatter', () => {
  it('renders compact action cards with opaque callback data', () => {
    const registry = new TelegramExperienceActionCardRegistry();
    const formatter = new TelegramExperienceActionCardFormatter(registry);
    const rendered = formatter.formatSnapshot(makeSnapshot(), {
      scope: { userId: 'user-1', chatId: 'chat-1' },
    });
    const keyboard = (rendered.replyOptions?.reply_markup as any).inline_keyboard.flat();
    const callbackData = keyboard.map((button: any) => String(button.callback_data || '')).filter(Boolean);

    expect(rendered.text).toContain('Zavorth Control');
    expect(rendered.text).toContain('Rodar validaction');
    expect(callbackData.some((value: string) => value.startsWith('xcard:'))).toBe(true);
    expect(callbackData.every((value: string) => Buffer.byteLength(value, 'utf8') <= 64)).toBe(true);
    expect(callbackData.join('\n')).not.toContain('approval-secret-id');
    expect(callbackData.join('\n')).not.toContain('npm run runtime:check');
  });

  it('resolves Telegram callbacks only for the bound user/chat and before TTL', () => {
    let clock = 1_000;
    const registry = new TelegramExperienceActionCardRegistry({
      now: () => clock,
      ttlMs: 100,
    });
    const formatter = new TelegramExperienceActionCardFormatter(registry);
    const rendered = formatter.formatSnapshot(makeSnapshot(), {
      scope: { userId: 'user-1', chatId: 'chat-1' },
    });
    const keyboard = (rendered.replyOptions?.reply_markup as any).inline_keyboard.flat();
    const callback = keyboard
      .map((button: any) => String(button.callback_data || ''))
      .find((value: string) => value.startsWith('xcard:')) || '';

    expect(registry.resolve(callback, { userId: 'user-1', chatId: 'chat-1' })).toEqual(expect.objectContaining({
      ok: true,
    }));
    expect(registry.resolve(callback, { userId: 'user-2', chatId: 'chat-1' })).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    clock = 2_100;
    expect(registry.resolve(callback, { userId: 'user-1', chatId: 'chat-1' })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('can restore opaque callback entries from a configured local store', () => {
    let clock = 1_000;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telegram-callbacks-'));
    const storePath = path.join(dir, 'callbacks.json');
    const firstRegistry = new TelegramExperienceActionCardRegistry({
      now: () => clock,
      storePath,
    });
    const formatter = new TelegramExperienceActionCardFormatter(firstRegistry);
    const rendered = formatter.formatSnapshot(makeSnapshot(), {
      scope: { userId: 'user-1', chatId: 'chat-1' },
    });
    const keyboard = (rendered.replyOptions?.reply_markup as any).inline_keyboard.flat();
    const callback = keyboard
      .map((button: any) => String(button.callback_data || ''))
      .find((value: string) => value.startsWith('xcard:')) || '';

    const secondRegistry = new TelegramExperienceActionCardRegistry({
      now: () => clock,
      storePath,
    });
    expect(secondRegistry.resolve(callback, { userId: 'user-1', chatId: 'chat-1' })).toEqual(expect.objectContaining({
      ok: true,
    }));

    clock = 60 * 60 * 1000 + 2_000;
    expect(secondRegistry.resolve(callback, { userId: 'user-1', chatId: 'chat-1' })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('summarizes diffs without sending a full patch into Telegram', () => {
    const formatter = new TelegramExperienceActionCardFormatter();
    const rendered = formatter.formatDiffSummary(makeSnapshot());

    expect(rendered.text).toContain('Diff governado');
    expect(rendered.text).toContain('src/app.ts');
    expect(rendered.text).not.toContain('diff --git');
  });
});
