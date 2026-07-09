import type {
  IntegrationCatalogSnapshot,
  IntegrationCatalogEntry,
  IntegrationDetailSnapshot,
  IntegrationDoctorSnapshot,
  IntegrationHubMcpSnapshot,
  IntegrationInstallDraft,
  IntegrationHubProviderSnapshot,
} from '../contracts/IntegrationHubContract.js';
import { IntegrationActionService } from './IntegrationActionService.js';

import { IntegrationHealthService } from './IntegrationHealthService.js';
import { IntegrationInstallerService } from './IntegrationInstallerService.js';
import { ProviderControlPlaneService } from './ProviderControlPlaneService.js';
import { ProviderDoctorService } from './ProviderDoctorService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import { IntegrationRouterService } from './IntegrationRouterService.js';
import { McpCapabilityControlPlaneService } from './McpCapabilityControlPlaneService.js';
import { VendorLicenseGuardService } from './VendorLicenseGuardService.js';
import { VendorReleaseIndexService } from './VendorReleaseIndexService.js';

type IntegrationHubRuntime = {
  now?: () => Date;
  registryService?: IntegrationRegistryService;
  installerService?: IntegrationInstallerService;
  healthService?: IntegrationHealthService;
  actionService?: IntegrationActionService;
  routerService?: IntegrationRouterService;
  providerControlPlaneService?: ProviderControlPlaneService;
  providerDoctorService?: ProviderDoctorService;
  mcpCapabilityControlPlaneService?: McpCapabilityControlPlaneService;
  vendorReleaseIndexService?: Pick<VendorReleaseIndexService, 'buildSnapshot' | 'getEntry'>;
  vendorLicenseGuardService?: Pick<VendorLicenseGuardService, 'getDecision'>;
};

export class IntegrationHubService {
  private readonly now: () => Date;
  private readonly registryService: IntegrationRegistryService;
  private readonly installerService: IntegrationInstallerService;
  private readonly healthService: IntegrationHealthService;
  private readonly actionService: IntegrationActionService;
  private readonly routerService: IntegrationRouterService;
  private readonly providerControlPlaneService: ProviderControlPlaneService;
  private readonly providerDoctorService: ProviderDoctorService;
  private readonly mcpCapabilityControlPlaneService: McpCapabilityControlPlaneService;
  private readonly vendorReleaseIndexService: Pick<VendorReleaseIndexService, 'buildSnapshot' | 'getEntry'>;
  private readonly vendorLicenseGuardService: Pick<VendorLicenseGuardService, 'getDecision'>;

  constructor(runtime: IntegrationHubRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registryService = runtime.registryService || new IntegrationRegistryService();
    this.installerService = runtime.installerService || new IntegrationInstallerService();
    this.healthService = runtime.healthService || new IntegrationHealthService({
      installerService: this.installerService,
      registryService: this.registryService,
    });
    this.actionService = runtime.actionService || new IntegrationActionService({
      registryService: this.registryService,
      installerService: this.installerService,
      healthService: this.healthService,
    });
    this.vendorReleaseIndexService = runtime.vendorReleaseIndexService || new VendorReleaseIndexService();
    this.vendorLicenseGuardService = runtime.vendorLicenseGuardService || new VendorLicenseGuardService();
    this.routerService = runtime.routerService || new IntegrationRouterService({
      registryService: this.registryService,
      installerService: this.installerService,
      healthService: this.healthService,
    });
    this.providerControlPlaneService = runtime.providerControlPlaneService || new ProviderControlPlaneService();
    this.providerDoctorService = runtime.providerDoctorService || new ProviderDoctorService({
      providerControlPlane: this.providerControlPlaneService,
    });
    this.mcpCapabilityControlPlaneService =
      runtime.mcpCapabilityControlPlaneService
      || new McpCapabilityControlPlaneService();
  }

  public listCatalogEntries(): IntegrationCatalogEntry[] {
    return this.routerService.listCatalogEntries().map((entry) => ({
      ...entry,
      vendor: this.buildVendorState(entry.manifest.id),
    }));
  }

  public buildCatalogStatusSummary(): { total: number } {
    return {
      total: this.routerService.listCatalogEntries().length,
    };
  }

  public buildCatalogSnapshot(selectedId?: string | null): IntegrationCatalogSnapshot {
    const entries = this.listCatalogEntries();
    const featuredIds = entries
      .filter((entry) => ['gemini', 'openai', 'minimax', 'openrouter', 'AIGateway', 'zavorth-terminal', 'external-executor', 'ollama'].includes(entry.manifest.id))
      .slice(0, 6)
      .map((entry) => entry.manifest.id);
    const templateIds = this.registryService.getSuggestedTemplates().map((entry) => entry.id);
    const preferredSelectedId = this.resolveSelectedId(selectedId, entries);
    return {
      generatedAt: this.now().toISOString(),
      entries,
      featuredIds,
      templateIds,
      providers: this.buildProviderSnapshot(),
      mcp: this.buildMcpSnapshot(),
      vendors: this.vendorReleaseIndexService.buildSnapshot(),
      selected: preferredSelectedId ? this.buildIntegrationSnapshot(preferredSelectedId) : null,
    };
  }

  public buildIntegrationSnapshot(id: string): IntegrationDetailSnapshot | null {
    const manifest = this.registryService.getManifestById(id);
    if (!manifest) {
      return null;
    }

    const entries = this.listCatalogEntries();
    const catalogEntry = entries.find((entry) => entry.manifest.id === manifest.id) || null;
    return {
      manifest,
      installed: this.installerService.getInstalled(manifest.id),
      doctor: this.healthService.buildDoctorSnapshot(manifest.id),
      readiness: catalogEntry?.readiness || 'planned',
      storedSecretKeys: this.installerService.getStoredSecretKeys(manifest.id),
      actionPlan: this.actionService.buildActionPlan(manifest.id),
      actionMonitor: this.actionService.buildActionMonitor(manifest.id),
      vendor: this.buildVendorState(manifest.id),
    };
  }

  public buildDraft(input: {
    requestedId: string;
    requestedBy?: string | null;
    nickname?: string | null;
    selectedMode?: string | null;
    enabledCapabilities?: string[] | null;
    answers?: Record<string, string | string[] | boolean> | null;
    persist?: boolean;
  }): IntegrationInstallDraft {
    return this.installerService.buildDraft(input);
  }

  public getDoctorSnapshot(id: string): IntegrationDoctorSnapshot {
    return this.healthService.buildDoctorSnapshot(id);
  }

  public getDoctorSnapshots(): IntegrationDoctorSnapshot[] {
    return this.healthService.listDoctorSnapshots();
  }

  public getStoredSecretKeys(id: string): string[] {
    return this.installerService.getStoredSecretKeys(id);
  }

  public async executeGuidedAction(
    integrationId: string,
    actionId: string,
    options: {
      requestedBy?: string | null;
      workspace?: string | null;
    } = {},
  ) {
    return this.actionService.execute(integrationId, actionId, options);
  }

  public renderCatalogReport(): string {
    const entries = this.listCatalogEntries();
    const providers = this.buildProviderSnapshot();
    const featured = entries
      .filter((entry) => ['gemini', 'openai', 'minimax', 'openrouter', 'AIGateway', 'zavorth-terminal', 'external-executor', 'ollama'].includes(entry.manifest.id))
      .slice(0, 6);

    const lines = [
      'Zavorth Integration Hub',
      '',
      'Este hub mostra conectores reais, receitas guiadas e templates seguros para novas integracoes.',
      'Legenda:',
      '- pronto: o runtime ja enxerga a integracao',
      '- configurar: existe receita, mas ainda falta algo',
      '- template: serve para abrir um novo conector com seguranca',
      '',
      'Conectores em destaque:',
    ];

    lines.push(
      `Provider ativo: ${providers.activeProviderName}/${providers.activeModelName} | perfil sugerido: ${providers.recommendedProfile.label}`,
    );
    lines.push(`Providers prontos: ${providers.ready.map((entry) => entry.id).join(', ') || 'nenhum'}`);
    const mcpSummary = this.normalizeMcpSummary(this.buildMcpSnapshot());
    lines.push(`MCP conectado: ${mcpSummary.connected}/${mcpSummary.enabled} | tools: ${mcpSummary.toolCount}`);
    const vendors = this.vendorReleaseIndexService.buildSnapshot();
    lines.push(
      `Vendors: ${vendors.summary.total} total | updates: ${vendors.summary.updateAvailable} | review: ${vendors.summary.reviewRequired} | ativos: ${vendors.summary.live}`,
    );
    if (providers.needsConfiguration.length > 0) {
      lines.push(`Pedem configuracao: ${providers.needsConfiguration.map((entry) => entry.id).join(', ')}`);
    }
    if (providers.needsProbe.length > 0) {
      lines.push(`Pedem probe: ${providers.needsProbe.map((entry) => entry.id).join(', ')}`);
    }
    lines.push('');

    for (const entry of featured) {
      lines.push(`- ${this.formatCatalogEntry(entry)}`);
    }

    const templates = entries.filter((entry) => entry.manifest.category === 'template');
    if (templates.length > 0) {
      lines.push('', 'Templates uteis para servicos ainda nao suportados:');
      for (const entry of templates) {
        lines.push(`- ${entry.manifest.label}: ${entry.manifest.summary}`);
      }
    }

    lines.push('', 'Atalhos:');
    lines.push('- /integrations openrouter');
    lines.push('- /connect openrouter');
    lines.push('- npm run integrations:doctor');

    return lines.join('\n');
  }

  private buildProviderSnapshot(): IntegrationHubProviderSnapshot {
    const report = this.providerDoctorService.inspect({
      taskKind: 'code',
      taskSubtype: 'general',
      preferredZavorthBridgeModel: this.providerControlPlaneService.getCurrentModelForProvider('AIGateway'),
    });

    return {
      generatedAt: this.now().toISOString(),
      activeProviderName: report.activeProviderName,
      activeModelName: report.activeModelName,
      preferredZavorthBridgeModel: report.preferredZavorthBridgeModel,
      recommendedProfile: {
        id: report.recommendedProfile.profile.id,
        label: report.recommendedProfile.profile.label,
        providerName: report.recommendedProfile.strategy.providerName,
        modelName: report.recommendedProfile.strategy.modelName || null,
        fallbackOrder: [...report.recommendedProfile.strategy.fallbackOrder],
      },
      ready: report.readyProviders.map((entry) => this.mapProviderEntry(entry)),
      needsConfiguration: report.pendingConfigProviders.map((entry) => this.mapProviderEntry(entry)),
      needsProbe: report.probeProviders.map((entry) => this.mapProviderEntry(entry)),
      profiles: report.profiles.map((entry) => ({
        id: entry.id,
        label: entry.label,
        summary: entry.summary,
        preferredOrder: [...entry.preferredOrder],
      })),
      usageTargets: this.providerControlPlaneService.getUsageTargets(),
      recommendations: [...report.recommendations],
    };
  }

  private buildMcpSnapshot(): IntegrationHubMcpSnapshot {
    return this.mcpCapabilityControlPlaneService.buildSnapshot();
  }

  private normalizeMcpSummary(snapshot: IntegrationHubMcpSnapshot | null | undefined): IntegrationHubMcpSnapshot['summary'] {
    const summary = snapshot?.summary;
    return {
      total: Number(summary?.total || 0),
      enabled: Number(summary?.enabled || 0),
      connected: Number(summary?.connected || 0),
      failed: Number(summary?.failed || 0),
      disabled: Number(summary?.disabled || 0),
      stopped: Number(summary?.stopped || 0),
      toolCount: Number(summary?.toolCount || 0),
      capabilityCount: Number(summary?.capabilityCount || 0),
    };
  }

  private mapProviderEntry(report: ReturnType<ProviderDoctorService['inspect']>['providers'][number]) {
    return {
      id: report.id,
      label: report.label,
      effectiveProviderName: report.effectiveProviderName,
      mode: report.mode,
      readiness: report.readiness,
      currentModel: report.currentModel,
      summary: report.summary,
      issue: report.issue,
    };
  }

  public renderManifestReport(id: string): string {
    const manifest = this.registryService.getManifestById(id);
    if (!manifest) {
      return `Nao encontrei a integracao "${id}". Use /integrations para ver o catalogo.`;
    }

    const doctor = this.healthService.buildDoctorSnapshot(manifest.id);
    const installed = this.installerService.getInstalled(manifest.id);
    const lines = [
      `${manifest.label}`,
      '',
      manifest.summary,
      '',
      `Suporte: ${manifest.supportLevel}`,
      `Categoria: ${manifest.category}`,
      `Binding: ${manifest.binding.summary}`,
      `Status atual: ${doctor.status}`,
      `Modo padrao: ${manifest.defaultMode}`,
      `Capacidades: ${manifest.capabilities.join(', ')}`,
    ];

    if (installed) {
      lines.push(`Rascunho salvo: sim (${installed.status})`);
    }

    if (manifest.goodFor.length > 0) {
      lines.push(`Bom para: ${manifest.goodFor.join(' | ')}`);
    }

    const vendor = this.buildVendorState(manifest.id);
    if (vendor) {
      lines.push('', 'Vendor plane:');
      lines.push(`Lock atual: ${vendor.index.lockedCommit || 'n/d'}`);
      lines.push(`HEAD upstream: ${vendor.index.sourceHead || 'n/d'}`);
      lines.push(`Status do vendor: ${vendor.index.diff.summary}`);
      lines.push(`Politica de licenca: ${vendor.license.summary}`);
    }

    if (doctor.probe) {
      lines.push(
        `Probe real: ${doctor.probe.status} | ${doctor.probe.summary} | ${doctor.probe.detail}`,
      );
    }

    if (doctor.playbook?.steps?.length) {
      lines.push('', `Roteiro seguro: ${doctor.playbook.headline}`);
      lines.push(doctor.playbook.summary);
      for (const step of doctor.playbook.steps) {
        lines.push(`- [${step.status}] ${step.label}: ${step.detail}`);
      }
    }

    if (manifest.requirements.length > 0) {
      lines.push('', 'Requisitos principais:');
      for (const entry of manifest.requirements) {
        lines.push(`- ${entry.label}${entry.required ? '' : ' (opcional)'}: ${entry.description}`);
      }
    }

    if (manifest.safetyNotes.length > 0) {
      lines.push('', 'Notas de seguranca:');
      for (const note of manifest.safetyNotes) {
        lines.push(`- ${note}`);
      }
    }

    lines.push('', `Proximo passo sugerido: ${doctor.nextAction.command}`);
    lines.push(`Motivo: ${doctor.nextAction.reason}`);
    return lines.join('\n');
  }

  public renderConnectReport(input: {
    requestedId: string;
    requestedBy?: string | null;
    nickname?: string | null;
    selectedMode?: string | null;
    enabledCapabilities?: string[] | null;
    answers?: Record<string, string | string[] | boolean> | null;
    persist?: boolean;
  }): string {
    const draft = this.buildDraft(input);
    const lines = [
      `Conexao preparada: ${draft.manifest.label}`,
      '',
      draft.resolution.note,
      `Modo escolhido: ${draft.selectedMode}`,
      `Capacidades iniciais: ${draft.enabledCapabilities.join(', ')}`,
      `Nivel de suporte: ${draft.manifest.supportLevel}`,
      '',
      'O que o Zavorth entendeu:',
      `- binding: ${draft.manifest.binding.summary}`,
      `- status do rascunho: ${draft.installed.status}`,
    ];

    if (draft.unansweredQuestions.length > 0) {
      lines.push('', 'Perguntas que ainda faltam fechar:');
      for (const entry of draft.unansweredQuestions) {
        lines.push(`- ${entry.label}: ${entry.help}`);
      }
    }

    if (draft.missingRequirements.length > 0) {
      lines.push('', 'Requisitos ainda pendentes:');
      for (const entry of draft.missingRequirements) {
        lines.push(`- ${entry.label}: ${entry.description}`);
      }
    }

    if (draft.manifest.installSteps.length > 0) {
      lines.push('', 'Trilha guiada:');
      for (const entry of draft.manifest.installSteps.slice(0, 4)) {
        lines.push(`- ${entry.title}: ${entry.description}`);
      }
    }

    lines.push('', `Proximo passo: ${draft.nextAction.command}`);
    lines.push(`Motivo: ${draft.nextAction.reason}`);
    return lines.join('\n');
  }

  public renderDoctorReport(id?: string | null): string {
    if (id) {
      const snapshot = this.healthService.writeDoctorReport(id) as IntegrationDoctorSnapshot;
      return this.formatDoctorSnapshot(snapshot);
    }

    const snapshots = this.healthService.writeDoctorReport() as IntegrationDoctorSnapshot[];
    const lines = [
      'Doctor do Integration Hub',
      '',
      'Resumo rapido das integracoes conhecidas:',
    ];

    for (const snapshot of snapshots) {
      lines.push(`- ${snapshot.label}: ${snapshot.status} | ${snapshot.nextAction.reason}`);
    }

    lines.push('', 'Use /integrations <id> ou npm run integrations:doctor -- --id <id> para aprofundar.');
    return lines.join('\n');
  }

  private formatCatalogEntry(entry: IntegrationCatalogEntry): string {
    const prefix =
      entry.readiness === 'ready'
        ? 'pronto'
        : entry.manifest.category === 'template'
          ? 'template'
          : 'configurar';
    const vendorNote = entry.vendor
      ? ` | vendor: ${entry.vendor.index.diff.summary}`
      : '';
    return `${entry.manifest.label} [${prefix}] - ${entry.manifest.summary}${vendorNote}`;
  }

  private formatDoctorSnapshot(snapshot: IntegrationDoctorSnapshot): string {
    const lines = [
      `Doctor: ${snapshot.label}`,
      '',
      `Status: ${snapshot.status}`,
      `Binding: ${snapshot.binding.summary}`,
      `Configurado: ${snapshot.configured ? 'sim' : 'nao'}`,
    ];

    if (snapshot.selectedMode) {
      lines.push(`Modo: ${snapshot.selectedMode}`);
    }

    if (snapshot.enabledCapabilities.length > 0) {
      lines.push(`Capacidades: ${snapshot.enabledCapabilities.join(', ')}`);
    }

    if (snapshot.findings.length > 0) {
      lines.push('', 'Achados:');
      for (const finding of snapshot.findings) {
        lines.push(`- [${finding.level}] ${finding.title}: ${finding.detail}`);
      }
    }

    if (snapshot.probe) {
      lines.push('', `Ultimo probe real: ${snapshot.probe.status}`);
      lines.push(`Resumo: ${snapshot.probe.summary}`);
      lines.push(`Detalhe: ${snapshot.probe.detail}`);
    }

    if (snapshot.playbook?.steps?.length) {
      lines.push('', `Roteiro seguro: ${snapshot.playbook.headline}`);
      lines.push(snapshot.playbook.summary);
      for (const step of snapshot.playbook.steps) {
        lines.push(`- [${step.status}] ${step.label}: ${step.detail}`);
      }
    }

    lines.push('', `Proximo passo: ${snapshot.nextAction.command}`);
    lines.push(`Motivo: ${snapshot.nextAction.reason}`);
    return lines.join('\n');
  }

  private resolveSelectedId(selectedId: string | null | undefined, entries: IntegrationCatalogEntry[]): string | null {
    const resolved = this.registryService.resolveRequestedIntegration(selectedId);
    if (resolved.manifest) {
      return resolved.manifest.id;
    }

    const installed = entries.find((entry) => Boolean(entry.installed));
    if (installed) {
      return installed.manifest.id;
    }

    const ready = entries.find((entry) => entry.doctor.status === 'ok');
    if (ready) {
      return ready.manifest.id;
    }

    return entries[0]?.manifest.id || null;
  }

  private buildVendorState(id: string): IntegrationDetailSnapshot['vendor'] {
    const index = this.vendorReleaseIndexService.getEntry(id);
    const license = index ? this.vendorLicenseGuardService.getDecision(id) : null;
    if (!index || !license) {
      return null;
    }
    return {
      index,
      license,
    };
  }
}
