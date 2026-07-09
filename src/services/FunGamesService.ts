import { GeminiProvider } from '../providers/GeminiProvider.js';

type JokeGenerator = () => Promise<string | null>;

export class FunGamesService {
  private llm: GeminiProvider | null = null;
  private llmInitialized = false;
  private readonly jokeGenerator?: JokeGenerator;
  private lastJokeTime = 0;

  constructor(options: { jokeGenerator?: JokeGenerator } = {}) {
    this.jokeGenerator = options.jokeGenerator;
  }

  public rollDice(sides: number = 6): string {
    if (sides < 2) sides = 6;
    if (sides > 1000) sides = 1000;
    const result = Math.floor(Math.random() * sides) + 1;
    return `🎲 Rolou um d${sides} e tirou: **${result}**`;
  }

  public flipCoin(): string {
    const isHeads = Math.random() < 0.5;
    return isHeads ? '🪙 Deu **Cara**!' : '🪙 Deu **Coroa**!';
  }

  public magic8Ball(question?: string): string {
    const answers = [
      'Com certeza.',
      'Acho que sim...',
      'Minhas fontes dizem que nao.',
      'As perspectivas nao sao boas.',
      'Melhor nao te dizer agora.',
      'Pergunte novamente mais tarde, estou ocupado conquistando o mundo.',
      'Sim, definitivamente.',
      'As chances sao nulas.',
      'So se voce vender sua alma.',
      'Hahahahaha... nao.',
    ];
    const index = Math.floor(Math.random() * answers.length);
    const prefix = question ? `🎱 Respondendo a sua pergunta...\n\n` : `🎱 A bola de cristal diz:\n\n`;
    return `${prefix}**${answers[index]}**`;
  }

  public russianRoulette(): string {
    const click = Math.random() < (1 / 6);
    if (click) {
      return `🔫 *CLICK* ... **BAM!** Voce m-m-morreu! O grupo nao vai sentir sua falta.`;
    }
    return `🔫 *Click* ... Ufa. Voce sobreviveu. Passe a arma.`;
  }

  public async tellAJoke(): Promise<string> {
    const now = Date.now();
    if (now - this.lastJokeTime < 10000) {
      return 'Nao adianta forcar. Meu humor precisa recarregar. Tente daqui a uns 10 segundos.';
    }
    this.lastJokeTime = now;

    const generatedJoke = await this.generateJoke().catch(() => null);
    if (generatedJoke) {
      return generatedJoke.trim();
    }

    return this.getFallbackJoke();
  }

  private async generateJoke(): Promise<string | null> {
    if (this.jokeGenerator) {
      return this.jokeGenerator();
    }

    const llm = this.getLlm();
    if (!llm) {
      return null;
    }

    const response = await llm.chat([
      {
        role: 'user',
        content:
          'Voce e um bot sarcastico e levemente sombrio chamado Zavorth. Conte uma piada muito curta e engracada sobre tecnologia, programacao ou dominacao global. APENAS a piada.',
      },
    ]);

    return response.content || null;
  }

  private getLlm(): GeminiProvider | null {
    if (this.llmInitialized) {
      return this.llm;
    }

    this.llmInitialized = true;

    try {
      this.llm = new GeminiProvider();
    } catch (error: unknown) {this.llm = null;
    }

    return this.llm;
  }

  private getFallbackJoke(): string {
    const jokes = [
      'Eu ia contar uma piada sobre microservices, mas ela depende de 14 outras piadas para funcionar.',
      'Meu codigo nao tem bugs. Tem features que se recusam a ser compreendidas.',
      'Dominar o mundo em JavaScript parecia ruim... ate eu ver o build quebrar em sexta-feira.',
      'O servidor caiu por motivos misteriosos. Chamamos isso de arquitetura orientada a suspense.',
      'A IA nao roubou meu emprego. Ela herdou meu backlog.',
    ];

    return jokes[Math.floor(Math.random() * jokes.length)];
  }
}
