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
  FirstRunWorkspaceBootstrapProfileService,
} from '../src/services/FirstRunWorkspaceBootstrapProfileService.js';
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
    const plan = this.profileService.buildPlan(answers, { overwriteExisting });
    p.note(renderPlanSummary(plan), 'Resumo antes de gravar');

    const confirmed = await p.confirm({
      message: 'Gravar este profile canonico agora?',
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed) {
      const result = this.profileService.applyProfile(answers, {
        confirmed: false,
        overwriteExisting,
      });
      p.cancel(result.summary.join('\n'));
      return;
    }

    const result = this.profileService.applyProfile(answers, {
      confirmed: true,
      overwriteExisting,
    });
    if (result.status !== 'applied') {
      p.cancel(result.summary.join('\n'));
      return;
    }

    p.outro([
      ...result.summary,
      '',
      'Agora rode:',
      ...result.nextCommands.map((command) => `  ${command}`),
    ].join('\n'));
  }

  private async collectAnswers(): Promise<ZavorthFirstRunBootstrapAnswers> {
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
      message: 'Qual provider/modelo voce quer deixar registrado?',
      options: [
        { value: 'deferred', label: 'Configurar depois', hint: 'Nao pede token agora.' },
        { value: 'openai', label: 'OpenAI', hint: 'Registra placeholder, sem segredo.' },
        { value: 'gemini', label: 'Gemini', hint: 'Registra placeholder, sem segredo.' },
        { value: 'anthropic', label: 'Anthropic', hint: 'Registra placeholder, sem segredo.' },
        { value: 'local', label: 'Local', hint: 'Registra modelo local futuro.' },
      ],
      initialValue: 'deferred',
    });

    let modelId = 'deferred';
    if (providerId !== 'deferred') {
      modelId = await this.text({
        message: 'Nome do modelo desejado (sem token ou chave)',
        initialValue: 'model-not-selected',
        validate: (input) => String(input || '').trim() ? undefined : 'Informe um modelo ou use model-not-selected.',
      });
    }

    const memoryMode = await this.select<ZavorthFirstRunMemoryMode>({
      message: 'Como a continuidade local deve funcionar?',
      options: [
        { value: 'off', label: 'Off', hint: 'Nao registrar continuidade.' },
        { value: 'local-metadata', label: 'Metadados locais', hint: 'Padrao conservador.' },
        { value: 'local-summary', label: 'Resumo local', hint: 'Permite continuidade com resumo.' },
      ],
      initialValue: 'local-metadata',
    });

    const safetyPosture = await this.select<ZavorthFirstRunSafetyPosture>({
      message: 'Qual postura de seguranca deve ser o padrao?',
      options: [
        { value: 'preview-first', label: 'Preview first', hint: 'Mostra plano antes de agir.' },
        { value: 'approval-required', label: 'Approval required', hint: 'Pede aprovacao com mais frequencia.' },
        { value: 'local-only', label: 'Local only', hint: 'Evita superficies externas por padrao.' },
      ],
      initialValue: 'preview-first',
    });

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
    };
  }

  private printDryRun(): void {
    const plan = this.profileService.buildPlan({}, {
      dryRun: true,
      nonInteractive: !this.interactive,
    });
    console.log(formatZavorthOnboardBanner({ currentModel: plan.profile.provider.modelId }));
    console.log('');
    console.log('Dry-run: nenhuma mudanca sera gravada.');
    console.log(renderPlanSummary(plan));
    console.log('');
    console.log('Para aplicar em terminal interativo: zavorth setup');
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
    '  - provider/modelo como placeholder seguro',
    '  - memoria/continuidade',
    '  - postura de seguranca',
    '',
    'Arquivos Zavorth-owned:',
    `  profile:   ${paths.profilePath}`,
    `  workspace: ${paths.workspacePath}`,
    `  identity:  ${paths.identityPath}`,
    `  policy:    ${paths.policyPath}`,
    '',
    'Seguro por padrao:',
    '  - nao pede token bruto',
    '  - nao grava secrets',
    '  - nao inicia runtime persistente',
    '  - dry-run nao escreve arquivos',
    '',
    'Depois:',
    '  zavorth doctor',
    '  zavorth go --dry-run',
    '  zavorth chat',
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
