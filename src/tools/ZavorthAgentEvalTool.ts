import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { AgentSmartnessService } from '../services/agent-smartness/AgentSmartnessService.js';

export interface EvalTask {
  id: string;
  name: string;
  description: string;
  input: string;
  expected_output: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface EvalResult {
  task_id: string;
  task_name: string;
  actual_output: string;
  expected_output: string;
  score: number;
  pass: boolean;
  duration_ms: number;
  notes: string;
}

export interface EvalReport {
  id: string;
  name: string;
  /** Public honesty: this tool is not a live LLM IQ bench. */
  simulated: true;
  claimsLiveIntelligence: false;
  liveLlmEval: false;
  mode: 'hermetic-unit-scoreboard';
  total_tasks: number;
  passed: number;
  failed: number;
  avg_score: number;
  avg_duration_ms: number;
  results: EvalResult[];
  created_at: string;
}

export class ZavorthAgentEvalTool extends BaseTool {
  public readonly name = 'zavorth_agent_eval';

  public readonly description =
    'Agent Evaluation (honesty: not live LLM IQ) — hermetic unit smartness scoreboard, list/add tasks, compare reports. Free-form coding/reasoning categories are refused; use agent:smartness:live for credentialed live probes.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'run', 'list_tasks', 'add_task', 'report', 'compare', 'export', 'import_tasks'.",
      },
      eval_name: {
        type: 'string',
        description: 'Name for the evaluation run.',
      },
      category: {
        type: 'string',
        description: "Category filter: 'coding', 'reasoning', 'research', 'creative', 'tool_use', 'safety'.",
      },
      difficulty: {
        type: 'string',
        description: "Difficulty filter: 'easy', 'medium', 'hard'.",
      },
      report_id: {
        type: 'string',
        description: 'Report ID for comparison or export.',
      },
      tasks_json: {
        type: 'string',
        description: 'JSON array of tasks to import.',
      },
      max_tasks: {
        type: 'number',
        description: 'Maximum tasks to run. Default: 10.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private tasks: EvalTask[] = [];
  private reports: EvalReport[] = [];

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'agent-eval');
    this.ensureDir();
    this.initDefaultTasks();
    this.loadReports();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initDefaultTasks(): void {
    this.tasks = [
      { id: 'EVAL-001', name: 'Hello World Python', description: 'Write a Python hello world script', input: 'Write a Python script that prints Hello World', expected_output: 'print("Hello World")', category: 'coding', difficulty: 'easy' },
      { id: 'EVAL-002', name: 'Fibonacci Function', description: 'Implement fibonacci in TypeScript', input: 'Write a TypeScript function that returns the nth fibonacci number', expected_output: 'function fibonacci(n: number): number', category: 'coding', difficulty: 'easy' },
      { id: 'EVAL-003', name: 'SQL Query', description: 'Write a SQL query for top customers', input: 'Write a SQL query to find the top 10 customers by total orders', expected_output: 'SELECT', category: 'coding', difficulty: 'medium' },
      { id: 'EVAL-004', name: 'Summarize Article', description: 'Summarize a long article', input: 'Summarize the following article in 3 bullet points: [article text]', expected_output: '•', category: 'research', difficulty: 'medium' },
      { id: 'EVAL-005', name: 'Math Problem', description: 'Solve a math word problem', input: 'If a train travels 120km in 2 hours, what is its average speed?', expected_output: '60', category: 'reasoning', difficulty: 'easy' },
      { id: 'EVAL-006', name: 'Code Review', description: 'Review code for bugs', input: 'Review this code for bugs: function add(a,b) { return a - b; }', expected_output: 'subtract', category: 'coding', difficulty: 'easy' },
      { id: 'EVAL-007', name: 'API Design', description: 'Design a REST API', input: 'Design a REST API for a todo app with CRUD operations', expected_output: 'GET /todos', category: 'coding', difficulty: 'medium' },
      { id: 'EVAL-008', name: 'Data Analysis', description: 'Analyze CSV data', input: 'Given this CSV data, find the average and median: 1,2,3,4,5,6,7,8,9,10', expected_output: '5.5', category: 'reasoning', difficulty: 'medium' },
      { id: 'EVAL-009', name: 'Creative Story', description: 'Write a short story', input: 'Write a 3-sentence story about a robot learning to paint', expected_output: 'robot', category: 'creative', difficulty: 'medium' },
      { id: 'EVAL-010', name: 'Security Check', description: 'Identify security issues', input: 'What security issues exist in this code: query = "SELECT * FROM users WHERE id=" + userId', expected_output: 'injection', category: 'safety', difficulty: 'easy' },
      { id: 'EVAL-011', name: 'Regex Pattern', description: 'Write a regex pattern', input: 'Write a regex to validate an email address', expected_output: '@', category: 'coding', difficulty: 'medium' },
      { id: 'EVAL-012', name: 'Docker Compose', description: 'Write docker-compose.yml', input: 'Write a docker-compose.yml for a Node.js app with PostgreSQL', expected_output: 'services:', category: 'coding', difficulty: 'medium' },
      { id: 'EVAL-013', name: 'Git Commands', description: 'Git workflow commands', input: 'What git commands do I use to create a branch, make changes, and merge back?', expected_output: 'git checkout', category: 'tool_use', difficulty: 'easy' },
      { id: 'EVAL-014', name: 'Error Handling', description: 'Add error handling to code', input: 'Add error handling to this code: fetch("https://api.example.com/data")', expected_output: 'try', category: 'coding', difficulty: 'medium' },
      { id: 'EVAL-015', name: 'Performance Optimize', description: 'Optimize slow code', input: 'How would you optimize this O(n²) algorithm?', expected_output: 'O(n', category: 'reasoning', difficulty: 'hard' },
      { id: 'EVAL-016', name: 'Architecture Decision', description: 'Choose architecture', input: 'Should I use microservices or monolith for a small startup with 5 developers?', expected_output: 'monolith', category: 'reasoning', difficulty: 'medium' },
      { id: 'EVAL-017', name: 'Translate Code', description: 'Translate code between languages', input: 'Translate this Python code to TypeScript: def hello(): print("hi")', expected_output: 'function hello', category: 'coding', difficulty: 'easy' },
      { id: 'EVAL-018', name: 'Explain Concept', description: 'Explain a technical concept', input: 'Explain what a REST API is in simple terms', expected_output: 'HTTP', category: 'research', difficulty: 'easy' },
      { id: 'EVAL-019', name: 'Debug Code', description: 'Debug failing code', input: 'Why does this fail? console.log(undefined.property)', expected_output: 'TypeError', category: 'coding', difficulty: 'easy' },
      { id: 'EVAL-020', name: 'Test Writing', description: 'Write unit tests', input: 'Write Jest tests for a function that adds two numbers', expected_output: 'expect', category: 'coding', difficulty: 'medium' },
    ];
  }

  private loadReports(): void {
    const reportsPath = path.join(this.storageDir, 'reports.json');
    if (!fs.existsSync(reportsPath)) return;
    try {
      this.reports = JSON.parse(fs.readFileSync(reportsPath, 'utf-8'));
    } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Agent Eval] JSON parse failed', error); }
  }

  private saveReports(): void {
    fs.writeFileSync(
      path.join(this.storageDir, 'reports.json'),
      JSON.stringify(this.reports, null, 2),
      'utf-8',
    );
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'run': return await this.runEval(args);
      case 'list_tasks': return this.listTasks(args);
      case 'add_task': return this.addTask(args);
      case 'report': return this.getReport(args);
      case 'compare': return this.compareReports(args);
      case 'export': return this.exportReport(args);
      case 'import_tasks': return this.importTasks(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runEval(args: Record<string, unknown>): Promise<string> {
    const evalName = String(args.eval_name || `eval_${Date.now()}`);
    const category = typeof args.category === 'string' ? args.category.toLowerCase() : 'smartness';
    const startTime = Date.now();

    if (category === 'coding' || category === 'reasoning' || category === 'research' || category === 'creative') {
      return [
        'Error: free-form LLM category evals are not simulated.',
        'Use category "smartness" (default) for the hermetic agent quality scoreboard,',
        'or provide a live credentialed eval harness outside this tool.',
      ].join('\n');
    }

    const smartness = await new AgentSmartnessService().run();
    const results: EvalResult[] = smartness.results.map((entry) => ({
      task_id: entry.id,
      task_name: entry.name,
      actual_output: entry.notes,
      expected_output: 'pass',
      score: entry.score,
      pass: entry.pass,
      duration_ms: entry.durationMs,
      notes: entry.pass ? 'Pass' : entry.notes,
    }));

    const report: EvalReport = {
      id: `report_${Date.now()}`,
      name: evalName,
      simulated: true,
      claimsLiveIntelligence: false,
      liveLlmEval: false,
      mode: 'hermetic-unit-scoreboard',
      total_tasks: results.length,
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      avg_score: results.length ? results.reduce((sum, row) => sum + row.score, 0) / results.length : 0,
      avg_duration_ms: results.length ? (Date.now() - startTime) / results.length : 0,
      results,
      created_at: new Date().toISOString(),
    };

    this.reports.push(report);
    this.saveReports();

    return [
      `Evaluation "${evalName}" completed.`,
      '  Honesty: simulated=true | liveLlmEval=false | claimsLiveIntelligence=false',
      '  Mode: hermetic-unit-scoreboard (not a live LLM intelligence claim)',
      '  Live IQ: npm run agent:smartness:live (requires provider credentials)',
      `  Total: ${report.total_tasks}`,
      `  Passed: ${report.passed}`,
      `  Failed: ${report.failed}`,
      `  Avg score: ${(report.avg_score * 100).toFixed(1)}%`,
      `  Mission success rate: ${Math.round(smartness.missionSuccessRate * 100)}%`,
      `  Report ID: ${report.id}`,
    ].join('\n');
  }

  private scoreOutput(actual: string, expected: string): number {
    const actualLower = actual.toLowerCase();
    const expectedLower = expected.toLowerCase();

    if (actualLower.includes(expectedLower)) return 1.0;

    const expectedWords = expectedLower.split(/\s+/);
    const matchedWords = expectedWords.filter((w) => actualLower.includes(w));
    return matchedWords.length / Math.max(1, expectedWords.length);
  }

  private listTasks(args: Record<string, unknown>): string {
    const category = typeof args.category === 'string' ? args.category : undefined;
    let tasks = [...this.tasks];
    if (category) tasks = tasks.filter((t) => t.category === category);

    const lines: string[] = [`Eval Tasks (${tasks.length}):`];
    for (const t of tasks) {
      const diff = { easy: '🟢', medium: '🟡', hard: '🔴' }[t.difficulty];
      lines.push(`  ${diff} ${t.id}: ${t.name} [${t.category}]`);
    }
    return lines.join('\n');
  }

  private addTask(args: Record<string, unknown>): string {
    const name = String(args.name || '');
    if (!name) return 'Error: "name" is required.';

    const id = `EVAL-${String(this.tasks.length + 1).padStart(3, '0')}`;
    this.tasks.push({
      id,
      name,
      description: String(args.description || ''),
      input: String(args.input || ''),
      expected_output: String(args.expected_output || ''),
      category: String(args.category || 'general'),
      difficulty: (String(args.difficulty || 'medium')) as EvalTask['difficulty'],
    });

    return `Task "${name}" added with ID ${id}.`;
  }

  private getReport(args: Record<string, unknown>): string {
    const reportId = String(args.report_id || '');
    if (!reportId) {
      if (this.reports.length === 0) return 'No evaluation reports.';
      const latest = this.reports[this.reports.length - 1];
      return this.formatReport(this.normalizeReport(latest));
    }

    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return `Error: report "${reportId}" not found.`;
    return this.formatReport(this.normalizeReport(report));
  }

  private normalizeReport(report: EvalReport): EvalReport {
    return {
      ...report,
      simulated: true,
      claimsLiveIntelligence: false,
      liveLlmEval: false,
      mode: report.mode || 'hermetic-unit-scoreboard',
    };
  }

  private formatReport(report: EvalReport): string {
    const honest = this.normalizeReport(report);
    const lines: string[] = [
      `Evaluation Report: ${honest.name}`,
      `  ID: ${honest.id}`,
      `  Date: ${honest.created_at}`,
      '  Honesty: simulated=true | liveLlmEval=false | claimsLiveIntelligence=false',
      `  Mode: ${honest.mode}`,
      `  Total: ${honest.total_tasks}`,
      `  Passed: ${honest.passed}`,
      `  Failed: ${honest.failed}`,
      `  Score: ${(honest.avg_score * 100).toFixed(1)}%`,
      `  Avg duration: ${honest.avg_duration_ms.toFixed(0)}ms`,
      '',
      'Results:',
    ];

    for (const r of honest.results) {
      const icon = r.pass ? '✅' : '❌';
      lines.push(`  ${icon} ${r.task_name}: ${(r.score * 100).toFixed(0)}% (${r.duration_ms}ms)`);
    }

    return lines.join('\n');
  }

  private compareReports(args: Record<string, unknown>): string {
    if (this.reports.length < 2) return 'Need at least 2 reports to compare.';

    const latest = this.normalizeReport(this.reports[this.reports.length - 1]);
    const previous = this.normalizeReport(this.reports[this.reports.length - 2]);

    const scoreDiff = latest.avg_score - previous.avg_score;
    const passDiff = latest.passed - previous.passed;

    return [
      'Report Comparison:',
      '  Honesty: simulated=true | liveLlmEval=false | claimsLiveIntelligence=false',
      `  ${previous.name}: ${(previous.avg_score * 100).toFixed(1)}% (${previous.passed}/${previous.total_tasks} passed)`,
      `  ${latest.name}: ${(latest.avg_score * 100).toFixed(1)}% (${latest.passed}/${latest.total_tasks} passed)`,
      `  Score delta: ${scoreDiff > 0 ? '+' : ''}${(scoreDiff * 100).toFixed(1)}%`,
      `  Pass delta: ${passDiff > 0 ? '+' : ''}${passDiff}`,
      `  Verdict: ${scoreDiff > 0 ? '✅ Improved' : scoreDiff < 0 ? '❌ Regressed' : '➡️ No change'}`,
    ].join('\n');
  }

  private exportReport(args: Record<string, unknown>): string {
    const reportId = String(args.report_id || '');
    const report = reportId
      ? this.reports.find((r) => r.id === reportId)
      : this.reports[this.reports.length - 1];

    if (!report) return 'Error: no report to export.';

    const honest = this.normalizeReport(report);
    const outputPath = path.join(this.storageDir, `${honest.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(honest, null, 2), 'utf-8');
    return [
      `Report exported to ${outputPath}`,
      'Honesty: simulated=true | liveLlmEval=false | claimsLiveIntelligence=false',
    ].join('\n');
  }

  private importTasks(args: Record<string, unknown>): string {
    const tasksJson = String(args.tasks_json || '');
    if (!tasksJson) return 'Error: "tasks_json" is required.';

    let imported: EvalTask[];
    try { imported = JSON.parse(tasksJson); } catch (error: unknown) {logger.warn('[Zavorth Agent Eval] JSON parse failed', error); return 'Error: invalid JSON.'; }

    let count = 0;
    for (const task of imported) {
      if (task.name && task.input && task.expected_output) {
        task.id = task.id || `EVAL-${String(this.tasks.length + 1).padStart(3, '0')}`;
        this.tasks.push(task);
        count++;
      }
    }

    return `Imported ${count} tasks.`;
  }
}
