import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  ExperienceSkillLearningLoopService,
  type ExperienceSkillDraftSummary,
} from '../services/ExperienceSkillLearningLoopService.js';

const GOVERNED_PREFIX = 'Governed procedure only — does not execute tools.';
const MAX_OUTPUT_CHARS = 6000;

export type UseLearnedSkillToolOptions = {
  projectRoot?: string;
  userId?: string;
  /** Optional injected loop (tests). */
  loop?: ExperienceSkillLearningLoopService;
};

/**
 * Governed agent surface for experience-skill drafts/promoted procedures.
 * Loads guidance only — never executes tools from the skill body.
 */
export class UseLearnedSkillTool extends BaseTool {
  public readonly name = 'use_learned_skill';

  public readonly description =
    'Load a local experience-skill draft or promoted procedure by id/title query. Returns governed guidance only — does not execute tools. Use after multi-tool workflows were saved as drafts (zavorth learn / /learn).';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      skill_id: {
        type: 'string',
        description: 'Exact draft id (skill?...) when known.',
      },
      query: {
        type: 'string',
        description: 'Search title/tools when id unknown.',
      },
      user_id: {
        type: 'string',
        description: 'Optional user scope; default local-user.',
      },
      action: {
        type: 'string',
        description: 'run | show | search. Default run if skill_id, else search.',
      },
    },
    required: [],
  };

  private readonly projectRoot: string;
  private readonly defaultUserId: string | undefined;
  private readonly injectedLoop: ExperienceSkillLearningLoopService | null;

  public constructor(options?: UseLearnedSkillToolOptions) {
    super();
    this.projectRoot = String(options?.projectRoot || process.cwd());
    this.defaultUserId = options?.userId;
    this.injectedLoop = options?.loop || null;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const skillId = String(args.skill_id ?? '').trim();
    const query = String(args.query ?? '').trim();
    const actionRaw = String(args.action ?? '')
      .trim()
      .toLowerCase();
    const action = (actionRaw || (skillId ? 'run' : 'search')) as 'run' | 'show' | 'search' | string;

    const userId =
      String(args.user_id ?? '').trim() ||
      this.defaultUserId ||
      process.env.USER ||
      process.env.USERNAME ||
      'local-user';

    const loop = this.injectedLoop || new ExperienceSkillLearningLoopService({ projectRoot: this.projectRoot });

    try {
      // Search path: explicit search, or query without skill_id.
      if (action === 'search' || (query && !skillId)) {
        return this.cap(this.formatSearch(loop, userId, query || skillId));
      }

      if (!skillId) {
        return this.cap(
          [
            GOVERNED_PREFIX,
            'Provide skill_id to run/show a draft, or query to search drafts.',
            'Example: action=search query="release checklist"',
          ].join('\n'),
        );
      }

      if (action === 'show') {
        const shown = loop.showDraft(userId, skillId);
        if (!shown.ok) {
          return this.cap([GOVERNED_PREFIX, shown.text].join('\n'));
        }
        return this.cap([GOVERNED_PREFIX, '', shown.text].join('\n'));
      }

      // Default / run: governed procedure surface (does not execute tools).
      const run = loop.runSkill(userId, skillId);
      if (!run.ok) {
        return this.cap([GOVERNED_PREFIX, run.text].join('\n'));
      }
      // runSkill already includes a similar line; keep the canonical prefix first.
      const body = run.text.startsWith(GOVERNED_PREFIX) ? run.text : [GOVERNED_PREFIX, '', run.text].join('\n');
      return this.cap(body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || 'unknown error');
      return this.cap([GOVERNED_PREFIX, `Error loading learned skill: ${message}`].join('\n'));
    }
  }

  private formatSearch(loop: ExperienceSkillLearningLoopService, userId: string, query: string): string {
    const hits = this.searchDrafts(loop, userId, query);
    const lines: string[] = [
      GOVERNED_PREFIX,
      query ? `Search results for "${query}" (${hits.length}):` : `Draft list (${hits.length}):`,
      '',
    ];

    if (hits.length === 0) {
      lines.push('No matching experience-skill drafts found.');
      lines.push('Save multi-tool workflows via zavorth learn / /learn first.');
      return lines.join('\n');
    }

    hits.forEach((d, i) => {
      const tools = d.tools.slice(0, 8).join(', ') || 'n/a';
      const rev = d.revisions && d.revisions > 0 ? ` rev=${d.revisions}` : '';
      lines.push(`${i + 1}. ${d.title}`, `   id: ${d.id}`, `   tools: ${tools}; uses=${d.useCount}${rev}`);
      if (d.snippet) {
        lines.push(`   snippet: ${d.snippet}`);
      }
    });
    lines.push('');
    lines.push('Load procedure: action=run skill_id=<id> (guidance only; no tool execution).');
    return lines.join('\n');
  }

  private searchDrafts(
    loop: ExperienceSkillLearningLoopService,
    userId: string,
    query: string,
  ): ExperienceSkillDraftSummary[] {
    const anyLoop = loop as ExperienceSkillLearningLoopService & {
      searchDrafts?: (userId?: string | null, query?: string | null, limit?: number) => ExperienceSkillDraftSummary[];
    };
    if (typeof anyLoop.searchDrafts === 'function') {
      return anyLoop.searchDrafts(userId, query, 20);
    }
    // Fallback: local filter on listDrafts by title/tools/id.
    const q = String(query || '')
      .trim()
      .toLowerCase();
    const drafts = loop.listDrafts(userId, 100);
    if (!q) return drafts.slice(0, 20);
    return drafts
      .filter((d) => {
        const title = String(d.title || '').toLowerCase();
        const tools = (d.tools || []).map((t) => String(t).toLowerCase()).join(' ');
        const id = String(d.id || '').toLowerCase();
        return title.includes(q) || tools.includes(q) || id.includes(q);
      })
      .slice(0, 20);
  }

  private cap(text: string): string {
    const raw = String(text || '');
    if (raw.length <= MAX_OUTPUT_CHARS) return raw;
    return `${raw.slice(0, MAX_OUTPUT_CHARS - 20)}\n…[truncated]`;
  }
}
