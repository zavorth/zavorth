/**
 * 🐍 ZAVORTH — Setup Wizard
 * 
 * Script interativo para configurar o ambiente do Zavorth.
 * Roda via: npm run setup (ou npx tsx scripts/setup.ts)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const ENV_PATH = path.resolve(__dirname, '..', '.env');
const ENV_EXAMPLE_PATH = path.resolve(__dirname, '..', '.env.example');

interface SetupQuestion {
  key: string;
  prompt: string;
  required: boolean;
  secret: boolean;
  defaultValue?: string;
  validate?: (value: string) => string | null; // returns error message or null
}

const QUESTIONS: SetupQuestion[] = [
  {
    key: 'TELEGRAM_BOT_TOKEN',
    prompt: '🤖 Qual é o Token do seu Bot do Telegram?\n   (Pegue com o @BotFather no Telegram)',
    required: true,
    secret: true,
    validate: (v) => v.includes(':') ? null : 'Token inválido. O formato correto é: 123456789:ABCdefGHI...',
  },
  {
    key: 'TELEGRAM_ALLOWED_USER_IDS',
    prompt: '🔑 Qual é o seu ID de usuário no Telegram?\n   (Use o bot @userinfobot para descobrir)',
    required: true,
    secret: false,
    validate: (v) => /^\d+(,\d+)*$/.test(v.trim()) ? null : 'Formato inválido. Use apenas números (ex: 123456789 ou 123,456).',
  },
  {
    key: 'LLM_PROVIDER',
    prompt: '🧠 Qual provider de IA deseja usar como padrão?\n   Opções: gemini, deepseek, openai, qwen, openrouter',
    required: false,
    secret: false,
    defaultValue: 'gemini',
    validate: (v) => ['gemini', 'deepseek', 'openai', 'qwen', 'openrouter'].includes(v.toLowerCase()) ? null : 'Provider não reconhecido.',
  },
  {
    key: 'GEMINI_API_KEY',
    prompt: '🔐 Chave da API do Google Gemini (obrigatória se usar Gemini):\n   (Pegue em https://aistudio.google.com/apikey)',
    required: true,
    secret: true,
    validate: (v) => v.startsWith('AIza') ? null : 'Chave Gemini geralmente começa com "AIza...".',
  },
  {
    key: 'GEMINI_API_KEY_2',
    prompt: '🔐 Chave de failover do Gemini (opcional, pressione Enter para pular):',
    required: false,
    secret: true,
  },
  {
    key: 'DEEPSEEK_API_KEY',
    prompt: '🔐 Chave da API DeepSeek (opcional, pressione Enter para pular):',
    required: false,
    secret: true,
  },
  {
    key: 'OPENAI_API_KEY',
    prompt: '🔐 Chave da API OpenAI (opcional, pressione Enter para pular):',
    required: false,
    secret: true,
  },
  {
    key: 'GROQ_API_KEY',
    prompt: '🔐 Chave da API Groq (opcional, pressione Enter para pular):',
    required: false,
    secret: true,
  },
  {
    key: 'OPENROUTER_API_KEY',
    prompt: '🔐 Chave da API OpenRouter (opcional, pressione Enter para pular):',
    required: false,
    secret: true,
  },
];

// === Defaults que não precisam de interação ===
const STATIC_DEFAULTS: Record<string, string> = {
  MAX_ITERATIONS: '5',
  MEMORY_WINDOW_SIZE: '20',
  MAX_TOKENS: '8000',
  VIDEO_CHUNK_CONCURRENCY: '2',
  VIDEO_CONTEXT_RETENTION_DAYS: '30',
  VIDEO_CONTEXT_MAX_FILES: '120',
  TEMP_FILE_RETENTION_HOURS: '2',
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_TRANSCRIPTION_MODEL: 'gemini-2.5-flash',
  DEEPSEEK_MODEL: 'deepseek-chat',
  OPENAI_MODEL: 'gpt-4o-mini',
  QWEN_MODEL: 'openrouter:qwen/qwen-plus',
  OPENROUTER_MODEL: 'minimax/minimax-m2.7',
};

class SetupWizard {
  private rl: readline.Interface;
  private answers: Record<string, string> = {};

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private printBanner(): void {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║  🐍 ZAVORTH — Assistente de Configuração   ║');
    console.log('  ║     "Pelo Soulfire, pela Lógica." 🐉🔥      ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Este assistente vai te guiar na configuração');
    console.log('  do ambiente do Zavorth. Vamos começar!');
    console.log('');
  }

  private printSuccess(): void {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║  ✅ Configuração concluída com sucesso!      ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Seu arquivo .env foi criado.');
    console.log('  Para iniciar o Zavorth, rode:');
    console.log('');
    console.log('    npm run dev');
    console.log('');
    console.log('  🐉🔥 O Zavorth está pronto para servir.');
    console.log('');
  }

  async run(): Promise<void> {
    this.printBanner();

    // Verificar se já existe .env
    if (fs.existsSync(ENV_PATH)) {
      const overwrite = await this.ask('  ⚠️  Já existe um arquivo .env. Deseja sobrescrevê-lo? (s/N): ');
      if (overwrite.toLowerCase() !== 's') {
        console.log('\n  Operação cancelada. Seu .env atual foi mantido.\n');
        this.rl.close();
        return;
      }
    }

    // Fazer as perguntas interativas
    for (const q of QUESTIONS) {
      let value = '';
      let valid = false;

      while (!valid) {
        console.log('');
        const defaultHint = q.defaultValue ? ` [padrão: ${q.defaultValue}]` : '';
        const requiredHint = q.required ? ' (obrigatório)' : '';
        value = await this.ask(`  ${q.prompt}${defaultHint}${requiredHint}\n  > `);

        if (!value && q.defaultValue) {
          value = q.defaultValue;
        }

        if (!value && q.required) {
          console.log('  ❌ Este campo é obrigatório. Tente novamente.');
          continue;
        }

        if (!value && !q.required) {
          valid = true;
          continue;
        }

        if (q.validate) {
          const error = q.validate(value);
          if (error) {
            console.log(`  ❌ ${error}`);
            continue;
          }
        }

        valid = true;
      }

      if (value) {
        this.answers[q.key] = value;
      }
    }

    // Gerar o .env
    this.generateEnvFile();
    this.printSuccess();
    this.rl.close();
  }

  private generateEnvFile(): void {
    const lines: string[] = [
      '# ============================================================',
      '# 🐍 ZAVORTH — Configuração do Ambiente',
      '# Gerado automaticamente pelo Setup Wizard',
      `# Data: ${new Date().toISOString()}`,
      '# ============================================================',
      '',
      '# === Telegram ===',
      `TELEGRAM_BOT_TOKEN=${this.answers['TELEGRAM_BOT_TOKEN'] || ''}`,
      `TELEGRAM_ALLOWED_USER_IDS=${this.answers['TELEGRAM_ALLOWED_USER_IDS'] || ''}`,
      '',
      '# === LLM Provider ===',
      `LLM_PROVIDER=${this.answers['LLM_PROVIDER'] || 'gemini'}`,
      '',
      '# === API Keys ===',
      `GEMINI_API_KEY=${this.answers['GEMINI_API_KEY'] || ''}`,
    ];

    if (this.answers['GEMINI_API_KEY_2']) {
      lines.push(`GEMINI_API_KEY_2=${this.answers['GEMINI_API_KEY_2']}`);
    }
    if (this.answers['DEEPSEEK_API_KEY']) {
      lines.push(`DEEPSEEK_API_KEY=${this.answers['DEEPSEEK_API_KEY']}`);
    }
    if (this.answers['OPENAI_API_KEY']) {
      lines.push(`OPENAI_API_KEY=${this.answers['OPENAI_API_KEY']}`);
    }
    if (this.answers['GROQ_API_KEY']) {
      lines.push(`GROQ_API_KEY=${this.answers['GROQ_API_KEY']}`);
    }
    if (this.answers['OPENROUTER_API_KEY']) {
      lines.push(`OPENROUTER_API_KEY=${this.answers['OPENROUTER_API_KEY']}`);
    }

    lines.push('');
    lines.push('# === Configurações Padrão ===');
    for (const [key, value] of Object.entries(STATIC_DEFAULTS)) {
      lines.push(`${key}=${value}`);
    }

    lines.push('');
    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
  }
}

// Run
const wizard = new SetupWizard();
wizard.run().catch((err) => {
  console.error('Erro no setup:', err);
  process.exit(1);
});
