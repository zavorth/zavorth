import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface ResearchTrajectory {
  id: string;
  session_id: string;
  task: string;
  hypothesis: string | null;
  method: string;
  steps: Array<{
    step_number: number;
    action: string;
    tool_used: string;
    result_summary: string;
    duration_ms: number;
    success: boolean;
  }>;
  outcome: 'confirmed' | 'refuted' | 'inconclusive' | 'partial';
  conclusion: string;
  evidence: string[];
  citations: Array<{
    source: string;
    title: string;
    relevance: number;
  }>;
  quality_score: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ResearchReport {
  id: string;
  title: string;
  trajectories: string[];
  findings: string[];
  methodology: string;
  conclusions: string[];
  confidence: number;
  created_at: string;
}

export class TrajectoryResearchService {
  private readonly storageDir: string;
  private trajectories: Map<string, ResearchTrajectory> = new Map();
  private reports: Map<string, ResearchReport> = new Map();

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'research');
    this.ensureStorageDir();
    this.loadData();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadData(): void {
    const trajPath = path.join(this.storageDir, 'trajectories.json');
    const reportsPath = path.join(this.storageDir, 'reports.json');

    if (fs.existsSync(trajPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(trajPath, 'utf-8'));
        this.trajectories = new Map(Object.entries(data));
      } catch (error: unknown) {/* ignore */ logger.warn('[Trajectory Research] JSON parse failed', error); }
    }

    if (fs.existsSync(reportsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(reportsPath, 'utf-8'));
        this.reports = new Map(Object.entries(data));
      } catch (error: unknown) {/* ignore */ logger.warn('[Trajectory Research] JSON parse failed', error); }
    }
  }

  private saveData(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'trajectories.json'),
      JSON.stringify(Object.fromEntries(this.trajectories), null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(this.storageDir, 'reports.json'),
      JSON.stringify(Object.fromEntries(this.reports), null, 2),
      'utf-8',
    );
  }

  public createTrajectory(input: {
    session_id: string;
    task: string;
    hypothesis?: string;
    method: string;
    metadata?: Record<string, unknown>;
  }): string {
    const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const trajectory: ResearchTrajectory = {
      id,
      session_id: input.session_id,
      task: input.task,
      hypothesis: input.hypothesis || null,
      method: input.method,
      steps: [],
      outcome: 'inconclusive',
      conclusion: '',
      evidence: [],
      citations: [],
      quality_score: 0,
      created_at: new Date().toISOString(),
      metadata: input.metadata || {},
    };

    this.trajectories.set(id, trajectory);
    this.saveData();

    return `Research trajectory created. ID: ${id}\n  Task: ${input.task}\n  Method: ${input.method}`;
  }

  public addStep(trajectoryId: string, step: {
    action: string;
    tool_used: string;
    result_summary: string;
    duration_ms: number;
    success: boolean;
  }): string {
    const traj = this.trajectories.get(trajectoryId);
    if (!traj) return `Trajectory "${trajectoryId}" not found.`;

    traj.steps.push({
      step_number: traj.steps.length + 1,
      ...step,
    });

    this.saveData();
    return `Step ${traj.steps.length} added to trajectory "${trajectoryId}".`;
  }

  public addEvidence(trajectoryId: string, evidence: string): string {
    const traj = this.trajectories.get(trajectoryId);
    if (!traj) return `Trajectory "${trajectoryId}" not found.`;

    traj.evidence.push(evidence);
    this.saveData();
    return `Evidence added. Total: ${traj.evidence.length}`;
  }

  public addCitation(trajectoryId: string, citation: { source: string; title: string; relevance: number }): string {
    const traj = this.trajectories.get(trajectoryId);
    if (!traj) return `Trajectory "${trajectoryId}" not found.`;

    traj.citations.push(citation);
    this.saveData();
    return `Citation added. Total: ${traj.citations.length}`;
  }

  public concludeTrajectory(trajectoryId: string, conclusion: string, outcome: ResearchTrajectory['outcome']): string {
    const traj = this.trajectories.get(trajectoryId);
    if (!traj) return `Trajectory "${trajectoryId}" not found.`;

    traj.conclusion = conclusion;
    traj.outcome = outcome;
    traj.quality_score = this.calculateQualityScore(traj);

    this.saveData();
    return `Trajectory "${trajectoryId}" concluded.\n  Outcome: ${outcome}\n  Quality: ${traj.quality_score.toFixed(2)}\n  Conclusion: ${conclusion}`;
  }

  public getTrajectory(trajectoryId: string): string {
    const traj = this.trajectories.get(trajectoryId);
    if (!traj) return `Trajectory "${trajectoryId}" not found.`;

    const lines: string[] = [
      `Trajectory: ${traj.id}`,
      `  Task: ${traj.task}`,
      `  Method: ${traj.method}`,
      `  Hypothesis: ${traj.hypothesis || 'not defined'}`,
      `  Outcome: ${traj.outcome}`,
      `  Quality: ${traj.quality_score.toFixed(2)}`,
      `  Steps: ${traj.steps.length}`,
      `  Evidence: ${traj.evidence.length}`,
      `  Citations: ${traj.citations.length}`,
    ];

    if (traj.steps.length > 0) {
      lines.push('', 'Steps:');
      for (const step of traj.steps) {
        const icon = step.success ? '✅' : '❌';
        lines.push(`  ${icon} #${step.step_number}: ${step.action} [${step.tool_used}] ${step.duration_ms}ms`);
        lines.push(`     ${step.result_summary.slice(0, 100)}`);
      }
    }

    if (traj.conclusion) {
      lines.push('', `Conclusion: ${traj.conclusion}`);
    }

    return lines.join('\n');
  }

  public listTrajectories(options?: { session_id?: string; outcome?: string }): string {
    let trajs = Array.from(this.trajectories.values());

    if (options?.session_id) {
      trajs = trajs.filter((t) => t.session_id === options.session_id);
    }
    if (options?.outcome) {
      trajs = trajs.filter((t) => t.outcome === options.outcome);
    }

    if (trajs.length === 0) return 'No research trajectories found.';

    const lines: string[] = [`Research trajectories (${trajs.length}):`];
    for (const t of trajs) {
      const outcomeIcon = { confirmed: '✅', refuted: '❌', inconclusive: '❓', partial: '⚠️' }[t.outcome];
      lines.push(`  ${outcomeIcon} [${t.id}] ${t.task.slice(0, 60)} | ${t.steps.length} steps | q:${t.quality_score.toFixed(2)}`);
    }
    return lines.join('\n');
  }

  public createReport(input: {
    title: string;
    trajectory_ids?: string[];
    findings: string[];
    methodology: string;
    conclusions: string[];
    confidence?: number;
  }): string {
    const id = `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const validIds = (input.trajectory_ids || []).filter((id) => this.trajectories.has(id));
    const trajs = validIds.map((id) => this.trajectories.get(id)!);
    const avgQuality = trajs.length > 0
      ? trajs.reduce((sum, t) => sum + t.quality_score, 0) / trajs.length
      : (input.confidence ?? 0);

    const report: ResearchReport = {
      id,
      title: input.title,
      trajectories: validIds,
      findings: input.findings,
      methodology: input.methodology,
      conclusions: input.conclusions,
      confidence: avgQuality,
      created_at: new Date().toISOString(),
    };

    this.reports.set(id, report);
    this.saveData();

    return `research report created. ID: ${id}\n  Title: ${input.title}\n  Trajectories: ${validIds.length}\n  Confidence: ${avgQuality.toFixed(2)}`;
  }

  public getReport(reportId: string): string {
    const report = this.reports.get(reportId);
    if (!report) return `Report "${reportId}" not found.`;

    const lines: string[] = [
      `Report: ${report.id}`,
      `  Title: ${report.title}`,
      `  Confidence: ${report.confidence.toFixed(2)}`,
      `  Trajectories: ${report.trajectories.length}`,
      '',
      'Methodology:',
      `  ${report.methodology}`,
      '',
      'Findings:',
      ...report.findings.map((f) => `  - ${f}`),
      '',
      'Conclusions:',
      ...report.conclusions.map((c) => `  - ${c}`),
    ];

    return lines.join('\n');
  }

  public getStats(): string {
    const trajs = Array.from(this.trajectories.values());
    const byOutcome: Record<string, number> = {};
    for (const t of trajs) {
      byOutcome[t.outcome] = (byOutcome[t.outcome] || 0) + 1;
    }

    const avgSteps = trajs.length > 0 ? trajs.reduce((sum, t) => sum + t.steps.length, 0) / trajs.length : 0;
    const avgQuality = trajs.length > 0 ? trajs.reduce((sum, t) => sum + t.quality_score, 0) / trajs.length : 0;

    const lines: string[] = [
      'Research Statistics:',
      `  Trajectories: ${trajs.length}`,
      `  Reports: ${this.reports.size}`,
      `  Average steps: ${avgSteps.toFixed(1)}`,
      `  Average quality: ${avgQuality.toFixed(2)}`,
      '',
      'By Outcome:',
      ...Object.entries(byOutcome).map(([outcome, count]) => `  ${outcome}: ${count}`),
    ];

    return lines.join('\n');
  }

  public exportForTraining(format: 'alpaca' | 'sharegpt' | 'jsonl' = 'jsonl'): string {
    const trajs = Array.from(this.trajectories.values());

    switch (format) {
      case 'alpaca': {
        const data = trajs.map((t) => ({
          instruction: t.task,
          input: t.hypothesis || '',
          output: t.conclusion,
        }));
        return JSON.stringify(data, null, 2);
      }
      case 'sharegpt': {
        const data = trajs.map((t) => ({
          conversations: [
            { from: 'human', value: t.task },
            { from: 'gpt', value: t.conclusion },
          ],
        }));
        return JSON.stringify(data, null, 2);
      }
      case 'jsonl':
      default: {
        return trajs.map((t) => JSON.stringify({
          task: t.task,
          method: t.method,
          steps: t.steps.length,
          outcome: t.outcome,
          conclusion: t.conclusion,
          quality: t.quality_score,
        })).join('\n');
      }
    }
  }

  private calculateQualityScore(traj: ResearchTrajectory): number {
    let score = 0;

    if (traj.steps.length > 0) score += 0.2;
    if (traj.steps.length >= 3) score += 0.1;
    if (traj.evidence.length > 0) score += 0.2;
    if (traj.evidence.length >= 3) score += 0.1;
    if (traj.citations.length > 0) score += 0.1;
    if (traj.conclusion.length > 0) score += 0.2;
    if (traj.hypothesis) score += 0.1;

    const successRate = traj.steps.length > 0
      ? traj.steps.filter((s) => s.success).length / traj.steps.length
      : 0;
    score += successRate * 0.1;

    return Math.min(1, score);
  }
}
