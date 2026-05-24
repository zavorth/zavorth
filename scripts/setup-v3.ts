#!/usr/bin/env node

import path from 'path';
import * as p from '@clack/prompts';
import color from 'picocolors';
import {
  formatZavorthOnboardBanner,
  formatZavorthOnboardNonInteractiveHint,
} from '../src/cli/ZavorthCliOnboardRenderer.js';
import { ZAVORTH_CLI_BRAND_NAME } from '../src/cli/ZavorthCliMascot.js';
import { formatZavorthFailureExplanation } from '../src/cli/ZavorthCliFailureExplanation.js';
import {
  ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS,
  applyZavorthSetupStudioEnvPlan,
  buildZavorthSetupStudioPlan,
  resolveSetupStudioProvider,
} from '../src/cli/ZavorthSetupStudioService.js';
import {
  type ZavorthProviderLiveValidationResult,
  renderZavorthProviderLiveValidationResult,
  validateZavorthProviderLive,
  writeZavorthProviderLiveValidationProof,
} from '../src/cli/ZavorthProviderLiveValidationService.js';
import {
  FirstRunWorkspaceBootstrapProfileService,
} from '../src/services/FirstRunWorkspaceBootstrapProfileService.js';
import {
  buildZavorthSetupStudioDryRunScreen,
  buildZavorthSetupStudioSnapshot,
  renderZavorthSetupStudioSnapshot,
} from '../src/cli/setup-studio/index.js';
import type {
  ZavorthFirstRunBootstrapAnswers,
  ZavorthFirstRunMemoryMode,
  ZavorthFirstRunSafetyPosture,
  ZavorthFirstRunTonePreference,
} from '../src/contracts/FirstRunWorkspaceBootstrapContract.js';

type SetupFlags = {
  help: boolean;
  dryRun: boolean;
  json: boolean;
  nonInteractive: boolean;
};

type SetupStudioAnswers = ZavorthFirstRunBootstrapAnswers & {
  providerSecret?: string | null;
  providerLiveValidation?: ZavorthProviderLiveValidationResult | null;
  telegramBotToken?: string | null;
  telegramAllowedUserIds?: string | null;
  vaultScope: 'skip' | 'documents' | 'downloads' | 'custom' | 'whole-pc';
  scanDirs: string[];
};

const RAW_ARGS = process.argv.slice(2);
const SETUP_FLAGS = parseSetupFlags(RAW_ARGS);
const STORAGE_ROOT = path.resolve(process.env.ZAVORTH_FIRST_RUN_STORAGE_ROOT || process.cwd());
const WORKSPACE_ROOT = path.resolve(process.cwd());

class ZavorthFirstRunSetupWizard {
  private readonly interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !SETUP_FLAGS.nonInteractive);
  private readonly profileService = new FirstRunWorkspaceBootstrapProfileService({
    storageRoot: STORAGE_ROOT,
    defaultWorkspaceRoot: WORKSPACE_ROOT,
  });

  public async run(): Promise<void> {
    if (SETUP_FLAGS.help) {
      printSetupHelp(this.profileService);
      return;
    }

    if (SETUP_FLAGS.json) {
      this.printJsonPlan();
      return;
    }

    if (SETUP_FLAGS.dryRun) {
      this.printDryRun();
      return;
    }

    if (!this.interactive) {
      console.log(formatZavorthOnboardBanner({ currentModel: 'deferred' }));
      console.log(formatZavorthOnboardNonInteractiveHint());
      console.log('');
      console.log(formatZavorthFailureExplanation({
        kind: 'non-interactive-terminal',
        whatHappened: 'The setup wizard needs an interactive terminal before it can ask questions.',
        likelyCause: 'This process is running without a TTY or prompts were disabled.',
        nextStep: 'Open an interactive terminal, or preview the setup plan without writing files.',
        tryCommand: 'zavorth setup --dry-run',
      }));
      console.log('');
      console.log('Automation preview: zavorth setup --json --dry-run');
      return;
    }

    console.clear();
    console.log(formatZavorthOnboardBanner({ currentModel: 'deferred' }));
    p.intro(`${color.green(ZAVORTH_CLI_BRAND_NAME)} setup`);

    const existingProfile = this.profileService.readProfile();
    let overwriteExisting = false;
    if (existingProfile) {
      const choice = await p.select({
        message: 'Ja existe um profile de primeiro uso para este workspace.',
        options: [
          { value: 'view', label: 'Ver resumo e sair', hint: 'Nao grava nada.' },
          { value: 'update', label: 'Atualizar profile', hint: 'Mostra resumo antes de gravar.' },
          { value: 'cancel', label: 'Cancelar', hint: 'Mantem tudo como esta.' },
        ],
        initialValue: 'view',
      });
      if (p.isCancel(choice) || choice === 'cancel') {
        p.cancel('Setup cancelado. Nenhuma mudanca foi gravada.');
        return;
      }
      if (choice === 'view') {
        p.note([
          `Usuario: ${existingProfile.preferredAddress}`,
          `Agente: ${existingProfile.agentDisplayName}`,
          `Workspace: ${existingProfile.workspaceRoot}`,
          `Memoria: ${existingProfile.memoryMode}`,
          `Seguranca: ${existingProfile.safetyPosture}`,
        ].join('\n'), 'Profile atual');
        return;
      }
      overwriteExisting = true;
    }

    const answers = await this.collectAnswers();
    const profileAnswers = this.toProfileAnswers(answers);
    const plan = this.profileService.buildPlan(profileAnswers, { overwriteExisting });
    const studioPlan = buildZavorthSetupStudioPlan({
      projectRoot: STORAGE_ROOT,
      providerId: String(answers.providerId || 'deferred'),
      modelId: answers.modelId,
      providerSecret: answers.providerSecret,
      telegramBotToken: answers.telegramBotToken,
      telegramAllowedUserIds: answers.telegramAllowedUserIds,
      memoryMode: answers.memoryMode as ZavorthFirstRunMemoryMode,
      vaultScope: answers.vaultScope,
      scanDirs: answers.scanDirs,
    });
    p.note([
      renderPlanSummary(plan),
      '',
      renderZavorthSetupStudioSnapshot(buildZavorthSetupStudioSnapshot({
        projectRoot: STORAGE_ROOT,
        providerId: String(answers.providerId || 'deferred'),
        modelId: answers.modelId,
        providerSecret: answers.providerSecret,
        telegramBotToken: answers.telegramBotToken,
        telegramAllowedUserIds: answers.telegramAllowedUserIds,
        memoryMode: answers.memoryMode as ZavorthFirstRunMemoryMode,
        vaultScope: answers.vaultScope,
        scanDirs: answers.scanDirs,
        dryRun: false,
      })),
    ].join('\n'), 'Resumo antes de gravar');

    const confirmed = await p.confirm({
      message: 'Gravar este profile canonico agora?',
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      const result = this.profileService.applyProfile(profileAnswers, {
        confirmed: false,
        overwriteExisting,
      });
      p.cancel(result.summary.join('\n'));
      return;
    }

    const result = this.profileService.applyProfile(profileAnswers, {
      confirmed: true,
      overwriteExisting,
    });
    if (result.status !== 'applied') {
      p.cancel(result.summary.join('\n'));
      return;
    }

    const envResult = applyZavorthSetupStudioEnvPlan(studioPlan);
    const proofResult = writeZavorthProviderLiveValidationProof(STORAGE_ROOT, answers.providerLiveValidation);

    p.outro([
      ...result.summary,
      envResult.written ? `Setup Studio atualizou .env: ${envResult.keys.join(', ')}` : 'Setup Studio nao precisou alterar .env.',
      renderZavorthProviderLiveValidationResult(answers.providerLiveValidation),
      proofResult.written && proofResult.path ? `Prova sanitizada: ${proofResult.path}` : 'Prova live: nao gravada.',
      '',
      'Agora rode:',
      ...result.nextCommands.map((command) => `  ${command}`),
    ].join('\n'));
  }

  private async collectAnswers(): Promise<SetupStudioAnswers> {
    const preferredAddress = await this.text({
      message: 'Como voce quer que eu te chame?',
      initialValue: '',
      validate: (input) => String(input || '').trim() ? undefined : 'Informe como devo chamar voce.',
    });

    const agentDisplayName = await this.text({
      message: 'Que nome voce quer dar ao Zavorth neste workspace?',
      initialValue: 'Zavorth',
      validate: (input) => String(input || '').trim() ? undefined : 'Informe um nome para o agente.',
    });

    const tonePreference = await this.select<ZavorthFirstRunTonePreference>({
      message: 'Qual tom combina melhor com voce?',
      options: [
        { value: 'conciso', label: 'Conciso', hint: 'Curto, direto, sem detalhes extras.' },
        { value: 'equilibrado', label: 'Equilibrado', hint: 'Padrao recomendado para comecar.' },
        { value: 'detalhado', label: 'Detalhado', hint: 'Mais contexto e justificativa.' },
      ],
      initialValue: 'equilibrado',
    });

    const workspaceRoot = await this.text({
      message: 'Qual e o workspace principal?',
      initialValue: WORKSPACE_ROOT,
      validate: (input) => String(input || '').trim() ? undefined : 'Informe um workspace.',
    });

    const providerId = await this.select<string>({
      message: 'Qual provider voce quer deixar pronto?',
      options: ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.map((provider) => ({
        value: provider.id,
        label: provider.label,
        hint: provider.needsSecret ? 'Pode inserir chave agora por campo secreto.' : 'Nao exige chave.',
      })),
      initialValue: 'deferred',
    });

    const provider = resolveSetupStudioProvider(providerId);
    let modelId = provider.defaultModel;
    if (providerId !== 'deferred') {
      modelId = await this.text({
        message: 'Qual modelo deve ser o padrao deste provider?',
        initialValue: provider.defaultModel,
        validate: (input) => String(input || '').trim() ? undefined : 'Informe um modelo ou use model-not-selected.',
      });
    }

    let providerSecret: string | null = null;
    if (provider.needsSecret) {
      const shouldCaptureSecret = await p.confirm({
        message: `Quer inserir a chave de ${provider.label} agora?`,
        initialValue: false,
      });
      if (p.isCancel(shouldCaptureSecret)) {
        p.cancel('Setup cancelado. Nenhuma mudanca foi gravada.');
        process.exit(0);
      }
      if (shouldCaptureSecret) {
        providerSecret = await this.password({
          message: `Cole a chave de ${provider.label}. Ela nao sera exibida.`,
          validate: (input) => String(input || '').trim() ? undefined : 'Cole a chave ou volte e pule esta etapa.',
        });
      }
    }
    const providerLiveValidation = await this.collectProviderLiveValidation({
      providerId,
      modelId,
      providerSecret,
      needsSecret: provider.needsSecret,
    });

    const memoryMode = await this.select<ZavorthFirstRunMemoryMode>({
      message: 'Como a continuidade local deve funcionar?',
      options: [
        { value: 'off', label: 'Off', hint: 'Nao registrar continuidade.' },
        { value: 'local-metadata', label: 'Metadados locais', hint: 'Padrao conservador.' },
        { value: 'local-summary', label: 'Resumo local', hint: 'Permite continuidade com resumo.' },
      ],
      initialValue: 'local-metadata',
    });

    const vaultScope = await this.select<SetupStudioAnswers['vaultScope']>({
      message: 'Onde o Mnemos pode procurar documentos?',
      options: [
        { value: 'skip', label: 'Configurar depois', hint: 'Nao define cofre agora.' },
        { value: 'documents', label: 'Documents', hint: 'Pasta de documentos do usuario.' },
        { value: 'downloads', label: 'Downloads', hint: 'Boa para PDFs recentes.' },
        { value: 'custom', label: 'Pasta especifica', hint: 'Voce informa um caminho.' },
        { value: 'whole-pc', label: 'PC inteiro', hint: 'Invasivo; exige confirmacao extra.' },
      ],
      initialValue: 'skip',
    });
    const scanDirs = await this.collectMnemosScanDirs(vaultScope);

    const safetyPosture = await this.select<ZavorthFirstRunSafetyPosture>({
      message: 'Qual postura de seguranca deve ser o padrao?',
      options: [
        { value: 'preview-first', label: 'Preview first', hint: 'Mostra plano antes de agir.' },
        { value: 'approval-required', label: 'Approval required', hint: 'Pede aprovacao com mais frequencia.' },
        { value: 'local-only', label: 'Local only', hint: 'Evita superficies externas por padrao.' },
      ],
      initialValue: 'preview-first',
    });

    const configureTelegram = await p.confirm({
      message: 'Quer configurar Telegram agora?',
      initialValue: false,
    });
    if (p.isCancel(configureTelegram)) {
      p.cancel('Setup cancelado. Nenhuma mudanca foi gravada.');
      process.exit(0);
    }
    let telegramBotToken: string | null = null;
    let telegramAllowedUserIds: string | null = null;
    if (configureTelegram) {
      telegramBotToken = await this.password({
        message: 'Cole o TELEGRAM_BOT_TOKEN. Ele nao sera exibido.',
        validate: (input) => String(input || '').trim() ? undefined : 'Cole o token ou cancele para pular.',
      });
      telegramAllowedUserIds = await this.text({
        message: 'Quais IDs de usuario podem usar o bot? Separe por virgula.',
        initialValue: '',
      });
    }

    return {
      userDisplayName: preferredAddress,
      preferredAddress,
      agentDisplayName,
      tonePreference,
      workspaceRoot,
      providerId,
      modelId,
      providerStatus: providerId === 'deferred' ? 'deferred' : 'configured-placeholder',
      memoryMode,
      safetyPosture,
      providerSecret,
      providerLiveValidation,
      telegramBotToken,
      telegramAllowedUserIds,
      vaultScope,
      scanDirs,
    };
  }

  private toProfileAnswers(answers: SetupStudioAnswers): ZavorthFirstRunBootstrapAnswers {
    return {
      userDisplayName: answers.userDisplayName,
      preferredAddress: answers.preferredAddress,
      agentDisplayName: answers.agentDisplayName,
      tonePreference: answers.tonePreference,
      workspaceRoot: answers.workspaceRoot,
      providerId: answers.providerId,
      modelId: answers.modelId,
      providerStatus: answers.providerStatus,
      memoryMode: answers.memoryMode,
      safetyPosture: answers.safetyPosture,
    };
  }

  private async collectMnemosScanDirs(vaultScope: SetupStudioAnswers['vaultScope']): Promise<string[]> {
    const home = process.env.USERPROFILE || process.env.HOME || WORKSPACE_ROOT;
    if (vaultScope === 'skip') {
      return [];
    }
    if (vaultScope === 'documents') {
      return [path.join(home, 'Documents')];
    }
    if (vaultScope === 'downloads') {
      return [path.join(home, 'Downloads')];
    }
    if (vaultScope === 'whole-pc') {
      p.note([
        'Buscar no PC inteiro pode ler arquivos privados, caches, downloads antigos e dados sensiveis.',
        'O Zavorth vai registrar esse escopo explicitamente para voce poder revisar e revogar depois.',
      ].join('\n'), 'Atencao');
      const first = await p.confirm({
        message: 'Voce confirma que quer permitir varredura ampla?',
        initialValue: false,
      });
      const second = !p.isCancel(first) && first ? await p.confirm({
        message: 'Confirmacao final: registrar PC inteiro como escopo do Mnemos?',
        initialValue: false,
      }) : false;
      if (p.isCancel(first) || p.isCancel(second) || !first || !second) {
        return [];
      }
      return [path.parse(WORKSPACE_ROOT).root || WORKSPACE_ROOT];
    }
    const custom = await this.text({
      message: 'Informe a pasta exata do cofre Mnemos.',
      initialValue: path.join(home, 'Documents'),
      validate: (input) => String(input || '').trim() ? undefined : 'Informe uma pasta.',
    });
    return [custom];
  }

  private async collectProviderLiveValidation(input: {
    providerId: string;
    modelId: string;
    providerSecret: string | null;
    needsSecret: boolean;
  }): Promise<ZavorthProviderLiveValidationResult | null> {
    if (input.providerId === 'deferred') {
      return null;
    }
    if (input.needsSecret && !input.providerSecret) {
      return null;
    }
    const shouldTest = await p.confirm({
      message: 'Quer testar esse provider agora com uma chamada live leve?',
      initialValue: false,
    });
    if (p.isCancel(shouldTest) || !shouldTest) {
      return null;
    }

    while (true) {
      const validation = await this.runProviderLiveValidation(input);
      p.note(renderZavorthProviderLiveValidationResult(validation), 'Provider live test');
      if (validation.status === 'passed' || validation.status === 'unsupported') {
        return validation;
      }
      const next = await p.select({
        message: 'O teste live falhou. Como deseja seguir?',
        options: [
          { value: 'retry', label: 'Tentar novamente', hint: 'Repete o ping com a mesma chave/modelo.' },
          { value: 'save', label: 'Salvar mesmo assim', hint: 'Grava a config e salva prova sanitizada da falha.' },
          { value: 'skip', label: 'Pular teste', hint: 'Grava a config sem prova live.' },
        ],
        initialValue: 'retry',
      });
      if (p.isCancel(next) || next === 'skip') {
        return null;
      }
      if (next === 'save') {
        return validation;
      }
    }
  }

  private async runProviderLiveValidation(input: {
    providerId: string;
    modelId: string;
    providerSecret: string | null;
  }): Promise<ZavorthProviderLiveValidationResult> {
    const spinner = p.spinner();
    spinner.start('Testando provider com ping live...');
    try {
      const validation = await validateZavorthProviderLive({
        projectRoot: STORAGE_ROOT,
        providerId: input.providerId,
        modelId: input.modelId,
        providerSecret: input.providerSecret,
        explicitUserConsent: true,
      });
      if (validation.status === 'passed') {
        spinner.stop('Provider validado.');
      } else {
        spinner.stop('Teste live concluido com atencao.');
      }
      return validation;
    } catch (error) {
      spinner.stop('Teste live falhou.');
      throw error;
    }
  }

  private printDryRun(): void {
    const plan = this.profileService.buildPlan({}, {
      dryRun: true,
      nonInteractive: !this.interactive,
    });
    console.log(buildZavorthSetupStudioDryRunScreen({
      projectRoot: STORAGE_ROOT,
      providerId: plan.profile.provider.providerId,
      modelId: plan.profile.provider.modelId,
      memoryMode: plan.profile.memoryMode,
      vaultScope: 'skip',
      scanDirs: [],
      dryRun: true,
    }));
    console.log('');
    console.log(renderPlanSummary(plan));
  }

  private printJsonPlan(): void {
    const plan = this.profileService.buildPlan({}, {
      dryRun: SETUP_FLAGS.dryRun || !this.interactive,
      nonInteractive: !this.interactive,
    });
    console.log(plan.redactedJson);
  }

  private async text(input: Parameters<typeof p.text>[0]): Promise<string> {
    const value = await p.text(input);
    if (p.isCancel(value)) {
      p.cancel('Setup cancelado. Nenhuma mudanca foi gravada.');
      process.exit(0);
    }
    return String(value || '').trim();
  }

  private async password(input: Parameters<typeof p.password>[0]): Promise<string> {
    const value = await p.password(input);
    if (p.isCancel(value)) {
      p.cancel('Setup cancelado. Nenhuma mudanca foi gravada.');
      process.exit(0);
    }
    return String(value || '').trim();
  }

  private async select<T extends string>(input: Parameters<typeof p.select>[0]): Promise<T> {
    const value = await p.select(input);
    if (p.isCancel(value)) {
      p.cancel('Setup cancelado. Nenhuma mudanca foi gravada.');
      process.exit(0);
    }
    return String(value || '').trim() as T;
  }
}

function parseSetupFlags(args: string[]): SetupFlags {
  const normalized = new Set(args.map((arg) => String(arg || '').trim().toLowerCase()));
  return {
    help: normalized.has('--help') || normalized.has('-h') || normalized.has('help'),
    dryRun: normalized.has('--dry-run') || normalized.has('dryrun'),
    json: normalized.has('--json'),
    nonInteractive: normalized.has('--non-interactive') || normalized.has('--noninteractive'),
  };
}

function renderPlanSummary(plan: ReturnType<FirstRunWorkspaceBootstrapProfileService['buildPlan']>): string {
  return [
    'O que sera escrito:',
    ...plan.writes.map((entry) => `- ${formatSetupPath(entry.path, plan.paths.storageRoot)} (${entry.action})`),
    '',
    'Resumo:',
    ...plan.summary.map((line) => `- ${line}`),
    '',
    'O que NAO sera escrito:',
    ...plan.willNotWrite.map((line) => `- ${line}`),
    '',
    'Proximos comandos:',
    ...plan.nextCommands.map((command) => `- ${command}`),
    ...(plan.safety.blockers.length > 0 ? ['', 'Bloqueios:', ...plan.safety.blockers.map((line) => `- ${line}`)] : []),
  ].join('\n');
}

function formatSetupPath(filePath: string, storageRoot: string): string {
  const relative = path.relative(storageRoot, filePath).replace(/\\/g, '/');
  if (!relative || relative === '') {
    return '.';
  }
  return relative;
}

function printSetupHelp(profileService: FirstRunWorkspaceBootstrapProfileService): void {
  const paths = profileService.resolvePaths();
  console.log([
    `${ZAVORTH_CLI_BRAND_NAME} setup`,
    '',
    'Prepara o primeiro uso com um profile canonico do workspace.',
    '',
    'Uso:',
    '  zavorth setup',
    '  zavorth setup --dry-run',
    '  zavorth setup --json --dry-run',
    '  npm run setup',
    '',
    'O wizard pergunta:',
    '  - como chamar voce',
    '  - nome do agente neste workspace',
    '  - tom de conversa',
    '  - workspace principal',
    '  - provider, modelo e chave opcional por campo secreto',
    '  - teste live opcional e explicito do provider',
    '  - memoria/continuidade e cofre Mnemos',
    '  - Telegram/canais opcionais',
    '  - postura de seguranca',
    '',
    'Arquivos Zavorth-owned:',
    `  profile:   ${paths.profilePath}`,
    `  workspace: ${paths.workspacePath}`,
    `  identity:  ${paths.identityPath}`,
    `  policy:    ${paths.policyPath}`,
    '',
    'Seguro por padrao:',
    '  - chaves sao coletadas por prompt secreto',
    '  - resumos e JSON nunca imprimem secrets',
    '  - nao inicia runtime persistente',
    '  - teste live so roda se voce confirmar',
    '  - dry-run nao escreve arquivos',
    '',
    'Depois:',
    '  zavorth ready',
    '  zavorth start',
    '  zavorth open',
  ].join('\n'));
}

new ZavorthFirstRunSetupWizard().run().catch((error) => {
  console.error(formatZavorthFailureExplanation({
    error,
    whatHappened: 'Zavorth setup stopped before it could finish.',
    nextStep: 'Run a dry-run preview, then use doctor if the same blocker remains.',
    tryCommand: 'zavorth setup --dry-run',
  }));
  process.exit(1);
});
