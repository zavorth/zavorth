import { describe, it, expect, beforeEach } from '@jest/globals';
import { SessionAnalyticsDashboard } from '../../src/services/SessionAnalyticsDashboard.js';

describe('SessionAnalyticsDashboard', () => {
  let dashboard: SessionAnalyticsDashboard;

  beforeEach(() => {
    dashboard = new SessionAnalyticsDashboard();
  });

  it('records session start', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });

    const stats = dashboard.getSessionStats('ses_1');
    expect(stats).not.toBeNull();
    expect(stats?.model).toBe('gpt-4o');
    expect(stats?.workspace).toBe('/test');
  });

  it('records tool calls', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.recordToolCall('ses_1', 'read_file', { success: true, durationMs: 50 });
    dashboard.recordToolCall('ses_1', 'write_file', { success: false, durationMs: 100, errorMessage: 'Permission denied' });

    const stats = dashboard.getSessionStats('ses_1');
    expect(stats?.toolCalls.total).toBe(2);
    expect(stats?.toolCalls.successful).toBe(1);
    expect(stats?.toolCalls.failed).toBe(1);
  });

  it('records token usage', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.recordTokenUsage('ses_1', { input: 1000, output: 500 });

    const stats = dashboard.getSessionStats('ses_1');
    expect(stats?.tokens.totalInput).toBe(1000);
    expect(stats?.tokens.totalOutput).toBe(500);
    expect(stats?.tokens.total).toBe(1500);
  });

  it('records errors', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.recordError('ses_1', 'Connection timeout', 'high');

    const stats = dashboard.getSessionStats('ses_1');
    expect(stats?.errors.total).toBe(1);
    expect(stats?.errors.bySeverity.high).toBe(1);
  });

  it('increments message count', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.incrementMessageCount('ses_1');
    dashboard.incrementMessageCount('ses_1');

    const stats = dashboard.getSessionStats('ses_1');
    expect(stats?.messageCount).toBe(2);
  });

  it('gets overview', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.recordToolCall('ses_1', 'read_file', { success: true, durationMs: 50 });
    dashboard.recordTokenUsage('ses_1', { input: 1000, output: 500 });

    const overview = dashboard.getOverview();
    expect(overview.totalSessions).toBe(1);
    expect(overview.totalToolCalls).toBe(1);
    expect(overview.totalTokens).toBe(1500);
  });

  it('gets tool ranking', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.recordToolCall('ses_1', 'read_file', { success: true, durationMs: 50 });
    dashboard.recordToolCall('ses_1', 'read_file', { success: true, durationMs: 60 });
    dashboard.recordToolCall('ses_1', 'write_file', { success: true, durationMs: 100 });

    const ranking = dashboard.getToolRanking();
    expect(ranking[0].name).toBe('read_file');
    expect(ranking[0].totalCalls).toBe(2);
  });

  it('gets cost breakdown', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    dashboard.recordTokenUsage('ses_1', { input: 10000, output: 5000 });

    const breakdown = dashboard.getCostBreakdown();
    expect(breakdown.length).toBe(1);
    expect(breakdown[0].model).toBe('gpt-4o');
    expect(breakdown[0].estimatedCost).toBeGreaterThan(0);
  });

  it('exports data as JSON', () => {
    dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/test' });
    const json = dashboard.exportData();
    const data = JSON.parse(json);
    expect(data.overview).toBeDefined();
    expect(data.toolRanking).toBeDefined();
  });

  it('returns null for non-existent session', () => {
    const stats = dashboard.getSessionStats('nonexistent');
    expect(stats).toBeNull();
  });
});
