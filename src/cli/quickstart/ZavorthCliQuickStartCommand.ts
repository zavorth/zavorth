import * as readline from 'readline/promises';
import { stdin as processStdin, stdout as processStdout } from 'process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ZavorthI18nService } from '../../i18n/ZavorthI18nService.js';
import { normalizeLocale, resolveFromEnv } from '../../i18n/localeDetector.js';
import { detectAvailableProviders, getDefaultModelForProvider, type DetectedProvider } from './ProviderAutoDetector.js';
import { buildZavorthCliQuickStartSnapshot } from './ZavorthCliQuickStartProjection.js';
import { renderZavorthCliQuickStart } from './ZavorthCliQuickStartRenderer.js';
import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthCliQuickStartSnapshot } from './ZavorthCliQuickStartTypes.js';

export type RunZavorthCliQuickStartInput = {
  projectRoot: string;
  json?: boolean;
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'listPlans'> | null;
};

export type RunZavorthCliQuickStartResult = {
  exitCode: number;
  output: string;
  snapshot: ZavorthCliQuickStartSnapshot;
};

export async function runZavorthCliQuickStart(input: RunZavorthCliQuickStartInput): Promise<RunZavorthCliQuickStartResult> {
  if (input.json) {
    return runStaticQuickStart(input);
  }

  const isTTY = processStdout.isTTY;
  if (!isTTY) {
    return runStaticQuickStart(input);
  }

  return runInteractiveQuickStart(input);
}

async function runStaticQuickStart(input: RunZavorthCliQuickStartInput): Promise<RunZavorthCliQuickStartResult> {
  const snapshot = buildZavorthCliQuickStartSnapshot({
    projectRoot: input.projectRoot,
    now: input.now,
    mutationPlane: input.mutationPlane,
  });
  const output = input.json ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${renderZavorthCliQuickStart(snapshot)}\n`;

  return {
    exitCode: snapshot.status === 'blocked' ? 1 : 0,
    output,
    snapshot,
  };
}

async function runInteractiveQuickStart(input: RunZavorthCliQuickStartInput): Promise<RunZavorthCliQuickStartResult> {
  const rl = readline.createInterface({ input: processStdin, output: processStdout });
  const lines: string[] = [];
  const log = (line: string) => { lines.push(line); };

  try {
    const envLocale = resolveFromEnv(process.env);
    const detectedLocale = normalizeLocale(envLocale || detectSystemLocale());
    const i18n = new ZavorthI18nService({ locale: detectedLocale });
    const localeDir = path.join(input.projectRoot, 'src', 'i18n', 'locales');

    log('');
    log(`  ╔══════════════════════════════════════════╗`);
    log(`  ║  ${i18n.t('quickstart.welcome.banner_line1', { fallback: 'AI Agent Runtime' })}`);
    log(`  ║  ${i18n.t('quickstart.welcome.banner_line2', { fallback: 'Governed. Local-first. Yours.' })}`);
    log(`  ╚══════════════════════════════════════════╝`);
    log('');
    log(`  ${i18n.t('quickstart.welcome.title', { fallback: 'Welcome to Zavorth' })}`);
    log(`  ${i18n.t('quickstart.welcome.subtitle', { fallback: 'Let\'s get you up and running in under a minute.' })}`);
    log('');

    const selectedLocale = await promptLocale(rl, i18n, detectedLocale, localeDir, log);
    i18n.setLocale(selectedLocale);

    // Profile selection (new)
    const profile = await promptProfile(rl, log);

    const detectedProviders = detectAvailableProviders();
    const { provider, model } = await promptProvider(rl, i18n, detectedProviders, log);

    const { agentName, userName, tone } = await promptIdentity(rl, i18n, log);

    if (provider && model) {
      writeProviderToEnv(input.projectRoot, provider, model);
    }

    writeLocaleToEnv(input.projectRoot, selectedLocale);
    writeProfileToEnv(input.projectRoot, profile);

    log('');
    log(`  ──────────────────────────────────────────`);
    log(`  ${i18n.t('quickstart.summary.title', { fallback: 'You\'re all set!' })}`);
    log('');
    if (provider) log(`  ${i18n.t('quickstart.summary.provider_line', { fallback: `Provider: ${provider}`, vars: { provider } })}`);
    if (model) log(`  ${i18n.t('quickstart.summary.model_line', { fallback: `Model: ${model}`, vars: { model } })}`);
    log(`  ${i18n.t('quickstart.summary.locale_line', { fallback: `Language: ${selectedLocale}`, vars: { locale: selectedLocale } })}`);
    if (agentName) log(`  ${i18n.t('quickstart.summary.agent_name_line', { fallback: `Agent name: ${agentName}`, vars: { name: agentName } })}`);
    if (userName) log(`  ${i18n.t('quickstart.summary.user_name_line', { fallback: `Your name: ${userName}`, vars: { name: userName } })}`);
    if (tone) log(`  ${i18n.t('quickstart.summary.tone_line', { fallback: `Tone: ${tone}`, vars: { tone } })}`);
    log('');
    log(`  ${i18n.t('quickstart.summary.next_steps', { fallback: 'Next steps:' })}`);
    log(`  ${i18n.t('quickstart.summary.step_chat', { fallback: '  zavorth chat          Start a conversation' })}`);
    log(`  ${i18n.t('quickstart.summary.step_channels', { fallback: '  zavorth channels      Connect Telegram, Discord, etc.' })}`);
    log(`  ${i18n.t('quickstart.summary.step_doctor', { fallback: '  zavorth doctor        Run system diagnostics' })}`);
    log(`  ${i18n.t('quickstart.summary.step_setup', { fallback: '  zavorth setup         Advanced configuration' })}`);
    log('');

    const snapshot = buildZavorthCliQuickStartSnapshot({
      projectRoot: input.projectRoot,
      now: input.now,
      mutationPlane: input.mutationPlane,
    });

    return {
      exitCode: 0,
      output: lines.join('\n'),
      snapshot,
    };
  } finally {
    rl.close();
  }
}

async function promptLocale(
  rl: readline.Interface,
  i18n: ZavorthI18nService,
  detected: string,
  localeDir: string,
  log: (line: string) => void,
): Promise<string> {
  log(`  ${i18n.t('quickstart.locale.detected', { fallback: `Detected locale: ${detected}`, vars: { locale: detected } })}`);
  const answer = await rl.question(`  ${i18n.t('quickstart.locale.confirm_prompt', { fallback: 'Press Enter to confirm, or type a different language code:' })} `);

  if (!answer.trim()) {
    log(`  ${i18n.t('quickstart.locale.saved', { fallback: 'Language preference saved.' })}`);
    log('');
    return detected;
  }

  const normalized = normalizeLocale(answer.trim());
  if (normalized && normalized !== detected) {
    i18n.setLocale(normalized);
    log(`  ${i18n.t('quickstart.locale.saved', { fallback: 'Language preference saved.' })}`);
    log('');
    return normalized;
  }

  log(`  ${i18n.t('quickstart.locale.saved', { fallback: 'Language preference saved.' })}`);
  log('');
  return detected;
}

async function promptProfile(
  rl: readline.Interface,
  log: (line: string) => void,
): Promise<string> {
  log('  Which profile best describes you...');
  log('    1. Personal     — Daily help, maximum autonomy, simple defaults');
  log('    2. Creator       — Content creation, research, drafts');
  log('    3. Developer     — Code, repos, tests, subagents');
  log('    4. Business      — Teams, audit trails, compliance');
  log('    5. Power         — Advanced, full control');
  log('');

  const answer = await rl.question('  Choose (1-5, or Enter for Personal): ');
  const choice = parseInt(answer.trim(), 10);

  const profiles = ['personal', 'creator', 'developer', 'business', 'power'];
  const selected = profiles[Math.min(Math.max(isNaN(choice) ? 0 : choice - 1, 0), 4)];

  log(`  Profile: ${selected}`);
  log('');
  return selected;
}

async function promptProvider(
  rl: readline.Interface,
  i18n: ZavorthI18nService,
  detected: DetectedProvider[],
  log: (line: string) => void,
): Promise<{ provider: string | null; model: string | null }> {
  if (detected.length === 1) {
    const p = detected[0];
    log(`  ${i18n.t('quickstart.provider.auto_detected', { fallback: `Found API key for ${p.provider}.`, vars: { provider: p.provider } })}`);
    log(`  ${i18n.t('quickstart.provider.auto_selected', { fallback: `Using ${p.provider} with model ${p.defaultModel}.`, vars: { provider: p.provider, model: p.defaultModel } })}`);
    log('');
    return { provider: p.provider, model: p.defaultModel };
  }

  if (detected.length > 1) {
    log(`  ${i18n.t('quickstart.provider.options_header', { fallback: 'Available providers:' })}`);
    detected.forEach((p, i) => {
      log(`  ${i18n.t('quickstart.provider.option_format', { fallback: `  ${i + 1}. ${p.provider} (detected via ${p.envKey})`, vars: { index: String(i + 1), provider: p.provider, envKey: p.envKey } })}`);
    });
    log(`  ${i18n.t('quickstart.provider.option_manual', { fallback: `  ${detected.length + 1}. Enter API key manually`, vars: { index: String(detected.length + 1) } })}`);
    log('');

    const choice = await rl.question(`  ${i18n.t('quickstart.provider.select_prompt', { fallback: 'Which provider would you like to use...' })} `);
    const idx = parseInt(choice, 10) - 1;

    if (idx >= 0 && idx < detected.length) {
      const p = detected[idx];
      log(`  ${i18n.t('quickstart.provider.ready', { fallback: `Provider ready: ${p.provider}/${p.defaultModel}`, vars: { provider: p.provider, model: p.defaultModel } })}`);
      log('');
      return { provider: p.provider, model: p.defaultModel };
    }

    if (idx === detected.length) {
      return await promptManualProvider(rl, i18n, log);
    }

    log(`  ${i18n.t('quickstart.provider.skip', { fallback: 'Press Enter to skip provider setup for now.' })}`);
    log('');
    return { provider: null, model: null };
  }

  log(`  ${i18n.t('quickstart.provider.none_found', { fallback: 'No LLM provider API key found in your environment variables.' })}`);
  log('');
  return await promptManualProvider(rl, i18n, log);
}

async function promptManualProvider(
  rl: readline.Interface,
  i18n: ZavorthI18nService,
  log: (line: string) => void,
): Promise<{ provider: string | null; model: string | null }> {
  const providerName = await rl.question(`  ${i18n.t('quickstart.provider.select_prompt', { fallback: 'Which provider would you like to use...' })} `);
  if (!providerName.trim()) {
    log('');
    return { provider: null, model: null };
  }

  const apiKey = await rl.question(`  ${i18n.t('quickstart.provider.api_key_prompt', { fallback: `Paste your ${providerName.trim()} API key:`, vars: { provider: providerName.trim() } })} `);
  if (!apiKey.trim()) {
    log('');
    return { provider: null, model: null };
  }

  const model = getDefaultModelForProvider(providerName.trim());
  log(`  ${i18n.t('quickstart.provider.ready', { fallback: `Provider ready: ${providerName.trim()}/${model}`, vars: { provider: providerName.trim(), model } })}`);
  log('');
  return { provider: providerName.trim(), model };
}

async function promptIdentity(
  rl: readline.Interface,
  i18n: ZavorthI18nService,
  log: (line: string) => void,
): Promise<{ agentName: string; userName: string; tone: string }> {
  const agentName = await rl.question(`  ${i18n.t('quickstart.identity.agent_name_prompt', { fallback: 'What would you like to call me...' })} `);
  const resolvedAgentName = agentName.trim() || i18n.t('quickstart.identity.agent_name_default', { fallback: 'Zavorth' });

  const userName = await rl.question(`  ${i18n.t('quickstart.identity.user_name_prompt', { fallback: 'What should I call you...' })} `);

  log(`  ${i18n.t('quickstart.identity.tone_prompt', { fallback: 'How should I sound...' })}`);
  log(`  ${i18n.t('quickstart.identity.tone_options', { fallback: '  1. Casual    2. Professional    3. Friendly    4. Technical' })}`);
  const toneChoice = await rl.question(`  > `);
  const toneMap: Record<string, string> = {
    '1': 'casual', 'casual': 'casual',
    '2': 'professional', 'professional': 'professional',
    '3': 'friendly', 'friendly': 'friendly',
    '4': 'technical', 'technical': 'technical',
  };
  const tone = toneMap[toneChoice.trim().toLowerCase()] || 'friendly';
  log(`  ${i18n.t('quickstart.identity.tone_selected', { fallback: `Tone set to: ${tone}`, vars: { tone } })}`);
  log(`  ${i18n.t('quickstart.identity.saved', { fallback: 'Identity configured.' })}`);
  log('');

  return { agentName: resolvedAgentName, userName: userName.trim(), tone };
}

function detectSystemLocale(): string {
  const candidates = ['LANG', 'LC_ALL', 'LC_MESSAGES', 'LANGUAGE', 'USERLANGUAGE'];
  for (const key of candidates) {
    const value = process.env[key];
    if (value) return value;
  }
  return 'en-US';
}

function sanitizeEnvValue(value: string): string {
  // Remove newlines, carriage returns, and null bytes to prevent injection
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\n\r\x00]/g, '').trim();
}

function writeProviderToEnv(projectRoot: string, provider: string, model: string): void {
  const safeProvider = sanitizeEnvValue(provider);
  const safeModel = sanitizeEnvValue(model);
  const envPath = path.join(projectRoot, '.env');
  const envLine = `ZAVORTH_DEFAULT_PROVIDER=${safeProvider}\nZAVORTH_DEFAULT_MODEL=${safeModel}\n`;
  if (!existsSync(envPath)) {
    writeFileSync(envPath, envLine, 'utf-8');
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const providerIdx = lines.findIndex((l) => l.startsWith('ZAVORTH_DEFAULT_PROVIDER='));
  const modelIdx = lines.findIndex((l) => l.startsWith('ZAVORTH_DEFAULT_MODEL='));
  if (providerIdx >= 0) lines[providerIdx] = `ZAVORTH_DEFAULT_PROVIDER=${safeProvider}`;
  else lines.push(`ZAVORTH_DEFAULT_PROVIDER=${safeProvider}`);
  if (modelIdx >= 0) lines[modelIdx] = `ZAVORTH_DEFAULT_MODEL=${safeModel}`;
  else lines.push(`ZAVORTH_DEFAULT_MODEL=${safeModel}`);
  writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
}

function writeLocaleToEnv(projectRoot: string, locale: string): void {
  const safeLocale = sanitizeEnvValue(locale);
  const envPath = path.join(projectRoot, '.env');
  const envLine = `ZAVORTH_LANG=${safeLocale}\n`;
  if (!existsSync(envPath)) {
    writeFileSync(envPath, envLine, 'utf-8');
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const langIdx = lines.findIndex((l) => l.startsWith('ZAVORTH_LANG='));
  if (langIdx >= 0) lines[langIdx] = `ZAVORTH_LANG=${locale}`;
  else lines.push(`ZAVORTH_LANG=${locale}`);
  writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
}

function writeProfileToEnv(projectRoot: string, profile: string): void {
  const safeProfile = sanitizeEnvValue(profile);
  const envPath = path.join(projectRoot, '.env');
  const envLine = `ZAVORTH_EXPERIENCE_PROFILE=${safeProfile}\n`;
  if (!existsSync(envPath)) {
    writeFileSync(envPath, envLine, 'utf-8');
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const profileIdx = lines.findIndex((l) => l.startsWith('ZAVORTH_EXPERIENCE_PROFILE='));
  if (profileIdx >= 0) lines[profileIdx] = `ZAVORTH_EXPERIENCE_PROFILE=${profile}`;
  else lines.push(`ZAVORTH_EXPERIENCE_PROFILE=${profile}`);
  writeFileSync(envPath, lines.filter(Boolean).join('\n') + '\n', 'utf-8');
}
