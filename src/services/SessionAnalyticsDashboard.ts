/**
 * SessionAnalyticsDashboard — Analytics and metrics for sessions, tools, and performance.
 *
 * Tracks session activity, tool usage, token consumption, and provides
 * dashboard-ready data for monitoring agent performance.
 *
 * Usage:
 *   const dashboard = new SessionAnalyticsDashboard();
 *   dashboard.recordSessionStart('ses_123', { model: 'gpt-4o', workspace: '/project' });
 *   dashboard.recordToolCall('ses_123', 'read_file', { success: true, durationMs: 45 });
 *   dashboard.recordTokenUsage('ses_123', { input: 1500, output: 800 });
 *   const stats = dashboard.getSessionStats('ses_123');
 *   const overview = dashboard.getOverview();
 */

export interface SessionStartEvent {
  sessionId: string;
  model: string;
  workspace: string;
  timestamp: number;
}

export interface ToolCallEvent {
  sessionId: string;
  toolName: string;
  success: boolean;
  durationMs: number;
  timestamp: number;
  errorMessage?: string;
}

export interface TokenUsageEvent {
  sessionId: string;
  input: number;
  output: number;
  timestamp: number;
}

export interface ErrorEvent {
  sessionId: string;
  error: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

export interface SessionStats {
  sessionId: string;
  model: string;
  workspace: string;
  startedAt: number;
  lastActivityAt: number;
  durationMs: number;
  messageCount: number;
  toolCalls: {
    total: number;
    successful: number;
    failed: number;
    byTool: Record<string, { count: number; success: number; failed: number; avgDurationMs: number }>;
  };
  tokens: {
    totalInput: number;
    totalOutput: number;
    total: number;
    estimatedCost: number;
  };
  errors: {
    total: number;
    bySeverity: Record<string, number>;
  };
  performance: {
    avgToolDurationMs: number;
    slowestTool: { name: string; durationMs: number } | null;
    fastestTool: { name: string; durationMs: number } | null;
  };
}

export interface DashboardOverview {
  totalSessions: number;
  activeSessions: number;
  totalToolCalls: number;
  totalTokens: number;
  estimatedCost: number;
  errorRate: number;
  topTools: Array<{ name: string; count: number; successRate: number }>;
  recentActivity: Array<{ sessionId: string; action: string; timestamp: number }>;
  performanceSummary: {
    avgToolDurationMs: number;
    totalDurationMs: number;
  };
}

// Cost per 1k tokens (approximate)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.01, output: 0.03 },
  'gpt-4o-mini': { input: 0.001, output: 0.004 },
  'claude-4': { input: 0.015, output: 0.075 },
  'claude-4-sonnet': { input: 0.003, output: 0.015 },
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
};

export class SessionAnalyticsDashboard {
  private sessions = new Map<string, {
    model: string;
    workspace: string;
    startedAt: number;
    lastActivityAt: number;
    messageCount: number;
    toolCalls: ToolCallEvent[];
    tokenUsage: TokenUsageEvent[];
    errors: ErrorEvent[];
  }>();

  private recentActivity: Array<{ sessionId: string; action: string; timestamp: number }> = [];
  private maxRecentActivity = 100;

  /**
   * Records session start.
   */
  recordSessionStart(sessionId: string, data: { model: string; workspace: string }): void {
    this.sessions.set(sessionId, {
      model: data.model,
      workspace: data.workspace,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      messageCount: 0,
      toolCalls: [],
      tokenUsage: [],
      errors: [],
    });

    this.addActivity(sessionId, 'session_started');
  }

  /**
   * Records a tool call.
   */
  recordToolCall(sessionId: string, toolName: string, data: {
    success: boolean;
    durationMs: number;
    errorMessage?: string;
  }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = Date.now();
    session.toolCalls.push({
      sessionId,
      toolName,
      success: data.success,
      durationMs: data.durationMs,
      timestamp: Date.now(),
      errorMessage: data.errorMessage,
    });

    this.addActivity(sessionId, `tool_${toolName}`);
  }

  /**
   * Records token usage.
   */
  recordTokenUsage(sessionId: string, data: { input: number; output: number }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = Date.now();
    session.tokenUsage.push({
      sessionId,
      input: data.input,
      output: data.output,
      timestamp: Date.now(),
    });

    this.addActivity(sessionId, 'tokens_used');
  }

  /**
   * Records an error.
   */
  recordError(sessionId: string, error: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivityAt = Date.now();
    session.errors.push({
      sessionId,
      error,
      severity,
      timestamp: Date.now(),
    });

    this.addActivity(sessionId, `error_${severity}`);
  }

  /**
   * Increments message count.
   */
  incrementMessageCount(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messageCount++;
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Gets stats for a specific session.
   */
  getSessionStats(sessionId: string): SessionStats | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    const toolCalls = session.toolCalls;
    const tokenUsage = session.tokenUsage;

    // Tool stats
    const byTool: Record<string, { count: number; success: number; failed: number; avgDurationMs: number }> = {};
    let totalToolDuration = 0;

    for (const call of toolCalls) {
      if (!byTool[call.toolName]) {
        byTool[call.toolName] = { count: 0, success: 0, failed: 0, avgDurationMs: 0 };
      }
      byTool[call.toolName].count++;
      if (call.success) {
        byTool[call.toolName].success++;
      } else {
        byTool[call.toolName].failed++;
      }
      totalToolDuration += call.durationMs;
    }

    // Calculate average durations
    for (const tool of Object.values(byTool)) {
      const toolCallsForTool = toolCalls.filter((c) => c.toolName === Object.keys(byTool).find((k) => byTool[k] === tool));
      tool.avgDurationMs = toolCallsForTool.length > 0
        ? toolCallsForTool.reduce((sum, c) => sum + c.durationMs, 0) / toolCallsForTool.length
        : 0;
    }

    // Token stats
    const totalInput = tokenUsage.reduce((sum, u) => sum + u.input, 0);
    const totalOutput = tokenUsage.reduce((sum, u) => sum + u.output, 0);

    // Error stats
    const bySeverity: Record<string, number> = {};
    for (const error of session.errors) {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    // Performance
    let slowestTool: { name: string; durationMs: number } | null = null;
    let fastestTool: { name: string; durationMs: number } | null = null;

    for (const call of toolCalls) {
      if (!slowestTool || call.durationMs > slowestTool.durationMs) {
        slowestTool = { name: call.toolName, durationMs: call.durationMs };
      }
      if (!fastestTool || call.durationMs < fastestTool.durationMs) {
        fastestTool = { name: call.toolName, durationMs: call.durationMs };
      }
    }

    // Cost estimation
    const costs = MODEL_COSTS[session.model] ?? { input: 0.01, output: 0.03 };
    const estimatedCost = (totalInput / 1000) * costs.input + (totalOutput / 1000) * costs.output;

    return {
      sessionId,
      model: session.model,
      workspace: session.workspace,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      durationMs: now - session.startedAt,
      messageCount: session.messageCount,
      toolCalls: {
        total: toolCalls.length,
        successful: toolCalls.filter((c) => c.success).length,
        failed: toolCalls.filter((c) => !c.success).length,
        byTool,
      },
      tokens: {
        totalInput,
        totalOutput,
        total: totalInput + totalOutput,
        estimatedCost,
      },
      errors: {
        total: session.errors.length,
        bySeverity,
      },
      performance: {
        avgToolDurationMs: toolCalls.length > 0 ? totalToolDuration / toolCalls.length : 0,
        slowestTool,
        fastestTool,
      },
    };
  }

  /**
   * Gets dashboard overview.
   */
  getOverview(): DashboardOverview {
    const now = Date.now();
    const allToolCalls: ToolCallEvent[] = [];
    const allTokenUsage: TokenUsageEvent[] = [];
    let totalDurationMs = 0;

    for (const session of this.sessions.values()) {
      allToolCalls.push(...session.toolCalls);
      allTokenUsage.push(...session.tokenUsage);
      totalDurationMs += now - session.startedAt;
    }

    // Tool stats
    const toolStats: Record<string, { count: number; success: number }> = {};
    for (const call of allToolCalls) {
      if (!toolStats[call.toolName]) {
        toolStats[call.toolName] = { count: 0, success: 0 };
      }
      toolStats[call.toolName].count++;
      if (call.success) toolStats[call.toolName].success++;
    }

    const topTools = Object.entries(toolStats)
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        successRate: stats.count > 0 ? stats.success / stats.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Token stats
    const totalInput = allTokenUsage.reduce((sum, u) => sum + u.input, 0);
    const totalOutput = allTokenUsage.reduce((sum, u) => sum + u.output, 0);

    // Cost estimation (using average model costs)
    const avgCosts = { input: 0.005, output: 0.02 };
    const estimatedCost = (totalInput / 1000) * avgCosts.input + (totalOutput / 1000) * avgCosts.output;

    // Error rate
    const totalErrors = Array.from(this.sessions.values())
      .reduce((sum, s) => sum + s.errors.length, 0);

    return {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values())
        .filter((s) => now - s.lastActivityAt < 300_000).length, // 5 min
      totalToolCalls: allToolCalls.length,
      totalTokens: totalInput + totalOutput,
      estimatedCost,
      errorRate: allToolCalls.length > 0 ? totalErrors / allToolCalls.length : 0,
      topTools,
      recentActivity: this.recentActivity.slice(-20),
      performanceSummary: {
        avgToolDurationMs: allToolCalls.length > 0
          ? allToolCalls.reduce((sum, c) => sum + c.durationMs, 0) / allToolCalls.length
          : 0,
        totalDurationMs,
      },
    };
  }

  /**
   * Gets all active sessions.
   */
  getActiveSessions(): string[] {
    const now = Date.now();
    return Array.from(this.sessions.entries())
      .filter(([, s]) => now - s.lastActivityAt < 300_000)
      .map(([id]) => id);
  }

  /**
   * Gets tool usage ranking.
   */
  getToolRanking(): Array<{
    name: string;
    totalCalls: number;
    successRate: number;
    avgDurationMs: number;
  }> {
    const toolStats: Record<string, {
      count: number;
      success: number;
      totalDuration: number;
    }> = {};

    for (const session of this.sessions.values()) {
      for (const call of session.toolCalls) {
        if (!toolStats[call.toolName]) {
          toolStats[call.toolName] = { count: 0, success: 0, totalDuration: 0 };
        }
        toolStats[call.toolName].count++;
        if (call.success) toolStats[call.toolName].success++;
        toolStats[call.toolName].totalDuration += call.durationMs;
      }
    }

    return Object.entries(toolStats)
      .map(([name, stats]) => ({
        name,
        totalCalls: stats.count,
        successRate: stats.count > 0 ? stats.success / stats.count : 0,
        avgDurationMs: stats.count > 0 ? stats.totalDuration / stats.count : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * Gets cost breakdown by model.
   */
  getCostBreakdown(): Array<{
    model: string;
    sessions: number;
    totalTokens: number;
    estimatedCost: number;
  }> {
    const modelStats: Record<string, { sessions: number; tokens: number }> = {};

    for (const session of this.sessions.values()) {
      if (!modelStats[session.model]) {
        modelStats[session.model] = { sessions: 0, tokens: 0 };
      }
      modelStats[session.model].sessions++;
      modelStats[session.model].tokens += session.tokenUsage.reduce((sum, u) => sum + u.input + u.output, 0);
    }

    return Object.entries(modelStats)
      .map(([model, stats]) => {
        const costs = MODEL_COSTS[model] ?? { input: 0.01, output: 0.03 };
        return {
          model,
          sessions: stats.sessions,
          totalTokens: stats.tokens,
          estimatedCost: (stats.tokens / 1000) * costs.input,
        };
      })
      .sort((a, b) => b.estimatedCost - a.estimatedCost);
  }

  /**
   * Exports analytics data as JSON.
   */
  exportData(): string {
    return JSON.stringify({
      overview: this.getOverview(),
      toolRanking: this.getToolRanking(),
      costBreakdown: this.getCostBreakdown(),
      sessions: Array.from(this.sessions.keys()).map((id) => this.getSessionStats(id)).filter(Boolean),
    }, null, 2);
  }

  private addActivity(sessionId: string, action: string): void {
    this.recentActivity.push({ sessionId, action, timestamp: Date.now() });
    if (this.recentActivity.length > this.maxRecentActivity) {
      this.recentActivity.shift();
    }
  }
}
