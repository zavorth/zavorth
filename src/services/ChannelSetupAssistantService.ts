import {
  normalizePlatformKey,
  type PlatformKey,
} from '../contracts/PlatformContract.js';
import {
  ChannelInstallScaffoldService,
  type ChannelInstallApplyReport,
  type ChannelInstallMode,
  type ChannelInstallPlan,
  type ChannelInstallReport,
} from './ChannelInstallScaffoldService.js';
import {
  ChannelProviderDoctorService,
  type ChannelProviderDoctorItem,
  type ChannelProviderDoctorReport,
} from './ChannelProviderDoctorService.js';

type ChannelMeshSnapshotLike = {
  buildSnapshot: (input?: { selectedId?: string | null }) => any;
};

type ChannelInstallLike = Pick<
  ChannelInstallScaffoldService,
  'buildReport' | 'buildPlanForChannel' | 'applyScaffold'
>;

type ChannelProviderDoctorLike = Pick<ChannelProviderDoctorService, 'run'>;

export type ChannelSetupAssistantStatus =
  | 'needs_channel'
  | 'needs_scaffold'
  | 'needs_config'
  | 'ready_to_validate'
  | 'ready';

export type ChannelSetupAssistantOption = {
  channelId: PlatformKey;
  label: string;
  readiness: ChannelInstallPlan['readiness'];
  configured: boolean;
  currentMode: ChannelInstallMode | null;
  recommendedMode: ChannelInstallMode;
  setupMode: ChannelInstallMode;
  missingEnvKeys: string[];
  requiredEnvKeys: string[];
  webhookUrl: string | null;
  summary: string;
  operatorNextStep: string;
  commands: ChannelInstallPlan['commands'];
};

export type ChannelSetupAssistantSession = {
  generatedAt: string;
  status: ChannelSetupAssistantStatus;
  selected: ChannelSetupAssistantOption | null;
  options: ChannelSetupAssistantOption[];
  envFilePath: string;
  localBaseUrl: string;
  publicBaseUrl: string | null;
  naturalReply: string;
  nextQuestions: string[];
  nextActions: Array<{
    id: 'choose-channel' | 'apply-scaffold' | 'fill-env' | 'doctor';
    label: string;
    command: string;
  }>;
  report: ChannelInstallReport;
  channels: any | null;
};

export type ChannelSetupAssistantApplyResult = {
  generatedAt: string;
  applyReport: ChannelInstallApplyReport;
  assistant: ChannelSetupAssistantSession;
};

export type ChannelSetupAssistantDoctorResult = {
  generatedAt: string;
  doctor: ChannelProviderDoctorReport;
  selectedItem: ChannelProviderDoctorItem | null;
  assistant: ChannelSetupAssistantSession;
};

type ChannelSetupAssistantDeps = {
  now?: () => Date;
  installService?: ChannelInstallLike;
  providerDoctorService?: ChannelProviderDoctorLike | null;
  channelMeshService?: ChannelMeshSnapshotLike | null;
};

export class ChannelSetupAssistantService {
  private readonly now: () => Date;
  private readonly installService: ChannelInstallLike;
  private readonly providerDoctorService: ChannelProviderDoctorLike | null;
  private readonly channelMeshService: ChannelMeshSnapshotLike | null;

  constructor(deps: ChannelSetupAssistantDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.installService = deps.installService || new ChannelInstallScaffoldService();
    this.providerDoctorService = deps.providerDoctorService || null;
    this.channelMeshService = deps.channelMeshService || null;
  }

  public buildSession(input: {
    channelId?: string | null;
    mode?: string | null;
    intentText?: string | null;
  } = {}): ChannelSetupAssistantSession {
    const report = this.installService.buildReport();
    const channelId = this.resolveChannelId(input.channelId || this.extractChannelIdFromText(input.intentText));
    const mode = this.normalizeMode(input.mode);
    const selectedPlan = channelId
      ? this.installService.buildPlanForChannel(channelId, mode)
      : null;
    const options = report.channels.map((plan) => this.toOption(plan));
    const selected = selectedPlan ? this.toOption(selectedPlan) : null;
    const status = this.resolveStatus(selected);

    return {
      generatedAt: this.now().toISOString(),
      status,
      selected,
      options,
      envFilePath: report.envFilePath,
      localBaseUrl: report.localBaseUrl,
      publicBaseUrl: report.publicBaseUrl,
      naturalReply: this.buildNaturalReply(status, selected),
      nextQuestions: this.buildNextQuestions(status, selected),
      nextActions: this.buildNextActions(status, selected),
      report,
      channels: this.channelMeshService?.buildSnapshot({ selectedId: channelId || null }) || null,
    };
  }

  public async apply(input: {
    channelId: string;
    mode?: string | null;
    extraEntries?: Array<{ key: string; value: string }>;
    requestedBy?: string | null;
  }): Promise<ChannelSetupAssistantApplyResult> {
    const channelId = this.resolveChannelId(input.channelId);
    if (!channelId) {
      throw new Error('channelId obrigatorio.');
    }

    const plan = this.installService.buildPlanForChannel(channelId, this.normalizeMode(input.mode));
    const mode = this.normalizeMode(input.mode) || plan.currentMode || plan.recommendedMode;
    const scaffoldInput: {
      channelId: PlatformKey;
      mode: ChannelInstallMode;
      extraEntries?: Array<{ key: string; value: string }>;
    } = {
      channelId,
      mode,
    };
    if (Array.isArray(input.extraEntries) && input.extraEntries.length > 0) {
      scaffoldInput.extraEntries = input.extraEntries;
    }
    const applyReport = this.installService.applyScaffold(scaffoldInput);

    return {
      generatedAt: this.now().toISOString(),
      applyReport,
      assistant: this.buildSession({ channelId, mode }),
    };
  }

  public async runDoctor(input: {
    selectedId?: string | null;
    localOnly?: boolean;
  } = {}): Promise<ChannelSetupAssistantDoctorResult> {
    if (!this.providerDoctorService) {
      throw new Error('Doctor dos canais indisponivel neste runtime.');
    }

    const selectedId = this.resolveChannelId(input.selectedId || null);
    const doctor = await this.providerDoctorService.run({
      localOnly: input.localOnly === true,
    });
    const selectedItem = selectedId
      ? doctor.items.find((item) => item.channelId === selectedId) || null
      : null;

    return {
      generatedAt: this.now().toISOString(),
      doctor,
      selectedItem,
      assistant: this.buildSession({ channelId: selectedId }),
    };
  }

  private toOption(plan: ChannelInstallPlan): ChannelSetupAssistantOption {
    const setupMode = this.extractSetupMode(plan) || plan.currentMode || plan.recommendedMode;
    return {
      channelId: plan.channelId,
      label: plan.label,
      readiness: plan.readiness,
      configured: plan.configured,
      currentMode: plan.currentMode,
      recommendedMode: plan.recommendedMode,
      setupMode,
      missingEnvKeys: plan.missingEnvKeys.slice(),
      requiredEnvKeys: plan.requiredEnvKeys.slice(),
      webhookUrl: plan.publicWebhookUrl || plan.localWebhookUrl,
      summary: plan.summary,
      operatorNextStep: this.resolveOperatorNextStep(plan),
      commands: plan.commands,
    };
  }

  private resolveStatus(option: ChannelSetupAssistantOption | null): ChannelSetupAssistantStatus {
    if (!option) {
      return 'needs_channel';
    }
    if (!option.currentMode) {
      return 'needs_scaffold';
    }
    if (option.missingEnvKeys.length > 0) {
      return 'needs_config';
    }
    if (option.readiness !== 'ready') {
      return 'ready_to_validate';
    }
    return 'ready';
  }

  private resolveOperatorNextStep(plan: ChannelInstallPlan): string {
    if (!plan.currentMode) {
      return `Aplicar scaffold seguro: ${plan.commands.apply}.`;
    }
    if (plan.missingEnvKeys.length > 0) {
      return `Preencher ${plan.missingEnvKeys.join(', ')} e validar novamente.`;
    }
    return `Validar com doctor: ${plan.commands.doctor}.`;
  }

  private extractSetupMode(plan: ChannelInstallPlan): ChannelInstallMode | null {
    const match = String(plan.commands?.apply || '').match(/\s--mode\s+([a-z0-9-]+)/i);
    return this.normalizeMode(match?.[1] || null);
  }

  private buildNaturalReply(
    status: ChannelSetupAssistantStatus,
    selected: ChannelSetupAssistantOption | null,
  ): string {
    if (!selected) {
      return 'Me diga qual canal voce quer conectar: Telegram, Discord, Slack, WhatsApp, Signal, iMessage, Teams ou Email.';
    }

    if (status === 'needs_scaffold') {
      return `Posso preparar ${selected.label} em modo ${selected.setupMode}. Isso cria o scaffold seguro do .env sem preencher segredos por voce.`;
    }

    if (status === 'needs_config') {
      return `${selected.label} ja tem scaffold/modo definido. Ainda faltam: ${selected.missingEnvKeys.join(', ')}.`;
    }

    if (status === 'ready_to_validate') {
      return `${selected.label} parece configurado para o modo ${selected.setupMode}; o proximo passo e rodar o doctor para confirmar o runtime.`;
    }

    return `${selected.label} esta pronto no Channel Mesh. Posso rodar doctor ou teste de envio quando voce quiser.`;
  }

  private buildNextQuestions(
    status: ChannelSetupAssistantStatus,
    selected: ChannelSetupAssistantOption | null,
  ): string[] {
    if (!selected) {
      return ['Qual canal voce quer conectar primeiro?'];
    }
    if (status === 'needs_scaffold') {
      return [`Quer que eu aplique o scaffold seguro do ${selected.label} agora?`];
    }
    if (status === 'needs_config') {
      return [`Voce quer preencher as variaveis faltantes agora ou apenas deixar o scaffold pronto?`];
    }
    return [`Quer que eu rode o doctor do ${selected.label} agora?`];
  }

  private buildNextActions(
    status: ChannelSetupAssistantStatus,
    selected: ChannelSetupAssistantOption | null,
  ): ChannelSetupAssistantSession['nextActions'] {
    if (!selected) {
      return [{
        id: 'choose-channel',
        label: 'Escolher canal',
        command: 'Quero conectar ao Discord',
      }];
    }

    if (status === 'needs_scaffold') {
      return [{
        id: 'apply-scaffold',
        label: `Aplicar scaffold do ${selected.label}`,
        command: selected.commands.apply,
      }];
    }

    if (status === 'needs_config') {
      return [{
        id: 'fill-env',
        label: `Preencher variaveis do ${selected.label}`,
        command: selected.missingEnvKeys.join(', '),
      }];
    }

    return [{
      id: 'doctor',
      label: `Rodar doctor do ${selected.label}`,
      command: selected.commands.doctor,
    }];
  }

  private extractChannelIdFromText(text: string | null | undefined): string | null {
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    const aliases: Array<[PlatformKey, RegExp[]]> = [
      ['telegram', [/\btelegram\b/]],
      ['discord', [/\bdiscord\b/]],
      ['slack', [/\bslack\b/]],
      ['whatsapp', [/\bwhatsapp\b/, /\bwhats app\b/, /\bwpp\b/, /\bzap\b/]],
      ['instagram', [/\binstagram\b/, /\binsta\b/, /\big\b/, /\bdirect\b/, /\bdm do instagram\b/]],
      ['signal', [/\bsignal\b/]],
      ['imessage', [/\bimessage\b/, /\bi message\b/, /\bapple messages\b/]],
      ['teams', [/\bmicrosoft teams\b/, /\bteams\b/]],
      ['email', [/\be-mail\b/, /\bemail\b/, /\bmail\b/]],
    ];
    return aliases.find(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))?.[0] || null;
  }

  private resolveChannelId(value: string | null | undefined): PlatformKey | null {
    if (!value) {
      return null;
    }
    return normalizePlatformKey(String(value));
  }

  private normalizeMode(value: string | null | undefined): ChannelInstallMode | null {
    const normalized = String(value || '').trim().toLowerCase();
    const modes: ChannelInstallMode[] = [
      'native',
      'bridge',
      'stub',
      'cloud-api',
      'baileys',
      'meta-messaging',
      'signal-cli',
      'mac-bridge',
      'graph-bot',
      'local-outbox',
      'smtp-imap',
    ];
    return modes.find((mode) => mode === normalized) || null;
  }
}
