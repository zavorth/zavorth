import type {
  SkillCatalogBundle,
  SkillCatalogEntry,
} from '../skills/SkillCatalogContract.js';
import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import {
  SkillMcpSidecarService,
  type SkillMcpSidecarSnapshot,
} from './SkillMcpSidecarService.js';
import { VendorReleaseIndexService } from './VendorReleaseIndexService.js';

import {
  SkillCatalogApiService,
  type SkillCatalogApiQuery,
  type SkillCatalogApiSnapshot,
} from './SkillCatalogApiService.js';


import type {
  VendorLicenseDecision,
  VendorReleaseIndexEntry,
  VendorReleaseIndexSnapshot,
} from '../contracts/VendorPlaneContract.js';

export type SkillLibraryVendorCard = {
  vendorId: string;
  displayName: string;
  status: VendorReleaseIndexEntry['status'];
  ready: boolean;
  live: boolean;
  updateAvailable: boolean;
  baseUrl: string | null;
  summary: string;
  recommendedAction: string;
  actionCommand: string;
  licenseDecision: VendorLicenseDecision;
};

export type SkillLibrarySourceCard = {
  sourceId: string;
  label: string;
  trust: string;
  imported: number;
  local: number;
  licenses: string[];
  skills: string[];
};

export type SkillLibraryTrustCard = {
  trust: string;
  count: number;
  labels: string[];
};

export type SkillLibraryAction = {
  id: string;
  label: string;
  command: string;
  rationale: string;
};

export type SkillLibraryPresentationSnapshot = {
  generatedAt: string;
  catalog: SkillCatalogApiSnapshot;
  bridge: SkillCatalogApiSnapshot['bridge'] | null;
  mcp: SkillMcpSidecarSnapshot;
  bundles: SkillCatalogBundle[];
  sources: SkillLibrarySourceCard[];
  trust: SkillLibraryTrustCard[];
  vendors: SkillLibraryVendorCard[];
  actions: SkillLibraryAction[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

type SkillLibraryPresentationRuntime = {
  now?: () => Date;
  skillCatalogApiService?: Pick<SkillCatalogApiService, 'buildSnapshot'>;
  skillCatalogService?: Pick<SkillCatalogService, 'buildSnapshot'>;
  skillMcpSidecarService?: Pick<SkillMcpSidecarService, 'buildSnapshot'>;
  vendorReleaseIndexService?: Pick<VendorReleaseIndexService, 'buildSnapshot'>;
};

export class SkillLibraryPresentationService {
  private readonly now: () => Date;
  private readonly skillCatalogApiService: Pick<SkillCatalogApiService, 'buildSnapshot'>;
  private readonly skillCatalogService: Pick<SkillCatalogService, 'buildSnapshot'>;
  private readonly skillMcpSidecarService: Pick<SkillMcpSidecarService, 'buildSnapshot'>;
  private readonly vendorReleaseIndexService: Pick<VendorReleaseIndexService, 'buildSnapshot'>;

  constructor(runtime: SkillLibraryPresentationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillCatalogApiService = runtime.skillCatalogApiService || new SkillCatalogApiService();
    this.skillCatalogService = runtime.skillCatalogService || new SkillCatalogService();
    this.skillMcpSidecarService = runtime.skillMcpSidecarService || new SkillMcpSidecarService({
      skillCatalogApiService: this.skillCatalogApiService,
    });
    this.vendorReleaseIndexService = runtime.vendorReleaseIndexService || new VendorReleaseIndexService();
  }

  public buildSnapshot(input: SkillCatalogApiQuery = {}): SkillLibraryPresentationSnapshot {
    const catalog = this.skillCatalogApiService.buildSnapshot(input);
    const rawCatalog = this.skillCatalogService.buildSnapshot();
    const mcp = this.skillMcpSidecarService.buildSnapshot(input);
    const vendorIndex = this.vendorReleaseIndexService.buildSnapshot();
    const bundles = this.buildBundleCards(rawCatalog.bundles, catalog.entries);
    const sources = this.buildSourceCards(catalog.entries);
    const trust = this.buildTrustCards(catalog.entries);
    const vendors = vendorIndex.entries.map((entry) => this.buildVendorCard(entry));
    const actions = this.buildActions(catalog, vendors);

    return {
      generatedAt: this.now().toISOString(),
      catalog,
      bridge: catalog.bridge || null,
      mcp,
      bundles,
      sources,
      trust,
      vendors,
      actions,
      narrative: {
        headline: 'Biblioteca operational de skills',
        operatorSummary: `${catalog.summary.visible}/${catalog.summary.total} skill(s) visible, `
          + `${bundles.length} bundle(s) relevantes, ${catalog.summary.readyRecipes}/${catalog.summary.recipes} `
          + `recipe(s) ready e ${vendors.filter((vendor) => vendor.ready).length}/${vendors.length} vendor(s) ready.`,
        nextAction: this.resolveNextAction(catalog, vendors),
      },
    };
  }

  public renderReport(input: SkillCatalogApiQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Skill library do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      `next passo sugerido: ${snapshot.narrative.nextAction}`,
      '',
      `Skills: ${snapshot.catalog.summary.total} total | visible: ${snapshot.catalog.summary.visible} | importadas: ${snapshot.catalog.summary.imported} | locais: ${snapshot.catalog.summary.local}.`,
      `Recipes: ${snapshot.catalog.summary.readyRecipes}/${snapshot.catalog.summary.recipes} ready | recommendations: ${snapshot.catalog.summary.recommendations}.`,
      snapshot.bridge ? `Bridge: ${snapshot.bridge.summary.ready} ready | ${snapshot.bridge.summary.approvalRequired} approval | ${snapshot.bridge.summary.blocked} blocked.`
        : 'Bridge: without snapshot nesta surface.',
      `MCP: ${snapshot.mcp.summary.tools} tool(s) | ${snapshot.mcp.summary.resources} resource(s).`,
    ];

    if (snapshot.catalog.query) {
      lines.push(`Filtro current: ${snapshot.catalog.query}.`);
    }
    if (snapshot.catalog.recommendFor) {
      lines.push(`Objetivo current: ${snapshot.catalog.recommendFor}.`);
    }

    if (snapshot.catalog.selected) {
      lines.push(
        '',
        `Skill at foco: ${snapshot.catalog.selected.name}`,
        snapshot.catalog.selected.description,
        `source: ${snapshot.catalog.selected.sourceLabel || snapshot.catalog.selected.sourceId || 'local'} | trust: ${snapshot.catalog.selected.sourceTrust || 'n/d'} | licenca: ${snapshot.catalog.selected.license || 'n/d'}.`,
        `Support files: ${snapshot.catalog.selected.supportFileCount} | bundle tags: ${snapshot.catalog.selected.bundleTags.join(', ') || 'none'}.`,
      );
    }

    if (snapshot.catalog.selectedRecipe) {
      lines.push(
        '',
        `Recipe at foco: ${snapshot.catalog.selectedRecipe.label}`,
        snapshot.catalog.selectedRecipe.summary,
        `Skills: ${snapshot.catalog.selectedRecipe.skillLabels.join(', ') || snapshot.catalog.selectedRecipe.skillIds.join(', ')}.`,
      );
    }

    if (snapshot.bundles.length > 0) {
      lines.push('', 'Bundles featured:');
      for (const bundle of snapshot.bundles.slice(0, 4)) {
        lines.push(`- ${bundle.tag}: ${bundle.skillCount} skill(s) (${bundle.skillNames.slice(0, 3).join(', ')})`);
      }
    }

    if (snapshot.sources.length > 0) {
      lines.push('', 'Sources e trust:');
      for (const source of snapshot.sources.slice(0, 4)) {
        lines.push(
          `- ${source.label}: trust ${source.trust} | importadas ${source.imported} | locais ${source.local} | licencas ${source.licenses.join(', ') || 'n/d'}.`,
        );
      }
    }

    if (snapshot.vendors.length > 0) {
      lines.push('', 'Vendors de apoio:');
      for (const vendor of snapshot.vendors.slice(0, 4)) {
        lines.push(
          `- ${vendor.displayName}: ${vendor.summary} shortcut: ${vendor.actionCommand}.`,
        );
      }
    }

    if (snapshot.actions.length > 0) {
      lines.push('', 'Actions sugeridas:');
      for (const action of snapshot.actions.slice(0, 6)) {
        lines.push(`- ${action.label}: ${action.command} (${action.rationale})`);
      }
    }

    return lines.join('\n');
  }

  private buildBundleCards(
    bundles: SkillCatalogBundle[],
    visibleEntries: SkillCatalogEntry[],
  ): SkillCatalogBundle[] {
    if (visibleEntries.length === 0) {
      return bundles.slice(0, 4);
    }

    const visibleNames = new Set(visibleEntries.map((entry) => entry.name));
    return bundles
      .map((bundle) => ({
        ...bundle,
        skillNames: bundle.skillNames.filter((name) => visibleNames.has(name)),
      }))
      .filter((bundle) => bundle.skillNames.length > 0)
      .map((bundle) => ({
        ...bundle,
        skillCount: bundle.skillNames.length,
      }))
      .sort((left, right) => {
        if (right.skillCount !== left.skillCount) {
          return right.skillCount - left.skillCount;
        }
        return left.tag.localeCompare(right.tag, 'en-US');
      });
  }

  private buildSourceCards(entries: SkillCatalogEntry[]): SkillLibrarySourceCard[] {
    const sourceMap = new Map<string, SkillLibrarySourceCard>();

    for (const entry of entries) {
      const sourceId = String(entry.sourceId || 'local').trim() || 'local';
      if (!sourceMap.has(sourceId)) {
        sourceMap.set(sourceId, {
          sourceId,
          label: entry.sourceLabel || sourceId,
          trust: entry.sourceTrust || 'unknown',
          imported: 0,
          local: 0,
          licenses: [],
          skills: [],
        });
      }
      const card = sourceMap.get(sourceId);
      if (!card) {
        continue;
      }
      if (entry.imported) {
        card.imported += 1;
      } else {
        card.local += 1;
      }
      if (entry.license && !card.licenses.includes(entry.license)) {
        card.licenses.push(entry.license);
      }
      card.skills.push(entry.name);
    }

    return Array.from(sourceMap.values())
      .map((card) => ({
        ...card,
        licenses: card.licenses.slice().sort((left, right) => left.localeCompare(right, 'en-US')),
        skills: card.skills.slice().sort((left, right) => left.localeCompare(right, 'en-US')),
      }))
      .sort((left, right) => {
        const leftCount = left.imported + left.local;
        const rightCount = right.imported + right.local;
        if (rightCount !== leftCount) {
          return rightCount - leftCount;
        }
        return left.label.localeCompare(right.label, 'en-US');
      });
  }

  private buildTrustCards(entries: SkillCatalogEntry[]): SkillLibraryTrustCard[] {
    const trustOrder = ['trusted', 'review', 'blocked', 'unknown'];
    const grouped = new Map<string, string[]>();

    for (const entry of entries) {
      const trust = entry.sourceTrust || 'unknown';
      if (!grouped.has(trust)) {
        grouped.set(trust, []);
      }
      grouped.get(trust)?.push(entry.name);
    }

    return trustOrder
      .filter((trust) => grouped.has(trust))
      .map((trust) => ({
        trust,
        count: grouped.get(trust)?.length || 0,
        labels: (grouped.get(trust) || []).slice().sort((left, right) => left.localeCompare(right, 'en-US')),
      }));
  }

  private buildVendorCard(entry: VendorReleaseIndexEntry): SkillLibraryVendorCard {
    return {
      vendorId: entry.vendorId,
      displayName: entry.displayName,
      status: entry.status,
      ready: entry.ready,
      live: entry.live,
      updateAvailable: entry.updateAvailable,
      baseUrl: entry.baseUrl,
      summary: this.buildVendorSummary(entry),
      recommendedAction: entry.licenseDecision.recommendedAction,
      actionCommand: this.resolveVendorCommand(entry),
      licenseDecision: entry.licenseDecision,
    };
  }

  private buildVendorSummary(entry: VendorReleaseIndexEntry): string {
    const baseStatus = [
      entry.ready ? 'ready' : (entry.live ? 'warming-up' : 'offline'),
      entry.updateAvailable ? 'update available' : 'without update pending',
    ].join(' | ');
    const complement = entry.syncSummary || entry.healthSummary || entry.diff.summary || entry.licenseDecision.summary;
    return `${baseStatus}. ${complement}`;
  }

  private buildActions(
    catalog: SkillCatalogApiSnapshot,
    vendors: SkillLibraryVendorCard[],
  ): SkillLibraryAction[] {
    const actions: SkillLibraryAction[] = [];
    const pushAction = (action: SkillLibraryAction) => {
      if (!actions.some((entry) => entry.command === action.command)) {
        actions.push(action);
      }
    };

    pushAction({
      id: 'skills-library',
      label: 'Abrir biblioteca',
      command: '/skills library',
      rationale: 'Shows bundles, sources, trust, and vendors in one plan.',
    });

    if (catalog.selected) {
      pushAction({
        id: 'skills-plan-selected',
        label: 'Assemble skill plan',
        command: `/skills plan ${catalog.selected.name}`,
        rationale: 'Transforms the skill into an operational plan with next steps.',
      });
      pushAction({
        id: 'skills-mcp-selected',
        label: 'Abrir MCP da skill',
        command: `/skills mcp ${catalog.selected.name}`,
        rationale: 'Mostra tools e resources MCP ligados a essa skill.',
      });
      const bridgeDryRun = catalog.bridge?.selected?.actions.find((action) => action.kind === 'dry-run') || null;
      if (bridgeDryRun) {
        pushAction({
          id: 'skills-bridge-dry-run',
          label: 'Dry-run pelo bridge',
          command: bridgeDryRun.command,
          rationale: bridgeDryRun.reason,
        });
      }
    }

    if (catalog.selectedRecipe) {
      pushAction({
        id: 'skills-plan-recipe',
        label: 'Preparar recipe',
        command: `/skills plan recipe ${catalog.selectedRecipe.id}`,
        rationale: 'Organiza os passos da recipe at ordem operational.',
      });
    }

    const topRecommendation = catalog.recommendations[0] || null;
    if (topRecommendation && topRecommendation.kind === 'recipe') {
      pushAction({
        id: 'skills-plan-recommendation',
        label: 'Seguir recipe recommended',
        command: `/skills plan recipe ${topRecommendation.id}`,
        rationale: `Follows the current recommendation: ${topRecommendation.label}.`,
      });
    } else if (topRecommendation) {
      pushAction({
        id: 'skills-plan-recommendation',
        label: 'Explorar skill recommended',
        command: `/skills plan ${topRecommendation.label}`,
        rationale: `Follows the current recommendation: ${topRecommendation.label}.`,
      });
    }

    for (const vendor of vendors.filter((entry) => entry.updateAvailable || !entry.ready).slice(0, 2)) {
      pushAction({
        id: `vendor:${vendor.vendorId}`,
        label: `Checar ${vendor.displayName}`,
        command: vendor.actionCommand,
        rationale: vendor.updateAvailable ? 'Existe update pending para este vendor.'
          : 'This vendor is not ready in the current runtime yet.',
      });
    }

    return actions;
  }

  private resolveNextAction(
    catalog: SkillCatalogApiSnapshot,
    vendors: SkillLibraryVendorCard[],
  ): string {
    if (catalog.selectedRecipe) {
      return `/skills plan recipe ${catalog.selectedRecipe.id}`;
    }
    if (catalog.selected) {
      return `/skills plan ${catalog.selected.name}`;
    }
    const pendingVendor = vendors.find((vendor) => vendor.updateAvailable || !vendor.ready);
    if (pendingVendor) {
      return pendingVendor.actionCommand;
    }
    const recommendation = catalog.recommendations[0] || null;
    if (recommendation) {
      return recommendation.kind === 'recipe'
        ? `/skills plan recipe ${recommendation.id}`
        : `/skills plan ${recommendation.label}`;
    }
    return '/skills mcp';
  }

  private resolveVendorCommand(entry: VendorReleaseIndexEntry): string {
    if (entry.vendorId === 'AIGateway') {
      return entry.updateAvailable ? '/AIGateway sync' : '/AIGateway status';
    }
    if (entry.vendorId === 'zavorth-terminal') {
      return '/integrations zavorth-terminal';
    }
    return `/integrations ${entry.vendorId}`;
  }
}
