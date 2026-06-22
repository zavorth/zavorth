import fs from 'fs';
import os from 'os';
import path from 'path';
import { ErrorHandlingService } from '../../src/services/ErrorHandlingService';

describe('ErrorHandlingService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-errorhandling-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero strategies', () => {
    const service = new ErrorHandlingService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.strategyCount).toBe(0);
    expect(status.defaultStrategy).toBe('ask-user');
    expect(status.filePath).toBe(path.join(tempDir, 'ERROR-HANDLING.md'));
  });

  it('sets a strategy and persists it to ERROR-HANDLING.md', () => {
    const service = new ErrorHandlingService({ projectRoot: tempDir });

    const rule = service.setStrategy('network', 'retry-silent', { maxRetries: 5 });

    expect(rule.category).toBe('network');
    expect(rule.strategy).toBe('retry-silent');
    expect(rule.maxRetries).toBe(5);
    expect(fs.existsSync(path.join(tempDir, 'ERROR-HANDLING.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'ERROR-HANDLING.md'), 'utf8');
    expect(fileContent).toContain('[network] retry-silent');
    expect(fileContent).toContain('maxRetries:5');
  });

  it('overwrites strategy for the same category', () => {
    const service = new ErrorHandlingService({ projectRoot: tempDir });
    service.setStrategy('filesystem', 'retry-silent');

    service.setStrategy('filesystem', 'escalate');

    const strategy = service.getStrategy('filesystem');
    expect(strategy?.strategy).toBe('escalate');
  });

  it('handleError returns default ask-user strategy when no rule exists', () => {
    const service = new ErrorHandlingService({ projectRoot: tempDir });

    const result = service.handleError('auth');

    expect(result.strategy).toBe('ask-user');
    expect(result.maxRetries).toBe(3);
  });

  it('handleError returns configured strategy with context', () => {
    const service = new ErrorHandlingService({ projectRoot: tempDir });
    service.setStrategy('timeout', 'retry-explain', { maxRetries: 2, fallbackStrategy: 'ask-user' });

    const result = service.handleError('timeout', 'connection timed out');

    expect(result.strategy).toBe('retry-explain');
    expect(result.maxRetries).toBe(2);
    expect(result.fallback).toBe('ask-user');
    expect(result.message).toContain('connection timed out');
  });

  it('sets strategy with fallback option', () => {
    const service = new ErrorHandlingService({ projectRoot: tempDir });

    service.setStrategy('validation', 'suggest-alternatives', { fallbackStrategy: 'ask-user' });

    const strategy = service.getStrategy('validation');
    expect(strategy?.strategy).toBe('suggest-alternatives');
    expect(strategy?.fallbackStrategy).toBe('ask-user');
  });
});
