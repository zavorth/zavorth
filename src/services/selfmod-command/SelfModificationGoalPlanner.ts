import fs from 'fs';
import path from 'path';
import type { ChatMessage, ILlmProvider } from '../../providers/ILlmProvider.js';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_TOP_LEVEL_DIRS,
  type GoalPlannerResponse,
  type GoalPlannerResult,
} from './SelfModificationCommandTypes.js';
import {
  extractSelfModificationPathFromGoal,
  tryParseSelfModificationJson,
} from './SelfModificationCommandUtils.js';

type SelfModificationGoalPlannerOptions = {
  projectRoot: string;
  getProvider: () => ILlmProvider;
  toRelativePath: (targetPath: string) => string;
};

export class SelfModificationGoalPlanner {
  private readonly projectRoot: string;
  private readonly getProvider: () => ILlmProvider;
  private readonly toRelativePath: (targetPath: string) => string;

  constructor(options: SelfModificationGoalPlannerOptions) {
    this.projectRoot = options.projectRoot;
    this.getProvider = options.getProvider;
    this.toRelativePath = options.toRelativePath;
  }

  public async planGoalChanges(goal: string): Promise<GoalPlannerResult> {
    const messages = this.buildGoalPlannerMessages(goal);
    const response = await this.getProvider().chat(messages);
    const parsed = tryParseSelfModificationJson(
      String(response.content || '').trim(),
    ) as GoalPlannerResponse | null;
    const heuristicPath = this.extractPathFromGoal(goal);

    const changes =
      Array.isArray(parsed?.changes) && parsed?.changes.length > 0
        ? parsed.changes
            .map((change) => ({
              filePath: String(change.filePath || '').trim(),
              instruction: String(change.instruction || '').trim(),
            }))
            .filter((change) => change.filePath && change.instruction)
        : heuristicPath
          ? [{ filePath: heuristicPath, instruction: goal }]
          : [];

    return {
      summary:
        String(parsed?.summary || '').trim() ||
        `Changeset planejado para o objetivo: ${goal}`,
      validationPlan:
        Array.isArray(parsed?.validationPlan) && parsed.validationPlan.length > 0
          ? parsed.validationPlan.map((entry) => String(entry).trim()).filter(Boolean)
          : [
              'validate sintaxe por file alterado.',
              'run build local do projeto.',
              'run tests related to the changed domain.',
            ],
      resourceImpact: {
        ramIdleMb: Number(parsed?.resourceImpact?.ramIdleMb || 64),
        diskMb: Number(parsed?.resourceImpact?.diskMb || 32),
        processCount: Number(parsed?.resourceImpact?.processCount || 0),
        notes: String(
          parsed?.resourceImpact?.notes || 'Changeset em preview, without sidecars adicionais.',
        ).trim(),
      },
      changes,
    };
  }

  public buildGoalPlannerMessages(goal: string): ChatMessage[] {
    const candidateFiles = this.collectCandidateFiles().slice(0, 120);
    return [
      {
        role: 'system',
        content: [
          'You planeja changesets seguros para o Zavorth.',
          'Return only valid JSON.',
          'At most 6 changes per response.',
          'Each change must contain a relative filePath and an objective instruction.',
          'Use only caminhos relactives dentro de src/, tests/, config/ ou scripts/.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Objetivo: ${goal}`,
          '',
          'Candidate files:',
          candidateFiles.join('\n'),
          '',
          'Retorne JSON neste formato:',
          '{',
          '  "summary": "short plan summary",',
          '  "validationPlan": ["passo 1", "passo 2"],',
          '  "resourceImpact": {',
          '    "ramIdleMb": 64,',
          '    "diskMb": 32,',
          '    "processCount": 0,',
          '    "notes": "impacto previsto"',
          '  },',
          '  "changes": [',
          '    { "filePath": "src/exemplo.ts", "instruction": "instrucao concreta" }',
          '  ]',
          '}',
        ].join('\n'),
      },
    ];
  }

  public collectCandidateFiles(): string[] {
    const results: string[] = [];
    for (const dir of ALLOWED_TOP_LEVEL_DIRS) {
      const absoluteDir = path.join(this.projectRoot, dir);
      this.walkCandidateFiles(absoluteDir, results);
    }
    return results.map((entry) => this.toRelativePath(entry)).sort();
  }

  public walkCandidateFiles(currentDir: string, results: string[]): void {
    if (!fs.existsSync(currentDir)) {
      return;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        this.walkCandidateFiles(absolutePath, results);
        continue;
      }
      if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      results.push(absolutePath);
    }
  }

  public extractPathFromGoal(goal: string): string | null {
    return extractSelfModificationPathFromGoal(goal);
  }
}
