import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { ZavorthPlatformRegistryService } from './ZavorthPlatformRegistryService.js';
import { logger } from '../logger.js';

type EcosystemRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  platformRegistryService?: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
};

type EcosystemPosture = 'healthy' | 'attention' | 'critical';

type ZavorthGuideId = 'client' | 'node' | 'plugin' | 'recipe';

export type ZavorthEcosystemControlPlaneCard = {
  id: 'sdk' | 'guides' | 'registry' | 'publish' | 'recipes' | 'examples';
  label: string;
  posture: EcosystemPosture;
  summary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthEcosystemGuide = {
  id: ZavorthGuideId;
  label: string;
  path: string;
  exists: boolean;
  summary: string;
  command: string | null;
};

export type ZavorthEcosystemPublishArtifact = {
  file: string;
  packageId: string;
  releaseId: string;
  version: string;
  preparedAt: string | null;
  uploadStatus: 'prepared' | 'published' | 'unknown';
  fileCount: number;
  signature: string | null;
  validationWarnings: number;
};

export type ZavorthEcosystemControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  selectedId: string | null;
  query: string | null;
  summary: {
    posture: EcosystemPosture;
    registryEntries: number;
    collections: number;
    recipes: number;
    readyEntries: number;
    reviewPending: number;
    sdkTypescriptReady: boolean;
    sdkPythonReady: boolean;
    sdkFilesReady: number;
    sdkFilesExpected: number;
    guidesReady: number;
    guidesExpected: number;
    clientExamples: number;
    nodeExamples: number;
    publishArtifacts: number;
    publishedArtifacts: number;
    preparedArtifacts: number;
    recipeCoverageReady: number;
    recipeCoverageMissing: number;
    recommendedActions: number;
  };
  cards: ZavorthEcosystemControlPlaneCard[];
  guides: ZavorthEcosystemGuide[];
  publishArtifacts: ZavorthEcosystemPublishArtifact[];
  actions: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warn' | 'critical';
    reason: string;
    command: string | null;
  }>;
  sourceSnapshots: {
    platform: any;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

type FileReadinessSummary = {
  ready: number;
  expected: number;
  allReady: boolean;
};

export class ZavorthEcosystemControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly platformRegistry: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly publishDir: string;

  constructor(runtime: EcosystemRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.platformRegistry = runtime.platformRegistryService || new ZavorthPlatformRegistryService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.publishDir = path.resolve(this.workspaceRoot, 'data', 'runtime', 'platform-publish');
  }

  public buildSnapshot(input: {
    selectedId?: string | null;
    query?: string | null;
  } = {}): ZavorthEcosystemControlPlaneSnapshot {
    const selectedId = this.nullableText(input.selectedId);
    const query = this.nullableText(input.query);
    const platform = this.platformRegistry.buildSnapshot({
      selectedId,
      query,
    });
    const guides = this.readGuides();
    const typescriptSdk = this.readTypeScriptSdk();
    const pythonSdk = this.readPythonSdk();
    const sdkSummary = this.summarizeFileReadiness([
      ...typescriptSdk.files,
      ...pythonSdk.files,
    ]);
    const examples = this.readExamples();
    const publishArtifacts = this.readPublishArtifacts();
    const recipeCoverageReady = Array.isArray(platform?.recipes)
      ? platform.recipes.filter((entry: any) => Number(entry?.missingCount || 0) === 0).length
      : 0;
    const recipeCoverageMissing = Array.isArray(platform?.recipes)
      ? platform.recipes.reduce((sum: number, entry: any) => sum + (Number(entry?.missingCount || 0) || 0), 0)
      : 0;
    const cards = this.buildCards({
      platform,
      sdkSummary,
      guides,
      publishArtifacts,
      examples,
      recipeCoverageReady,
      recipeCoverageMissing,
      typescriptSdkReady: typescriptSdk.ready,
      pythonSdkReady: pythonSdk.ready,
    });
    const actions = this.buildActions({
      platform,
      sdkSummary,
      guides,
      publishArtifacts,
      recipeCoverageMissing,
      typescriptSdkReady: typescriptSdk.ready,
      pythonSdkReady: pythonSdk.ready,
    });
    const summary = {
      posture: this.resolvePosture(cards),
      registryEntries: Number(platform?.summary?.total || 0) || 0,
      collections: Number(platform?.summary?.collections || 0) || 0,
      recipes: Number(platform?.summary?.recipes || 0) || 0,
      readyEntries: Number(platform?.summary?.ready || 0) || 0,
      reviewPending: Number(platform?.summary?.reviewPending || 0) || 0,
      sdkTypescriptReady: typescriptSdk.ready,
      sdkPythonReady: pythonSdk.ready,
      sdkFilesReady: sdkSummary.ready,
      sdkFilesExpected: sdkSummary.expected,
      guidesReady: guides.filter((entry) => entry.exists).length,
      guidesExpected: guides.length,
      clientExamples: examples.clientExamples,
      nodeExamples: examples.nodeExamples,
      publishArtifacts: publishArtifacts.length,
      publishedArtifacts: publishArtifacts.filter((entry) => entry.uploadStatus === 'published').length,
      preparedArtifacts: publishArtifacts.filter((entry) => entry.uploadStatus === 'prepared').length,
      recipeCoverageReady,
      recipeCoverageMissing,
      recommendedActions: actions.length,
    };

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      selectedId,
      query,
      summary,
      cards,
      guides,
      publishArtifacts,
      actions,
      sourceSnapshots: {
        platform,
      },
      narrative: {
        headline: 'Ecosystem: Ecossistema, SDKs e third-party platform',
        operatorSummary:
          `${summary.registryEntries} item(ns) no platform plane, `
          + `${summary.sdkFilesReady}/${summary.sdkFilesExpected} arquivo(s)-chave dos SDKs prontos, `
          + `${summary.guidesReady}/${summary.guidesExpected} guia(s) operacionais publicados e `
          + `${summary.publishArtifacts} artefato(s) de publish inspecionavel(is).`,
        nextAction: actions[0]?.label || 'Revisar o catalogo publico e validar os SDKs oficiais.',
      },
    };
  }

  public renderReport(input: {
    selectedId?: string | null;
    query?: string | null;
  } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Ecosystem: Ecossistema, SDKs e third-party platform',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Registry: ${snapshot.summary.registryEntries} entrada(s), ${snapshot.summary.collections} colecao(oes), ${snapshot.summary.recipes} recipe(s), ${snapshot.summary.reviewPending} item(ns) em review.`,
      `SDKs: TypeScript ${snapshot.summary.sdkTypescriptReady ? 'pronto' : 'pendente'} | Python ${snapshot.summary.sdkPythonReady ? 'pronto' : 'pendente'} | arquivos ${snapshot.summary.sdkFilesReady}/${snapshot.summary.sdkFilesExpected}.`,
      `Guias: ${snapshot.summary.guidesReady}/${snapshot.summary.guidesExpected} publicados.`,
      `Examples: ${snapshot.summary.clientExamples} client(s) | ${snapshot.summary.nodeExamples} node(s).`,
      `Publish: ${snapshot.summary.publishArtifacts} artefato(s), ${snapshot.summary.publishedArtifacts} publicado(s), ${snapshot.summary.preparedArtifacts} preparado(s).`,
      `Recipes: ${snapshot.summary.recipeCoverageReady} pronta(s) | missing targets: ${snapshot.summary.recipeCoverageMissing}.`,
      '',
      'Cards operacionais:',
      ...snapshot.cards.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.guides.length > 0) {
      lines.push(
        '',
        'Guias por tipo:',
        ...snapshot.guides.map((entry) =>
          `- ${entry.label}: ${entry.exists ? 'publicado' : 'pendente'} | ${entry.summary}`),
      );
    }
    return lines.join('\n');
  }

  private buildCards(input: {
    platform: any;
    sdkSummary: FileReadinessSummary;
    guides: ZavorthEcosystemGuide[];
    publishArtifacts: ZavorthEcosystemPublishArtifact[];
    examples: { clientExamples: number; nodeExamples: number };
    recipeCoverageReady: number;
    recipeCoverageMissing: number;
    typescriptSdkReady: boolean;
    pythonSdkReady: boolean;
  }): ZavorthEcosystemControlPlaneCard[] {
    const syncStatus = this.text(input.platform?.catalogSync?.status, 'disabled');
    const reviewPending = Number(input.platform?.summary?.reviewPending || 0) || 0;
    const guidesReady = input.guides.filter((entry) => entry.exists).length;
    return [
      {
        id: 'sdk',
        label: 'SDKs oficiais',
        posture: input.sdkSummary.allReady && input.typescriptSdkReady && input.pythonSdkReady ? 'healthy' : 'attention',
        summary: `TypeScript ${input.typescriptSdkReady ? 'pronto' : 'pendente'} | Python ${input.pythonSdkReady ? 'pronto' : 'pendente'} | ${input.sdkSummary.ready}/${input.sdkSummary.expected} arquivo(s)-chave prontos.`,
        nextAction: input.sdkSummary.allReady
          ? 'Rodar o check oficial dos SDKs antes do proximo release.'
          : 'Completar os arquivos faltantes dos SDKs oficiais.',
        command: 'npm run sdk:check',
      },
      {
        id: 'guides',
        label: 'Guias de integracao',
        posture: guidesReady === input.guides.length ? 'healthy' : 'attention',
        summary: `${guidesReady}/${input.guides.length} guia(s) publicados para client, node, plugin e recipe.`,
        nextAction: guidesReady === input.guides.length
          ? 'Revisar os guias junto com o contrato publico.'
          : 'Publicar os guias faltantes por tipo de integrador.',
        command: '/ecosystem',
      },
      {
        id: 'registry',
        label: 'Registry e catalogo publico',
        posture: syncStatus === 'failed'
          ? 'critical'
          : (syncStatus === 'stale' || syncStatus === 'never-synced' || reviewPending > 0 ? 'attention' : 'healthy'),
        summary: `${Number(input.platform?.summary?.total || 0) || 0} entrada(s), ${Number(input.platform?.summary?.collections || 0) || 0} colecao(oes), ${Number(input.platform?.summary?.recipes || 0) || 0} recipe(s) | sync ${syncStatus}.`,
        nextAction: syncStatus === 'ready'
          ? 'Usar o catalogo como fonte oficial para terceiros.'
          : 'Sincronizar o registry remoto e revisar o estado do catalogo.',
        command: '/platform sync',
      },
      {
        id: 'publish',
        label: 'Publish e provenance',
        posture: input.publishArtifacts.some((entry) => entry.validationWarnings > 0) ? 'attention' : 'healthy',
        summary: input.publishArtifacts.length > 0
          ? `${input.publishArtifacts.length} artefato(s) de publish inspecionavel(is) | ${input.publishArtifacts.filter((entry) => entry.uploadStatus === 'published').length} publicado(s).`
          : 'Nenhum publish recente salvo ainda; o fluxo fica pronto assim que um pacote for empacotado.',
        nextAction: input.publishArtifacts.length > 0
          ? 'Inspecionar o ultimo bundle antes de promover para registry remoto.'
          : 'Publicar um pacote de exemplo para validar provenance, assinatura e inventario.',
        command: '/platform publish <pasta>',
      },
      {
        id: 'recipes',
        label: 'Recipes e cobertura',
        posture: input.recipeCoverageMissing > 0 ? 'attention' : 'healthy',
        summary: `${input.recipeCoverageReady} recipe(s) sem alvo faltando | missing targets: ${input.recipeCoverageMissing}.`,
        nextAction: input.recipeCoverageMissing > 0
          ? 'Fechar alvos faltantes das recipes antes de promover onboarding de terceiros.'
          : 'Usar as recipes como trilhas publicas de integracao.',
        command: '/platform recipe:<id>',
      },
      {
        id: 'examples',
        label: 'Examples publicos',
        posture: input.examples.clientExamples > 0 && input.examples.nodeExamples > 0 ? 'healthy' : 'attention',
        summary: `${input.examples.clientExamples} example(s) de client | ${input.examples.nodeExamples} example(s) de node.`,
        nextAction: input.examples.clientExamples > 0 && input.examples.nodeExamples > 0
          ? 'Manter exemplos alinhados ao contrato REST/SDK.'
          : 'Adicionar os exemplos publicos que ainda faltarem.',
        command: '/ecosystem',
      },
    ];
  }

  private buildActions(input: {
    platform: any;
    sdkSummary: FileReadinessSummary;
    guides: ZavorthEcosystemGuide[];
    publishArtifacts: ZavorthEcosystemPublishArtifact[];
    recipeCoverageMissing: number;
    typescriptSdkReady: boolean;
    pythonSdkReady: boolean;
  }): ZavorthEcosystemControlPlaneSnapshot['actions'] {
    const actions: ZavorthEcosystemControlPlaneSnapshot['actions'] = [];
    const syncStatus = this.text(input.platform?.catalogSync?.status, 'disabled');
    if (!input.sdkSummary.allReady || !input.typescriptSdkReady || !input.pythonSdkReady) {
      actions.push({
        id: 'sdk-check',
        label: 'Rodar o check oficial dos SDKs',
        severity: 'warn',
        reason: 'Os SDKs ou seus arquivos de suporte ainda nao estao completamente prontos.',
        command: 'npm run sdk:check',
      });
    }
    if (input.guides.some((entry) => !entry.exists)) {
      actions.push({
        id: 'guides-missing',
        label: 'Fechar os guias de integraction faltantes',
        severity: 'warn',
        reason: 'Terceiros ainda nao conseguem seguir todos os caminhos com docs dedicadas.',
        command: null,
      });
    }
    if (['failed', 'stale', 'never-synced'].includes(syncStatus)) {
      actions.push({
        id: 'platform-sync',
        label: 'Sincronizar o registry remoto',
        severity: syncStatus === 'failed' ? 'critical' : 'warn',
        reason: this.text(input.platform?.catalogSync?.summary, 'O registry remoto nao esta pronto.') || 'O registry remoto nao esta pronto.',
        command: '/platform sync',
      });
    }
    if (input.recipeCoverageMissing > 0) {
      actions.push({
        id: 'recipe-coverage',
        label: 'Revisar recipes com targets faltando',
        severity: 'warn',
        reason: `${input.recipeCoverageMissing} target(s) ainda faltam no recipe plane publico.`,
        command: '/platform recipe:<id>',
      });
    }
    if (input.publishArtifacts.length === 0) {
      actions.push({
        id: 'publish-sample',
        label: 'Publicar um pacote do ecossistema em modo preparado',
        severity: 'info',
        reason: 'Ainda nao existe bundle recente salvo para validar provenance e inventario.',
        command: '/platform publish <pasta>',
      });
    }
    return actions.slice(0, 8);
  }

  private resolvePosture(cards: ZavorthEcosystemControlPlaneCard[]): EcosystemPosture {
    if (cards.some((entry) => entry.posture === 'critical')) {
      return 'critical';
    }
    if (cards.some((entry) => entry.posture === 'attention')) {
      return 'attention';
    }
    return 'healthy';
  }

  private readTypeScriptSdk(): { ready: boolean; files: Array<{ path: string; exists: boolean }> } {
    const files = [
      'sdk/typescript/src/index.ts',
      'sdk/typescript/src/ZavorthClient.ts',
      'sdk/typescript/src/types.ts',
      'sdk/typescript/tsconfig.json',
    ].map((relativePath) => this.readRequiredFile(relativePath));
    return {
      ready: files.every((entry) => entry.exists),
      files,
    };
  }

  private readPythonSdk(): { ready: boolean; files: Array<{ path: string; exists: boolean }> } {
    const files = [
      'sdk/python/zavorth/__init__.py',
      'sdk/python/zavorth/client.py',
      'sdk/python/README.md',
      'sdk/python/pyproject.toml',
    ].map((relativePath) => this.readRequiredFile(relativePath));
    return {
      ready: files.every((entry) => entry.exists),
      files,
    };
  }

  private readGuides(): ZavorthEcosystemGuide[] {
    return [
      {
        id: 'client',
        label: 'Guia de client',
        path: 'docs/platform/integrar-client.md',
        exists: this.fileExists('docs/platform/integrar-client.md'),
        summary: 'Como usar o REST v1 e os SDKs sem depender de codigo interno.',
        command: null,
      },
      {
        id: 'node',
        label: 'Guia de node',
        path: 'docs/platform/registrar-node.md',
        exists: this.fileExists('docs/platform/registrar-node.md'),
        summary: 'Como registrar um node/headless host no Zavorth.',
        command: null,
      },
      {
        id: 'plugin',
        label: 'Guia de plugin',
        path: 'docs/platform/publicar-plugin.md',
        exists: this.fileExists('docs/platform/publicar-plugin.md'),
        summary: 'Como empacotar, validar e publicar plugins/extensoes.',
        command: '/platform publish <pasta>',
      },
      {
        id: 'recipe',
        label: 'Guia de recipe',
        path: 'docs/platform/usar-recipe.md',
        exists: this.fileExists('docs/platform/usar-recipe.md'),
        summary: 'Como consumir recipes do ecossistema e fechar targets faltantes.',
        command: '/platform recipe:<id>',
      },
    ];
  }

  private readExamples(): { clientExamples: number; nodeExamples: number } {
    return {
      clientExamples: this.countFilesUnder('examples/clients', ['.ts', '.js', '.py']),
      nodeExamples: this.countFilesUnder('examples/nodes', ['.ts', '.js', '.py']),
    };
  }

  private readPublishArtifacts(): ZavorthEcosystemPublishArtifact[] {
    if (!this.existsSync(this.publishDir)) {
      return [];
    }
    const packageDirs = this.readdirSync(this.publishDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(this.publishDir, entry.name));
    const files = packageDirs.flatMap((directory) =>
      this.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => path.join(directory, entry.name)),
    );
    return files
      .map((filePath) => this.readPublishArtifact(filePath))
      .filter((entry): entry is ZavorthEcosystemPublishArtifact => Boolean(entry))
      .sort((left, right) => {
        const leftTime = left.preparedAt ? Date.parse(left.preparedAt) : 0;
        const rightTime = right.preparedAt ? Date.parse(right.preparedAt) : 0;
        return rightTime - leftTime;
      })
      .slice(0, 12);
  }

  private readPublishArtifact(filePath: string): ZavorthEcosystemPublishArtifact | null {
    try {
      const raw = String(this.readFileSync(filePath, 'utf8') || '');
      const parsed = JSON.parse(raw) as Record<string, any>;
      const warnings = Array.isArray(parsed?.validation?.warnings)
        ? parsed.validation.warnings.length
        : 0;
      return {
        file: path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/'),
        packageId: this.text(parsed.packageId, 'unknown-package'),
        releaseId: this.text(parsed.releaseId, 'unknown-release'),
        version: this.text(parsed.version, '0.0.0'),
        preparedAt: this.nullableText(parsed.preparedAt),
        uploadStatus: this.normalizeUploadStatus(parsed.uploadStatus),
        fileCount: Number(parsed.fileCount || 0) || 0,
        signature: this.nullableText(parsed.signature),
        validationWarnings: warnings,
      };
    } catch (error: unknown) {logger.warn('[Zavorth Ecosystem Control Plane] parsing failed', error); return null; }
  }

  private summarizeFileReadiness(files: Array<{ path: string; exists: boolean }>): FileReadinessSummary {
    const ready = files.filter((entry) => entry.exists).length;
    return {
      ready,
      expected: files.length,
      allReady: files.length > 0 && ready === files.length,
    };
  }

  private readRequiredFile(relativePath: string): { path: string; exists: boolean } {
    return {
      path: relativePath,
      exists: this.fileExists(relativePath),
    };
  }

  private countFilesUnder(relativeDir: string, allowedExtensions: string[]): number {
    const directory = path.resolve(this.workspaceRoot, relativeDir);
    if (!this.existsSync(directory)) {
      return 0;
    }
    const entries = this.readdirSync(directory, { withFileTypes: true });
    return entries.filter((entry) =>
      entry.isFile() && allowedExtensions.includes(path.extname(entry.name).toLowerCase()),
    ).length;
  }

  private fileExists(relativePath: string): boolean {
    return this.existsSync(path.resolve(this.workspaceRoot, relativePath));
  }

  private normalizeUploadStatus(value: unknown): 'prepared' | 'published' | 'unknown' {
    const normalized = this.text(value, '').toLowerCase();
    if (normalized === 'published') {
      return 'published';
    }
    if (normalized === 'prepared') {
      return 'prepared';
    }
    return 'unknown';
  }

  private text(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
