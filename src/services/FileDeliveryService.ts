import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../config/index.js';
import { PolicyEngine } from '../security/PolicyEngine.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import type {
  FileDeliveryPlan,
  FileDeliveryPrepareOptions,
  PendingSelection,
  SearchRoot,
} from './file-delivery/FileDeliveryTypes.js';
import { FileDeliveryArchiveSupport } from './file-delivery/FileDeliveryArchiveSupport.js';
import { FileDeliveryPathSupport } from './file-delivery/FileDeliveryPathSupport.js';
import { FileDeliveryPresentationSupport } from './file-delivery/FileDeliveryPresentationSupport.js';
import { FileDeliveryRequestParser } from './file-delivery/FileDeliveryRequestParser.js';
import { FileDeliverySearchSupport } from './file-delivery/FileDeliverySearchSupport.js';

export type { FileDeliveryPlan, FileDeliveryPrepareOptions, SearchRoot } from './file-delivery/FileDeliveryTypes.js';
export type { FileDeliveryEntry } from './file-delivery/FileDeliveryTypes.js';

export class FileDeliveryService {
  private readonly pendingSelections = new Map<string, PendingSelection>();
  private readonly roots: SearchRoot[];
  private readonly pathSupport: FileDeliveryPathSupport;
  private readonly parser: FileDeliveryRequestParser;
  private readonly searchSupport: FileDeliverySearchSupport;
  private readonly presentationSupport: FileDeliveryPresentationSupport;

  constructor(options?: { userHomeDir?: string; workspaceDir?: string; workspaceRootDir?: string; tmpDir?: string; extraRoots?: Array<{ key: string; label: string; absolutePath: string }> }) {
    const homeDir = options?.userHomeDir || process.env.USERPROFILE || os.homedir();
    const workspaceDir = options?.workspaceDir || config.defaultWorkspace;
    const workspaceRootDir = options?.workspaceRootDir || config.workspaceRoot || path.dirname(workspaceDir);
    const tmpDir = options?.tmpDir || config.tmpDir;
    this.roots = this.createConfiguredRoots(homeDir, workspaceDir, workspaceRootDir, options?.extraRoots);

    const policyEngine = new PolicyEngine();
    this.pathSupport = new FileDeliveryPathSupport(this.roots, policyEngine);
    this.parser = new FileDeliveryRequestParser();
    this.searchSupport = new FileDeliverySearchSupport(this.pathSupport);
    this.presentationSupport = new FileDeliveryPresentationSupport(this.pendingSelections, new FileDeliveryArchiveSupport(tmpDir));
  }

  public shouldHandleText(userId: string, text: string): boolean {
    let normalized = String(text || '').trim();
    if (!normalized) {
      return false;
    }
    normalized = normalized.replace(/^\/(?:task|arquivo)\b/i, '').trim();
    if (!normalized) {
      return false;
    }
    if (this.hasPendingSelection(userId) && /^\s*(?:op(?:cao)?\s*)?(\d{1,2})\s*$/i.test(normalized)) {
      return true;
    }
    if (normalized.startsWith('/')) {
      return false;
    }
    return this.parser.looksLikeFileRequest(normalized);
  }

  public async prepare(userId: string, rawRequest: string, options: FileDeliveryPrepareOptions = {}): Promise<FileDeliveryPlan> {
    this.clearExpiredSelections();
    const selectionPlan = await this.tryResolveSelection(userId, rawRequest);
    if (selectionPlan) {
      return selectionPlan;
    }

    const descriptor = this.parser.parseRequest(rawRequest);
    let roots = this.pathSupport.resolveSearchRoots(descriptor.preferredRoots, options.extraAllowedPaths || []);
    if (roots.length === 0) {
      return { kind: 'message', text: 'Nao encontrei nenhuma raiz local disponivel para procurar esse arquivo.' };
    }

    const namedRoot = descriptor.explicitPath ? null : this.pathSupport.findNamedRootMatch(roots, descriptor.searchTerm);
    if (namedRoot) {
      roots = [namedRoot, ...roots.filter((root) => root.absolutePath !== namedRoot.absolutePath)];
      descriptor.searchTerm = this.pathSupport.stripRootNameFromSearchTerm(descriptor.searchTerm, namedRoot);
      if (descriptor.wantsListing && !descriptor.searchTerm) {
        return this.createDirectoryListingPlan(userId, rawRequest, this.pathSupport.makeEntry(namedRoot.absolutePath, namedRoot, fs.statSync(namedRoot.absolutePath), 1000), descriptor);
      }
    }

    if (descriptor.explicitPath) {
      const resolvedExplicit = this.pathSupport.resolveExplicitPath(descriptor.explicitPath, roots);
      if (!resolvedExplicit) {
        const permissionPath = this.pathSupport.resolvePermissionPath(descriptor.explicitPath);
        if (permissionPath) {
          return {
            kind: 'permission',
            requestedPath: permissionPath,
            previewPath: permissionPath,
            originalRequest: rawRequest,
            reason: 'Esse caminho existe, mas ainda nao esta nas areas liberadas para leitura e envio pelo Zavorth.',
          };
        }
        return { kind: 'message', text: 'Esse caminho ficou fora das areas permitidas ou nao existe. Tente informar um arquivo dentro de Downloads, Desktop, Documentos, da raiz de trabalho ou do workspace atual.' };
      }
      if (resolvedExplicit.isDirectory) {
        if (descriptor.wantsListing) {
          return this.createDirectoryListingPlan(userId, rawRequest, resolvedExplicit, descriptor);
        }

        const explicitDirectoryHasQuery = this.parser.hasSpecificQuery(descriptor.searchTerm, descriptor.desiredExtension) || descriptor.desiredType === 'file';
        if (explicitDirectoryHasQuery) {
          const explicitRoot: SearchRoot = {
            key: `explicit_root_${resolvedExplicit.baseName.toLowerCase()}`,
            label: resolvedExplicit.baseName,
            absolutePath: resolvedExplicit.absolutePath,
          };
          const scopedDescriptor = { ...descriptor, explicitPath: null };
          const candidates = await this.searchSupport.searchCandidates([explicitRoot], scopedDescriptor);
          if (candidates.length === 0) {
            const previewEntries = await this.searchSupport.listEntriesInDirectory(resolvedExplicit, scopedDescriptor);
            if (previewEntries.length > 0) {
              return this.presentationSupport.createChoicesPlan(userId, rawRequest, resolvedExplicit.baseName, previewEntries, {
                mentionFallback: true,
                intro: `Nao encontrei uma correspondencia exata em ${resolvedExplicit.baseName}. Estes sao alguns itens visiveis:`,
              });
            }
            return { kind: 'message', text: `Nao encontrei um arquivo compativel dentro de ${resolvedExplicit.baseName}.` };
          }
          if (this.searchSupport.shouldAutoSend(candidates, scopedDescriptor)) {
            return this.presentationSupport.createSendPlan(candidates[0], this.pathSupport.shouldSkipAbsolutePath.bind(this.pathSupport));
          }
          return this.presentationSupport.createChoicesPlan(userId, rawRequest, resolvedExplicit.baseName, candidates);
        }
      }
      return this.presentationSupport.createSendPlan(resolvedExplicit, this.pathSupport.shouldSkipAbsolutePath.bind(this.pathSupport));
    }

    if (descriptor.wantsListing) {
      const listingPlan = await this.resolveListingPlan(userId, rawRequest, roots, descriptor);
      if (listingPlan) {
        return listingPlan;
      }
    }

    const hasSpecificQuery = this.parser.hasSpecificQuery(descriptor.searchTerm, descriptor.desiredExtension);
    if (descriptor.wantsLatest && !hasSpecificQuery) {
      const latestCandidate = await this.findLatestCandidate(roots, descriptor);
      if (latestCandidate) {
        return this.presentationSupport.createSendPlan(latestCandidate, this.pathSupport.shouldSkipAbsolutePath.bind(this.pathSupport));
      }
    }

    if (!hasSpecificQuery) {
      const topEntries = await this.searchSupport.listTopLevelEntries(roots[0], descriptor);
      if (topEntries.length === 0) {
        return { kind: 'message', text: `A pasta ${roots[0].label} esta vazia ou inacessivel no momento.` };
      }
      return this.presentationSupport.createChoicesPlan(userId, rawRequest, roots[0].label, topEntries, { intro: `Itens visiveis em ${roots[0].label}:` });
    }

    const candidates = await this.searchSupport.searchCandidates(roots, descriptor);
    if (candidates.length === 0) {
      const previewEntries = await this.searchSupport.listTopLevelEntries(roots[0], descriptor);
      if (previewEntries.length > 0) {
        return this.presentationSupport.createChoicesPlan(userId, rawRequest, roots[0].label, previewEntries, {
          mentionFallback: true,
        });
      }
      return { kind: 'message', text: `Nao encontrei um arquivo correspondente em ${roots.map((root) => root.label).join(', ')}.` };
    }

    if (descriptor.wantsLatest) {
      return this.presentationSupport.createSendPlan(this.searchSupport.pickLatestCandidate(candidates), this.pathSupport.shouldSkipAbsolutePath.bind(this.pathSupport));
    }
    if (this.searchSupport.shouldAutoSend(candidates, descriptor)) {
      return this.presentationSupport.createSendPlan(candidates[0], this.pathSupport.shouldSkipAbsolutePath.bind(this.pathSupport));
    }
    return this.presentationSupport.createChoicesPlan(userId, rawRequest, candidates[0].rootLabel, candidates.slice(0, 8));
  }

  private async tryResolveSelection(userId: string, rawRequest: string): Promise<FileDeliveryPlan | null> {
    const pending = this.pendingSelections.get(userId);
    if (!pending) {
      return null;
    }
    const match = rawRequest.trim().match(/^\s*(?:op(?:cao)?\s*)?(\d{1,2})\s*$/i);
    if (!match) {
      return null;
    }

    const selectedIndex = safeParseInt(match[1], 1) - 1;
    if (selectedIndex < 0 || selectedIndex >= pending.entries.length) {
      return { kind: 'message', text: `Escolha invalida. Responda com um numero entre 1 e ${pending.entries.length}.` };
    }

    const chosen = pending.entries[selectedIndex];
    this.pendingSelections.delete(userId);
    if (!fs.existsSync(chosen.absolutePath)) {
      return { kind: 'message', text: 'A opcao escolhida nao existe mais no disco. Tente pedir novamente.' };
    }
    if (pending.selectionAction === 'list' && chosen.isDirectory) {
      return this.createDirectoryListingPlan(userId, pending.originalRequest, chosen, this.parser.parseRequest(pending.originalRequest));
    }
    return this.presentationSupport.createSendPlan(chosen, this.pathSupport.shouldSkipAbsolutePath.bind(this.pathSupport));
  }

  private async resolveListingPlan(userId: string, rawRequest: string, roots: SearchRoot[], descriptor: ReturnType<FileDeliveryRequestParser['parseRequest']>): Promise<FileDeliveryPlan | null> {
    const hasSpecificQuery = this.parser.hasSpecificQuery(descriptor.searchTerm, descriptor.desiredExtension);
    if (!hasSpecificQuery) {
      const topEntries = await this.searchSupport.listTopLevelEntries(roots[0], descriptor);
      if (topEntries.length === 0) {
        return { kind: 'message', text: `Nao encontrei itens visiveis em ${roots[0].label}${descriptor.timeFilterLabel ? ` ${descriptor.timeFilterLabel}` : ''}.` };
      }
      return this.presentationSupport.createChoicesPlan(userId, rawRequest, roots[0].label, topEntries, {
        intro: `Conteudo atual de ${roots[0].label}${descriptor.timeFilterLabel ? ` ${descriptor.timeFilterLabel}` : ''}:`,
      });
    }

    if (descriptor.desiredType !== 'file') {
      const directoryDescriptor = { ...descriptor, desiredType: 'directory' as const, desiredExtension: null, wantsLatest: false };
      const directoryCandidates = await this.searchSupport.searchCandidates(roots, directoryDescriptor);
      if (directoryCandidates.length === 1) {
        return this.createDirectoryListingPlan(userId, rawRequest, directoryCandidates[0], descriptor);
      }
      if (directoryCandidates.length > 1 && directoryCandidates[0].score >= 600) {
        return this.presentationSupport.createChoicesPlan(userId, rawRequest, directoryCandidates[0].rootLabel, directoryCandidates, {
          selectionAction: 'list',
          intro: `Encontrei varias pastas parecidas em ${directoryCandidates[0].rootLabel}.`,
          closingLine: 'Responda com o numero da pasta que voce quer abrir.',
        });
      }
    }

    const candidates = await this.searchSupport.searchCandidates(roots, descriptor);
    if (candidates.length === 0) {
      const previewEntries = await this.searchSupport.listTopLevelEntries(roots[0], descriptor);
      if (previewEntries.length > 0) {
        return this.presentationSupport.createChoicesPlan(userId, rawRequest, roots[0].label, previewEntries, {
          mentionFallback: true,
          intro: `Nao encontrei uma correspondencia exata. Estes sao alguns itens em ${roots[0].label}:`,
        });
      }
      return { kind: 'message', text: `Nao encontrei itens compativeis em ${roots.map((root) => root.label).join(', ')}.` };
    }

    return this.presentationSupport.createChoicesPlan(userId, rawRequest, candidates[0].rootLabel, candidates, {
      intro: `Encontrei estes itens em ${candidates[0].rootLabel}:`,
    });
  }

  private async createDirectoryListingPlan(userId: string, rawRequest: string, directoryEntry: ReturnType<FileDeliveryPathSupport['makeEntry']>, descriptor: ReturnType<FileDeliveryRequestParser['parseRequest']>): Promise<FileDeliveryPlan> {
    const entries = await this.searchSupport.listEntriesInDirectory(directoryEntry, descriptor);
    if (entries.length === 0) {
      return { kind: 'message', text: `A pasta ${directoryEntry.baseName} nao tem itens visiveis${descriptor.timeFilterLabel ? ` ${descriptor.timeFilterLabel}` : ''}.` };
    }
    return this.presentationSupport.createChoicesPlan(userId, rawRequest, directoryEntry.baseName, entries, {
      intro: `Conteudo de ${directoryEntry.relativePath}${descriptor.timeFilterLabel ? ` ${descriptor.timeFilterLabel}` : ''}:`,
    });
  }

  private async findLatestCandidate(roots: SearchRoot[], descriptor: ReturnType<FileDeliveryRequestParser['parseRequest']>): Promise<ReturnType<FileDeliverySearchSupport['pickLatestCandidate']> | null> {
    const candidates = await this.searchSupport.searchCandidates(roots, descriptor, true);
    return candidates.length > 0 ? this.searchSupport.pickLatestCandidate(candidates) : null;
  }

  private hasPendingSelection(userId: string): boolean {
    const pending = this.pendingSelections.get(userId);
    if (!pending) return false;
    if (Date.now() - pending.createdAtMs > 10 * 60 * 1000) {
      this.pendingSelections.delete(userId);
      return false;
    }
    return true;
  }

  private clearExpiredSelections(): void {
    const now = Date.now();
    for (const [userId, pending] of this.pendingSelections.entries()) {
      if (now - pending.createdAtMs > 10 * 60 * 1000) this.pendingSelections.delete(userId);
    }
  }

  private createConfiguredRoots(homeDir: string, workspaceDir: string, workspaceRootDir: string, extraRoots?: Array<{ key: string; label: string; absolutePath: string }>): SearchRoot[] {
    const configuredRoots: SearchRoot[] = [
      { key: 'downloads', label: 'Downloads', absolutePath: path.join(homeDir, 'Downloads') },
      { key: 'desktop', label: 'Desktop', absolutePath: path.join(homeDir, 'Desktop') },
      { key: 'documents', label: 'Documentos', absolutePath: path.join(homeDir, 'Documents') },
      { key: 'workspace', label: 'Workspace', absolutePath: workspaceDir },
      { key: 'workspace_root', label: path.basename(workspaceRootDir) || 'Raiz de trabalho', absolutePath: workspaceRootDir },
      ...(extraRoots || []),
    ];
    return configuredRoots.filter((entry, index, all) => entry.absolutePath && fs.existsSync(entry.absolutePath) && all.findIndex((candidate) => candidate.key === entry.key) === index);
  }
}
