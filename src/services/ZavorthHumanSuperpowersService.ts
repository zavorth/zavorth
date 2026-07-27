import fs from 'node:fs';
import path from 'node:path';
import { ZavorthLearningRuntimeHubService } from './ZavorthLearningRuntimeHubService.js';
import { resolveLearningRuntimePolicy } from './ZavorthLearningRuntimePolicy.js';

export type SuperpowerTrust = 'always-available' | 'learned' | 'needs-setup' | 'experimental';

export type HumanSuperpower = {
  id: string;
  title: string;
  summary: string;
  howToAsk: string;
  examples: string[];
  trust: SuperpowerTrust;
  trustLabel: string;
  category: 'conversation' | 'memory' | 'files' | 'web' | 'automation' | 'channels' | 'learned';
  ready: boolean;
  nextStep: string | null;
};

export type HumanSuperpowersSnapshot = {
  contractVersion: 'zavorth-human-superpowers/1';
  generatedAt: string;
  headline: string;
  summary: string;
  powers: HumanSuperpower[];
  readyCount: number;
  needsSetupCount: number;
  learnedCount: number;
  promptBlock: string;
  digestLines: string[];
};

type ServiceDeps = {
  projectRoot?: string | null;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  userId?: string | null;
};

const TRUST_LABELS: Record<SuperpowerTrust, string> = {
  'always-available': 'Available now',
  learned: 'Learned from the operator with undo available',
  'needs-setup': 'Needs simple setup',
  experimental: 'Experimental — use com cuidado',
};

export class ZavorthHumanSuperpowersService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly userId: string | null;

  public constructor(deps: ServiceDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.userId = deps.userId || null;
  }

  public buildSnapshot(): HumanSuperpowersSnapshot {
    const powers = this.listPowers();
    const readyCount = powers.filter((p) => p.ready).length;
    const needsSetupCount = powers.filter((p) => !p.ready && p.trust === 'needs-setup').length;
    const learnedCount = powers.filter((p) => p.trust === 'learned').length;
    return {
      contractVersion: 'zavorth-human-superpowers/1',
      generatedAt: this.now().toISOString(),
      headline: 'What I can do for you',
      summary: `${readyCount} ready · ${learnedCount} learneds · ${needsSetupCount} need setup.`,
      powers,
      readyCount,
      needsSetupCount,
      learnedCount,
      promptBlock: this.formatPromptBlock(powers),
      digestLines: this.formatDigestLines(powers),
    };
  }

  public listPowers(options: { includeLearned?: boolean } = {}): HumanSuperpower[] {
    const env = this.env;
    const includeLearned = options.includeLearned !== false;
    const telegramReady = Boolean(String(env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || '').trim());
    const waCloudReady = Boolean(
      String(env.WHATSAPP_ACCESS_TOKEN || '').trim()
      && String(env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    );
    const providerReady = Boolean(
      String(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.OPENROUTER_API_KEY || '').trim(),
    );
    const learning = resolveLearningRuntimePolicy({
      projectRoot: this.projectRoot,
      env,
      userId: this.userId,
    });

    const core: HumanSuperpower[] = [
      {
        id: 'chat-help',
        title: 'Chat and get help',
        summary: 'Ask in natural language. I answer and help where I can.',
        howToAsk: 'Speak as you would with a person.',
        examples: ['Explain this in 5 lines', 'Help me decide X'],
        trust: 'always-available',
        trustLabel: TRUST_LABELS['always-available'],
        category: 'conversation',
        ready: true,
        nextStep: null,
      },
      {
        id: 'remember-prefs',
        title: 'Remember your preferences',
        summary: learning.mode === 'autonomous'
          ? 'Learning is on: useful preferences can be saved with undo.'
          : 'Learning is reviewed: nothing is saved without permission.',
        howToAsk: 'State preferences in natural language.',
        examples: ['I prefer short answers', 'Always use lists'],
        trust: learning.mode === 'autonomous' ? 'always-available' : 'needs-setup',
        trustLabel: learning.mode === 'autonomous'
          ? TRUST_LABELS['always-available']
          : TRUST_LABELS['needs-setup'],
        category: 'memory',
        ready: learning.mode === 'autonomous',
        nextStep: learning.mode === 'autonomous' ? null : 'Enable personal learning in setup.',
      },
      {
        id: 'files-safe',
        title: 'Files with care',
        summary: 'Reads and organizes files. Sensitive changes require confirmation.',
        howToAsk: 'Ask to read, summarize, or organize a file or folder.',
        examples: ['Summarize this file', 'List what is in this folder'],
        trust: 'always-available',
        trustLabel: TRUST_LABELS['always-available'],
        category: 'files',
        ready: true,
        nextStep: null,
      },
      {
        id: 'web-lookup',
        title: 'Search the web',
        summary: providerReady
          ? 'Searches and summarizes current information when useful.'
          : 'Needs a configured model provider for high-quality search.',
        howToAsk: 'Ask for a focused search.',
        examples: ['Search X and give me the essentials', 'What changed about Y?'],
        trust: providerReady ? 'always-available' : 'needs-setup',
        trustLabel: providerReady ? TRUST_LABELS['always-available'] : TRUST_LABELS['needs-setup'],
        category: 'web',
        ready: providerReady,
        nextStep: providerReady ? null : 'Configure a model provider key.',
      },
      {
        id: 'routines',
        title: 'Repeated routines',
        summary: 'Repeated flows can become skill drafts for next time.',
        howToAsk: 'Ask for the same routine a few times; I record the pattern.',
        examples: ['Remind me about X every day', 'When I ask for release notes, use this style'],
        trust: 'always-available',
        trustLabel: TRUST_LABELS['always-available'],
        category: 'automation',
        ready: true,
        nextStep: null,
      },
      {
        id: 'telegram',
        title: 'Use Telegram',
        summary: telegramReady
          ? 'Telegram configurado — bom caminho para o dia a dia no celular.'
          : 'Telegram is the recommended stable mobile channel.',
        howToAsk: 'Message the bot after configuring the token.',
        examples: ['Send me a summary on Telegram', 'Remember this when I message on Telegram'],
        trust: telegramReady ? 'always-available' : 'needs-setup',
        trustLabel: telegramReady ? TRUST_LABELS['always-available'] : TRUST_LABELS['needs-setup'],
        category: 'channels',
        ready: telegramReady,
        nextStep: telegramReady ? null : 'Set TELEGRAM_BOT_TOKEN.',
      },
      {
        id: 'whatsapp-cloud',
        title: 'Official WhatsApp',
        summary: waCloudReady
          ? 'WhatsApp Cloud API configured as the stable path.'
          : 'Official WhatsApp via Cloud API — caminho de producao. Baileys e experimental.',
        howToAsk: 'Use the configured WhatsApp Business number.',
        examples: ['Reply on WhatsApp', 'Notify me on WhatsApp'],
        trust: waCloudReady ? 'always-available' : 'needs-setup',
        trustLabel: waCloudReady ? TRUST_LABELS['always-available'] : TRUST_LABELS['needs-setup'],
        category: 'channels',
        ready: waCloudReady,
        nextStep: waCloudReady ? null : 'WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (opcional).',
      },
    ];

    const learned = includeLearned ? this.learnedPowers() : [];
    return [...core, ...learned, ...this.librarySkillPowers()].slice(0, 40);
  }

  public findByNeed(text: string): HumanSuperpower[] {
    const q = String(text || '').toLowerCase();
    if (!q.trim()) return this.listPowers().filter((p) => p.ready).slice(0, 6);
    return this.listPowers()
      .map((power) => ({
        power,
        score: scorePower(power, q),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.power)
      .slice(0, 8);
  }

  /**
   * Free-text NLU packs removed (agent-first: free text → agent).
   * Use explicit slash/API intents instead.
   */
  public matchNaturalCommand(_text: string): null | { kind: 'list' | 'help-with'; query?: string } {
    return null;
  }

  public formatDigestLines(powers?: HumanSuperpower[]): string[] {
    const list = powers || this.listPowers();
    const lines = ['What I can do:'];
    for (const power of list.slice(0, 12)) {
      const mark = power.ready ? '✓' : '○';
      lines.push(`${mark} ${power.title} — ${power.trustLabel}`);
      lines.push(`  How to ask: ${power.howToAsk}`);
    }
    lines.push('Ask naturally. e.g. "help me with files" or "what can you do?"');
    return lines;
  }

  public formatPromptBlock(
    powers?: HumanSuperpower[],
    options: { includeLearned?: boolean } = {},
  ): string {
    const includeLearned = options.includeLearned !== false;
    const source = powers || this.listPowers({ includeLearned });
    const list = source
      .filter((p) => p.ready)
      .filter((p) => includeLearned || p.category !== 'learned')
      .slice(0, 10);
    if (!list.length) return '';
    return [
      'Human superpowers available in this product (guide the user in plain language):',
      ...list.map((p) => `- ${p.title}: ${p.summary} Example ask: "${p.examples[0] || p.howToAsk}"`),
      'Prefer these everyday capabilities over inventing unsupported features.',
      ...(includeLearned ? [] : ['Learned preferences are supplied only via the separate untrusted learned_preferences block.']),
    ].join('\n');
  }

  private learnedPowers(): HumanSuperpower[] {
    try {
      const hub = new ZavorthLearningRuntimeHubService({ projectRoot: this.projectRoot, env: this.env, userId: this.userId });
      return hub.listLearned()
        .filter((item) => item.kind === 'skill-draft' || item.kind === 'preference')
        .slice(0, 8)
        .map((item) => ({
          id: `learned:${item.id}`,
          title: item.kind === 'preference' ? `Your preference: ${shortTitle(item.summary)}` : item.title,
          summary: item.summary,
          howToAsk: item.kind === 'preference'
            ? 'Continue conversationndo; eu ja levo isso em conta.'
            : 'Peca a rotina parecida; o rascunho guia a proxima vez.',
          examples: [item.summary.slice(0, 80)],
          trust: 'learned' as const,
          trustLabel: TRUST_LABELS.learned,
          category: 'learned' as const,
          ready: true,
          nextStep: `To undo: say "undo learning ${item.id}"`,
        }));
    } catch {
      return [];
    }
  }

  private librarySkillPowers(): HumanSuperpower[] {
    const roots = [
      path.join(this.projectRoot, 'skill-library'),
      path.join(this.projectRoot, 'skills'),
    ];
    const powers: HumanSuperpower[] = [];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .slice(0, 8);
        for (const entry of entries) {
          const skillMd = path.join(root, entry.name, 'SKILL.md');
          const title = entry.name.replace(/[-_]/g, ' ');
          let summary = `Habilidade instalada: ${title}`;
          if (fs.existsSync(skillMd)) {
            try {
              const body = fs.readFileSync(skillMd, 'utf8');
              const line = body.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('---'));
              if (line) summary = line.slice(0, 160);
            } catch {
              // keep default
            }
          }
          powers.push({
            id: `library:${entry.name}`,
            title: humanize(title),
            summary,
            howToAsk: `Peca algo relacionado a "${humanize(title)}".`,
            examples: [`Use a habilidade ${humanize(title)}`],
            trust: 'always-available',
            trustLabel: TRUST_LABELS['always-available'],
            category: 'automation',
            ready: true,
            nextStep: null,
          });
        }
      } catch {
        // skip unreadable roots
      }
    }
    return powers;
  }
}

function shortTitle(text: string): string {
  const value = String(text || '').trim();
  return value.length > 48 ? `${value.slice(0, 45)}...` : value || 'preferencia';
}

function humanize(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
function tokenizeSearchText(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const char of String(value || '')) {
    if (/[\p{L}\p{N}]/u.test(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = '';
    }
  }
  if (current) tokens.push(current);
  return tokens;
}


function scorePower(power: HumanSuperpower, query: string): number {
  const hay = `${power.id} ${power.title} ${power.summary} ${power.howToAsk} ${power.examples.join(' ')} ${power.category}`.toLowerCase();
  let score = 0;
  for (const token of tokenizeSearchText(query)) {
    if (hay.includes(token.toLowerCase())) score += 2;
  }
  if (power.ready) score += 1;
  if (power.category === 'learned') score += 1;
  return score;
}
