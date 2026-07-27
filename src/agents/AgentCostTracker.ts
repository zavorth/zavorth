import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';export type AgentCostEntry = {
  agentId: string;
  action: 'invoke' | 'chain' | 'register';
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  timestamp: string;
  chainId: string | null;
  stepId: string | null;
  success: boolean;
};

export type AgentCostSummary = {
  agentId: string;
  totalInvocations: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  totalDurationMs: number;
  successRate: number;
  avgCostPerInvocation: number;
  avgDurationMs: number;
  lastUsed: string;
};

export type AgentCostReport = {
  generatedAt: string;
  period: { from: string; to: string };
  totalCostUsd: number;
  totalInvocations: number;
  agents: AgentCostSummary[];
  chains: Array<{
    chainId: string;
    name: string | null;
    totalCostUsd: number;
    steps: number;
    durationMs: number;
  }>;
};

export type AgentCostTrackerRuntime = {
  now?: () => Date;
  dataDir?: string;
  pricing?: Record<string, { inputPer1k: number; outputPer1k: number }>;
};

const DEFAULT_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'claude': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'codex': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'gemini': { inputPer1k: 0.000125, outputPer1k: 0.0005 },
  'default': { inputPer1k: 0.002, outputPer1k: 0.008 },
};

export class AgentCostTracker {
  private readonly now: () => Date;
  private readonly dataDir: string;
  private readonly pricing: Record<string, { inputPer1k: number; outputPer1k: number }>;
  private readonly entriesFile: string;

  constructor(runtime: AgentCostTrackerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.dataDir = runtime.dataDir || path.join(process.cwd(), 'data', 'runtime', 'agent-costs');
    this.pricing = runtime.pricing || DEFAULT_PRICING;
    this.entriesFile = path.join(this.dataDir, 'entries.jsonl');
  }

  public track(entry: Omit<AgentCostEntry, 'costUsd' | 'timestamp'>): AgentCostEntry {
    const pricing = this.pricing[entry.agentId] || this.pricing['default'] || { inputPer1k: 0.002, outputPer1k: 0.008 };
    const costUsd = (entry.tokensIn / 1000 * pricing.inputPer1k) + (entry.tokensOut / 1000 * pricing.outputPer1k);
    const fullEntry: AgentCostEntry = {
      ...entry,
      costUsd: Math.round(costUsd * 1000000) / 1000000,
      timestamp: this.now().toISOString(),
    };

    this.appendEntry(fullEntry);
    return fullEntry;
  }

  public getSummary(agentId?: string, from?: string, to?: string): AgentCostSummary[] {
    const entries = this.readEntries();
    const filtered = entries.filter((e) => {
      if (agentId && e.agentId !== agentId) return false;
      if (from && e.timestamp < from) return false;
      if (to && e.timestamp > to) return false;
      return true;
    });

    const byAgent = new Map<string, AgentCostEntry[]>();
    for (const entry of filtered) {
      if (!byAgent.has(entry.agentId)) byAgent.set(entry.agentId, []);
      byAgent.get(entry.agentId)!.push(entry);
    }

    const summaries: AgentCostSummary[] = [];
    for (const [id, agentEntries] of byAgent) {
      const totalTokensIn = agentEntries.reduce((sum, e) => sum + e.tokensIn, 0);
      const totalTokensOut = agentEntries.reduce((sum, e) => sum + e.tokensOut, 0);
      const totalCostUsd = agentEntries.reduce((sum, e) => sum + e.costUsd, 0);
      const totalDurationMs = agentEntries.reduce((sum, e) => sum + e.durationMs, 0);
      const successCount = agentEntries.filter((e) => e.success).length;

      summaries.push({
        agentId: id,
        totalInvocations: agentEntries.length,
        totalTokensIn,
        totalTokensOut,
        totalCostUsd: Math.round(totalCostUsd * 1000000) / 1000000,
        totalDurationMs,
        successRate: agentEntries.length > 0 ? successCount / agentEntries.length : 0,
        avgCostPerInvocation: agentEntries.length > 0 ? Math.round((totalCostUsd / agentEntries.length) * 1000000) / 1000000 : 0,
        avgDurationMs: agentEntries.length > 0 ? Math.round(totalDurationMs / agentEntries.length) : 0,
        lastUsed: agentEntries[agentEntries.length - 1].timestamp,
      });
    }

    return summaries.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }

  public getChainSummary(chainId?: string): AgentCostReport['chains'] {
    const entries = this.readEntries();
    const chainEntries = entries.filter((e) => e.chainId && (!chainId || e.chainId === chainId));

    const byChain = new Map<string, AgentCostEntry[]>();
    for (const entry of chainEntries) {
      if (!byChain.has(entry.chainId!)) byChain.set(entry.chainId!, []);
      byChain.get(entry.chainId!)!.push(entry);
    }

    return Array.from(byChain.entries()).map(([id, chainE]) => ({
      chainId: id,
      name: null,
      totalCostUsd: Math.round(chainE.reduce((sum, e) => sum + e.costUsd, 0) * 1000000) / 1000000,
      steps: chainE.length,
      durationMs: chainE.reduce((sum, e) => sum + e.durationMs, 0),
    }));
  }

  public generateReport(from?: string, to?: string): AgentCostReport {
    const agents = this.getSummary(undefined, from, to);
    const chains = this.getChainSummary();
    const entries = this.readEntries();

    return {
      generatedAt: this.now().toISOString(),
      period: {
        from: from || (entries.length > 0 ? entries[0].timestamp : this.now().toISOString()),
        to: to || this.now().toISOString(),
      },
      totalCostUsd: Math.round(agents.reduce((sum, a) => sum + a.totalCostUsd, 0) * 1000000) / 1000000,
      totalInvocations: agents.reduce((sum, a) => sum + a.totalInvocations, 0),
      agents,
      chains,
    };
  }

  public formatReport(report: AgentCostReport): string {
    const lines: string[] = [];
    lines.push('Agent Cost Report');
    lines.push(`${'═'.repeat(60)}`);
    lines.push(`Period: ${report.period.from} to ${report.period.to}`);
    lines.push(`Total cost: $${report.totalCostUsd.toFixed(6)}`);
    lines.push(`Total invocations: ${report.totalInvocations}`);
    lines.push('');

    if (report.agents.length > 0) {
      lines.push('Agents:');
      lines.push(`${'─'.repeat(60)}`);
      for (const agent of report.agents) {
        lines.push(`  ${agent.agentId}`);
        lines.push(`    Invocations: ${agent.totalInvocations}`);
        lines.push(`    Cost: $${agent.totalCostUsd.toFixed(6)}`);
        lines.push(`    Tokens: ${agent.totalTokensIn} in / ${agent.totalTokensOut} out`);
        lines.push(`    Success rate: ${(agent.successRate * 100).toFixed(1)}%`);
        lines.push(`    Avg duration: ${agent.avgDurationMs}ms`);
        lines.push('');
      }
    }

    if (report.chains.length > 0) {
      lines.push('Chains:');
      lines.push(`${'─'.repeat(60)}`);
      for (const chain of report.chains) {
        lines.push(`  ${chain.chainId}: $${chain.totalCostUsd.toFixed(6)} (${chain.steps} steps, ${chain.durationMs}ms)`);
      }
    }

    return lines.join('\n');
  }

  private appendEntry(entry: AgentCostEntry): void {
    try {
      fs.mkdirSync(path.dirname(this.entriesFile), { recursive: true });
      fs.appendFileSync(this.entriesFile, JSON.stringify(entry) + '\n', 'utf-8');
    } catch (error: unknown) {// silent fail
      logger.warn('[Agent Cost Tracker] filesystem operation failed', error);
    }
  }

  private readEntries(): AgentCostEntry[] {
    try {
      if (!fs.existsSync(this.entriesFile)) return [];
      const content = fs.readFileSync(this.entriesFile, 'utf-8');
      return content.split('\n').filter(Boolean).map((line) => {
        try {
          return JSON.parse(line) as AgentCostEntry;
        } catch (error: unknown) {logger.warn('[Agent Cost Tracker] JSON parse failed', error); return null; }
      }).filter(Boolean) as AgentCostEntry[];
    } catch (error: unknown) {logger.warn('[Agent Cost Tracker] JSON parse failed', error); return []; }
  }
}
