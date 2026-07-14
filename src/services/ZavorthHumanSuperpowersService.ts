import fs from 'node:fs';
import path from 'node:path';
import { ZavorthLearningRuntimeHubService } from './ZavorthLearningRuntimeHubService.js';
import { resolveLearningRuntimePolicy } from './ZavorthLearningRuntimePolicy.js';

export type SuperpowerTrust = 'sempre-disponivel' | 'aprendido' | 'precisa-configurar' | 'experimental';

export type HumanSuperpower = {
  id: string;
  title: string;
  summary: string;
  howToAsk: string;
  examples: string[];
  trust: SuperpowerTrust;
  trustLabel: string;
  category: 'conversa' | 'memoria' | 'arquivos' | 'web' | 'automacao' | 'canais' | 'aprendido';
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
  'sempre-disponivel': 'Pode usar agora',
  aprendido: 'Aprendido com voce (da para desfazer)',
  'precisa-configurar': 'Falta uma configuracao simples',
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
    const needsSetupCount = powers.filter((p) => !p.ready && p.trust === 'precisa-configurar').length;
    const learnedCount = powers.filter((p) => p.trust === 'aprendido').length;
    return {
      contractVersion: 'zavorth-human-superpowers/1',
      generatedAt: this.now().toISOString(),
      headline: 'O que eu sei fazer por voce',
      summary: `${readyCount} prontos · ${learnedCount} aprendidos · ${needsSetupCount} pedem setup.`,
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
        title: 'Conversar e pedir ajuda',
        summary: 'Pergunte em linguagem normal. Eu respondo e ajudo no que der.',
        howToAsk: 'Fale como falaria com uma pessoa.',
        examples: ['Me explica isso em 5 linhas', 'Me ajuda a decidir X'],
        trust: 'sempre-disponivel',
        trustLabel: TRUST_LABELS['sempre-disponivel'],
        category: 'conversa',
        ready: true,
        nextStep: null,
      },
      {
        id: 'remember-prefs',
        title: 'Lembrar do seu jeito',
        summary: learning.mode === 'autonomous'
          ? 'Aprendizado ligado: gravo preferencias uteis com opcao de desfazer.'
          : 'Aprendizado em modo revisado: nao gravo sozinho ate voce permitir.',
        howToAsk: 'Diga preferencias: "prefiro respostas curtas em topicos".',
        examples: ['Prefiro respostas curtas', 'Sempre use listas'],
        trust: learning.mode === 'autonomous' ? 'sempre-disponivel' : 'precisa-configurar',
        trustLabel: learning.mode === 'autonomous'
          ? TRUST_LABELS['sempre-disponivel']
          : TRUST_LABELS['precisa-configurar'],
        category: 'memoria',
        ready: learning.mode === 'autonomous',
        nextStep: learning.mode === 'autonomous' ? null : 'Diga "sim" no setup ou ative aprendizado pessoal.',
      },
      {
        id: 'files-safe',
        title: 'Arquivos com cuidado',
        summary: 'Leio e organizo arquivos. Mudancas sensiveis pedem confirmacao.',
        howToAsk: 'Peca para ler, resumir ou organizar um arquivo/pasta.',
        examples: ['Resuma este arquivo', 'Liste o que tem nesta pasta'],
        trust: 'sempre-disponivel',
        trustLabel: TRUST_LABELS['sempre-disponivel'],
        category: 'arquivos',
        ready: true,
        nextStep: null,
      },
      {
        id: 'web-lookup',
        title: 'Buscar na web',
        summary: providerReady
          ? 'Pesquisa e resume informacoes atuais quando fizer sentido.'
          : 'Precisa de um provedor de modelo configurado para pesquisar bem.',
        howToAsk: 'Peca uma pesquisa objetiva.',
        examples: ['Pesquise X e me diga o essencial', 'O que mudou sobre Y?'],
        trust: providerReady ? 'sempre-disponivel' : 'precisa-configurar',
        trustLabel: providerReady ? TRUST_LABELS['sempre-disponivel'] : TRUST_LABELS['precisa-configurar'],
        category: 'web',
        ready: providerReady,
        nextStep: providerReady ? null : 'Configure uma chave de modelo (OpenAI, Gemini, etc.).',
      },
      {
        id: 'routines',
        title: 'Rotinas repetidas',
        summary: 'Fluxos que voce repete viram rascunhos de habilidade para a proxima vez.',
        howToAsk: 'Peca a mesma rotina algumas vezes; eu anoto o padrao.',
        examples: ['Todo dia me lembre de X', 'Sempre que eu pedir release notes, faca assim'],
        trust: 'sempre-disponivel',
        trustLabel: TRUST_LABELS['sempre-disponivel'],
        category: 'automacao',
        ready: true,
        nextStep: null,
      },
      {
        id: 'telegram',
        title: 'Falar no Telegram',
        summary: telegramReady
          ? 'Telegram configurado — bom caminho para o dia a dia no celular.'
          : 'Telegram e o canal estavel recomendado no celular.',
        howToAsk: 'Mande mensagem no bot depois de configurar o token.',
        examples: ['Me manda um resumo no Telegram', 'Lembra disso quando eu falar no Telegram'],
        trust: telegramReady ? 'sempre-disponivel' : 'precisa-configurar',
        trustLabel: telegramReady ? TRUST_LABELS['sempre-disponivel'] : TRUST_LABELS['precisa-configurar'],
        category: 'canais',
        ready: telegramReady,
        nextStep: telegramReady ? null : 'Defina TELEGRAM_BOT_TOKEN.',
      },
      {
        id: 'whatsapp-cloud',
        title: 'WhatsApp oficial',
        summary: waCloudReady
          ? 'WhatsApp Cloud API configurada (caminho estavel).'
          : 'WhatsApp oficial via Cloud API — caminho de producao. Baileys e experimental.',
        howToAsk: 'Use the numero do WhatsApp Business configurado.',
        examples: ['Responda no WhatsApp', 'Me avise no WhatsApp'],
        trust: waCloudReady ? 'sempre-disponivel' : 'precisa-configurar',
        trustLabel: waCloudReady ? TRUST_LABELS['sempre-disponivel'] : TRUST_LABELS['precisa-configurar'],
        category: 'canais',
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
      .filter((p) => includeLearned || p.category !== 'aprendido')
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
          title: item.kind === 'preference' ? `Seu jeito: ${shortTitle(item.summary)}` : item.title,
          summary: item.summary,
          howToAsk: item.kind === 'preference'
            ? 'Continue conversando; eu ja levo isso em conta.'
            : 'Peca a rotina parecida; o rascunho guia a proxima vez.',
          examples: [item.summary.slice(0, 80)],
          trust: 'aprendido' as const,
          trustLabel: TRUST_LABELS.aprendido,
          category: 'aprendido' as const,
          ready: true,
          nextStep: `To undo: say "undo learning ${item.id}" (or "desfazer aprendizado ${item.id}")`,
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
            trust: 'sempre-disponivel',
            trustLabel: TRUST_LABELS['sempre-disponivel'],
            category: 'automacao',
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

function scorePower(power: HumanSuperpower, query: string): number {
  const hay = `${power.id} ${power.title} ${power.summary} ${power.howToAsk} ${power.examples.join(' ')} ${power.category}`.toLowerCase();
  let score = 0;
  for (const token of query.split(/[^a-z0-9à-ü]+/i).filter(Boolean)) {
    if (hay.includes(token.toLowerCase())) score += 2;
  }
  if (power.ready) score += 1;
  if (power.category === 'aprendido') score += 1;
  return score;
}
