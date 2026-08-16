import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  UnifiedSlashCommandHandler,
  isThinkingExpanded,
  getActiveVariant,
  getActiveSessionId,
} from '../../../src/cli/commands/UnifiedSlashCommandHandler.js';
import { ModelPickerModal } from '../../../src/cli/presentation/ModelPickerModal.js';
import { VariantPickerModal } from '../../../src/cli/presentation/VariantPickerModal.js';
import { SessionPersistenceService } from '../../../src/storage/SessionPersistenceService.js';
import { stripCliAnsi } from '../../../src/cli/ZavorthCliVisualTheme.js';
import type { ZavorthCliFlags, CliWriter } from '../../../src/cli/ZavorthCliContract.js';

describe('UnifiedSlashCommandHandler & VariantPickerModal', () => {
  const dummyFlags: ZavorthCliFlags = {
    command: null,
    repl: false,
    json: false,
    live: false,
    userId: 'test-user',
    platform: 'web',
    chatId: 'test-chat',
    sessionId: 'test-session',
    workspaceHint: null,
    commandText: null,
    headless: false,
    approvalMode: null,
  };

  const dummyRuntime: any = {};

  beforeEach(() => {
    SessionPersistenceService.resetForTesting();
  });

  it('should identify all unified slash commands including /sessions, /resume, /fork, /todo, /swarm', () => {
    expect(UnifiedSlashCommandHandler.isSlashCommand('/models')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/variants')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/thinking')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/sessions')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/resume 123')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/fork')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/todo add test')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/swarm status')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/teamwork run test')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/lsp status')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/config show')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/skills')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/doctor')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/clear')).toBe(true);
  });

  it('should manage sessions via /sessions, /resume and /fork commands', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    // 1. Create a session
    const s1 = SessionPersistenceService.createSession({ title: 'Primary Architecture' });

    // 2. Resume session
    const resResult = await UnifiedSlashCommandHandler.handle(`/resume ${s1.id}`, dummyRuntime, dummyFlags, writer);
    expect(resResult?.ok).toBe(true);
    expect(getActiveSessionId()).toBe(s1.id);

    // 3. Fork session
    const forkResult = await UnifiedSlashCommandHandler.handle('/fork Experimental Branch', dummyRuntime, dummyFlags, writer);
    expect(forkResult?.ok).toBe(true);
    expect(getActiveSessionId()).not.toBe(s1.id);
  });

  it('should manage todos via /todo command', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    SessionPersistenceService.createSession({ id: 'test-session', title: 'Task Session' });

    // Add todo
    const addRes = await UnifiedSlashCommandHandler.handle('/todo add Audit all failing tests', dummyRuntime, dummyFlags, writer);
    expect(addRes?.ok).toBe(true);

    // List todos
    const listRes = await UnifiedSlashCommandHandler.handle('/todo list', dummyRuntime, dummyFlags, writer);
    expect(listRes?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('Audit all failing tests');

    // Complete todo
    const doneRes = await UnifiedSlashCommandHandler.handle('/todo done Audit', dummyRuntime, dummyFlags, writer);
    expect(doneRes?.ok).toBe(true);
  });

  it('should orchestrate dynamic swarm via /swarm command', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const statusRes = await UnifiedSlashCommandHandler.handle('/swarm status', dummyRuntime, dummyFlags, writer);
    expect(statusRes?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('Dynamic Swarm Engine');

    const runRes = await UnifiedSlashCommandHandler.handle('/swarm run Implement user authentication and verify contracts', dummyRuntime, dummyFlags, writer);
    expect(runRes?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('Swarm Execution');
  });

  it('should toggle thinking visibility via /thinking command', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const initial = isThinkingExpanded();
    await UnifiedSlashCommandHandler.handle('/thinking', dummyRuntime, dummyFlags, writer);
    expect(isThinkingExpanded()).toBe(!initial);

    await UnifiedSlashCommandHandler.handle('/thinking expand', dummyRuntime, dummyFlags, writer);
    expect(isThinkingExpanded()).toBe(true);

    await UnifiedSlashCommandHandler.handle('/thinking collapse', dummyRuntime, dummyFlags, writer);
    expect(isThinkingExpanded()).toBe(false);
  });

  it('should set and list reasoning variants via /variants command', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const result = await UnifiedSlashCommandHandler.handle('/variants high', dummyRuntime, dummyFlags, writer);
    expect(result?.ok).toBe(true);
    expect(getActiveVariant()).toBe('high');

    const tableResult = await UnifiedSlashCommandHandler.handle('/variants', dummyRuntime, dummyFlags, writer);
    expect(tableResult?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('Model Reasoning Variants');
  });

  it('should render VariantPickerModal view matching screenshot 2 design', () => {
    const options = VariantPickerModal.getAvailableVariants();
    expect(options.length).toBeGreaterThan(0);

    const modalView = VariantPickerModal.renderModal({
      searchQuery: '',
      selectedIndex: 2,
      currentVariant: 'high',
      options,
    });

    const clean = stripCliAnsi(modalView);
    expect(clean).toContain('Select variant');
    expect(clean).toContain('Search');
    expect(clean).toContain('Default');
    expect(clean).toContain('high');
  });

  it('should filter items and render ModelPickerModal view matching screenshot 1 design', () => {
    const items = ModelPickerModal.loadAvailableModels();
    expect(items.length).toBeGreaterThan(0);

    const filtered = ModelPickerModal.filterItems(items, 'claude');
    expect(filtered.length).toBeGreaterThan(0);

    const modalView = ModelPickerModal.renderModal({
      searchQuery: 'claude',
      selectedIndex: 0,
      items,
    });

    const clean = stripCliAnsi(modalView);
    expect(clean).toContain('Select model');
    expect(clean).toContain('Search claude');
    expect(clean).toContain('Connect provider');
  });
});
