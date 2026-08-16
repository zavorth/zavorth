import { describe, it, expect } from '@jest/globals';
import { UnifiedSlashCommandHandler } from '../../../src/cli/commands/UnifiedSlashCommandHandler.js';
import { ModelPickerModal } from '../../../src/cli/presentation/ModelPickerModal.js';
import { stripCliAnsi } from '../../../src/cli/ZavorthCliVisualTheme.js';
import type { ZavorthCliRuntime, ZavorthCliFlags, CliWriter } from '../../../src/cli/ZavorthCliContract.js';

describe('UnifiedSlashCommandHandler & ModelPickerModal', () => {
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

  it('should identify valid slash commands', () => {
    expect(UnifiedSlashCommandHandler.isSlashCommand('/models')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/model')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/config show')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/skills')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/doctor')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('/clear')).toBe(true);
    expect(UnifiedSlashCommandHandler.isSlashCommand('normal text')).toBe(false);
  });

  it('should execute /models command and output catalog table', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const result = await UnifiedSlashCommandHandler.handle('/models', dummyRuntime, dummyFlags, writer);

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('=== Zavorth Connected Providers & Models ===');
  });

  it('should execute /config show command and output 7-layer resolved config', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const result = await UnifiedSlashCommandHandler.handle('/config show', dummyRuntime, dummyFlags, writer);

    expect(result?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('Current Zavorth Configuration');
  });

  it('should execute /skills command and list active tools', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const result = await UnifiedSlashCommandHandler.handle('/skills', dummyRuntime, dummyFlags, writer);

    expect(result?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('run_command');
    expect(outputs.join('\n')).toContain('replace_file_content');
  });

  it('should execute /doctor command and output system health', async () => {
    const outputs: string[] = [];
    const writer: CliWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const result = await UnifiedSlashCommandHandler.handle('/doctor', dummyRuntime, dummyFlags, writer);

    expect(result?.ok).toBe(true);
    expect(outputs.join('\n')).toContain('Configuration Engine');
    expect(outputs.join('\n')).toContain('Provider Registry');
  });

  it('should filter items and render ModelPickerModal view matching screenshot design', () => {
    const items = ModelPickerModal.loadAvailableModels();
    expect(items.length).toBeGreaterThan(0);

    const filtered = ModelPickerModal.filterItems(items, 'claude');
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].name.toLowerCase()).toContain('claude');

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
