/**
 * Zavorth Setup Wizard
 *
 * Interactive script for configuring the Zavorth environment.
 * Run with: npm run setup or npx tsx scripts/setup.ts
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
    prompt: 'Telegram bot token (optional if you do not use Telegram):',
    required: false,
    secret: true,
    validate: (v) => !v || v.includes(':') ? null : 'Invalid Telegram token format.',
  },
  {
    key: 'TELEGRAM_ALLOWED_USER_IDS',
    prompt: 'Telegram allowed user IDs (optional, comma-separated):',
    required: false,
    secret: false,
    validate: (v) => !v.trim() || /^\d+(,\d+)*$/.test(v.trim()) ? null : 'Invalid comma-separated numeric ID list.',
  },
  {
    key: 'LLM_PROVIDER',
    prompt: 'Default AI provider (any configured provider ID):',
    required: false,
    secret: false,
    defaultValue: 'auto',
    validate: (v) => v.trim().length > 0 ? null : 'Provider ID cannot be empty.',
  },
  {
    key: 'GEMINI_API_KEY',
    prompt: 'Primary provider API key (optional when using local or already configured providers):',
    required: false,
    secret: true,
    validate: (v) => !v || v.trim().length >= 8 ? null : 'API key looks too short.',
  },
  {
    key: 'GEMINI_API_KEY_2',
    prompt: 'Secondary provider API key (optional):',
    required: false,
    secret: true,
  },
  {
    key: 'DEEPSEEK_API_KEY',
    prompt: 'DeepSeek API key (optional):',
    required: false,
    secret: true,
  },
  {
    key: 'OPENAI_API_KEY',
    prompt: 'OpenAI API key (optional):',
    required: false,
    secret: true,
  },
  {
    key: 'GROQ_API_KEY',
    prompt: 'Groq API key (optional):',
    required: false,
    secret: true,
  },
  {
    key: 'OPENROUTER_API_KEY',
    prompt: 'OpenRouter API key (optional):',
    required: false,
    secret: true,
  },
];

// Defaults that do not require interaction.
// Defaults that do not require interaction.
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
    console.log('      ZAVORTH - Setup Wizard');
    console.log('      Product-ready local configuration');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  This wizard will guide the environment setup');
    console.log('  for Zavorth. Let us begin!');
    console.log('');
  }

  private printSuccess(): void {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('      Configuration completed successfully!');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Seu arquivo .env foi criado.');
    console.log('  Para iniciar o Zavorth, rode:');
    console.log('');
    console.log('    npm run dev');
    console.log('');
    console.log('  Zavorth is ready.');
    console.log('');
  }

  async run(): Promise<void> {
    this.printBanner();

    // Check whether .env already exists.
    if (fs.existsSync(ENV_PATH)) {
      const overwrite = await this.ask('  A .env file already exists. Overwrite it? (y/N): ');
      if (overwrite.toLowerCase() !== 's') {
        console.log('\\n  Operation cancelled. The current .env was preserved.\\n');
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
        const defaultHint = q.defaultValue ? ` [default: ${q.defaultValue}]` : '';
        const requiredHint = q.required ? ' (required)' : '';
        value = await this.ask(`  ${q.prompt}${defaultHint}${requiredHint}\n  > `);

        if (!value && q.defaultValue) {
          value = q.defaultValue;
        }

        if (!value && q.required) {
          console.log('  This field is required. Try again.');
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
    console.log('  for Zavorth. Let us begin!');
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
    lines.push('# === Default Settings ===');
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
