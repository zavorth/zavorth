import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiRequest,
  dispatchRuntimeStateAction,
  getPluginOsSnapshot,
  getPluginOsReceipts,
  postPluginOsAction,
  type PluginOsReceiptEntry,
  type PluginOsSuggestResult,
  type ToolItem,
} from '../apiClient';
import type { PluginItem } from '../views/panels/PluginMarketplacePanel';
import type { WorkboardBoard, WorkboardCard } from '../views/panels/WorkboardPanel';
import type { RuntimeWorkboardProjection } from '../workboard/runtimeWorkboardProjection';
import {
  buildWorkboardRuntimeAction,
  describeWorkboardSync,
  mergeBoardsForDisplay,
  type WorkboardSyncState,
} from '../workboard/workboardRuntimeSync';
import {
  buildCardChatContext,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  extractRuntimeWorkboard,
  loadWorkboards,
  mapMarketplaceSkillsToPlugins,
  mapToolsToPlugins,
  persistWorkboards,
  renameColumn,
  upsertCard,
} from './productData';
import {
  mapPluginOsSnapshotToPanelData,
  type PluginOsPlanePanelData,
} from './pluginOsBridge';
import { pluginOsPlaneLabels, resolveDesktopLocale } from '../i18n/pluginOsPlane';
import { asErrorLike } from '../lib/errors';


export function useDesktopProduct(input: {
  tools: ToolItem[];
  snapshot: unknown;
  sessionId?: string;
  setInput: (value: string | ((current: string) => string)) => void;
  setActivePanel: (panel: string) => void;
  setNotice: (value: string) => void;
  getComposerInput: () => string;
}) {
  const [boards, setBoards] = useState<WorkboardBoard[]>(() => loadWorkboards());
  const [marketplacePlugins, setMarketplacePlugins] = useState<PluginItem[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceSource, setMarketplaceSource] = useState<'api' | 'tools' | 'empty'>('empty');
  const [runtimeWorkboard, setRuntimeWorkboard] = useState<RuntimeWorkboardProjection | null>(null);
  const [lastPushOk, setLastPushOk] = useState<boolean | null>(null);
  const [lastPushError, setLastPushError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pluginOsData, setPluginOsData] = useState<PluginOsPlanePanelData>(() => mapPluginOsSnapshotToPanelData(null));
  const [pluginOsLoading, setPluginOsLoading] = useState(false);
  const [pluginOsError, setPluginOsError] = useState<string | null>(null);
  const [pluginOsSuggest, setPluginOsSuggest] = useState<PluginOsSuggestResult | null>(null);
  const [pluginOsReceipts, setPluginOsReceipts] = useState<PluginOsReceiptEntry[]>([]);
  const [pluginOsInjectMode, setPluginOsInjectMode] = useState<string>('compact');
  const pluginOsLabels = useMemo(
    () => pluginOsPlaneLabels(resolveDesktopLocale()),
    [],
  );

  useEffect(() => {
    setRuntimeWorkboard(extractRuntimeWorkboard(input.snapshot));
  }, [input.snapshot]);

  const workboardSync: WorkboardSyncState = useMemo(() => describeWorkboardSync({
    hasRuntimeProjection: Boolean(runtimeWorkboard && (runtimeWorkboard.tasks?.length || runtimeWorkboard.sessions?.length)),
    lastPushOk,
    lastPushError,
    lastSyncedAt,
  }), [lastPushError, lastPushOk, lastSyncedAt, runtimeWorkboard]);

  const displayBoards = useMemo(
    () => mergeBoardsForDisplay(boards, runtimeWorkboard),
    [boards, runtimeWorkboard],
  );

  const pushBoardMutation = useCallback(async (
    board: WorkboardBoard,
    operation: 'upsert-card' | 'delete-card' | 'sync-board',
    card?: WorkboardCard | null,
  ) => {
    try {
      const action = buildWorkboardRuntimeAction({
        board,
        card,
        operation,
        sessionId: input.sessionId || 'desktop-main',
      });
      const result = await dispatchRuntimeStateAction({
        type: action.type,
        approved: true,
        sessionId: action.sessionId,
        source: action.source,
        payload: action.payload,
      }) as { ok?: boolean; applied?: boolean; snapshot?: unknown; error?: string } | null;
      if (result && result.ok === false) {
        throw new Error(result.error || 'Runtime rejected workboard-sync.');
      }
      const projected = extractRuntimeWorkboard(result)
        || extractRuntimeWorkboard(result?.snapshot)
        || null;
      if (projected) {
        setRuntimeWorkboard(projected);
      }
      setLastPushOk(true);
      setLastPushError(null);
      setLastSyncedAt(new Date().toISOString());
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      setLastPushOk(false);
      setLastPushError(error instanceof Error ? err.message : 'Runtime workboard push failed.');
      return false;
    }
  }, [input.sessionId]);

  const handleSyncBoard = useCallback(async (boardId?: string) => {
    const board = boards.find(item => item.id === boardId) || boards[0];
    if (!board) {
      input.setNotice('No local workboard to sync.');
      return false;
    }
    setSyncBusy(true);
    try {
      const boardOk = await pushBoardMutation(board, 'sync-board');
      if (!boardOk) {
        input.setNotice('Workboard sync failed. local board kept; runtime push unavailable.');
        return false;
      }
      const cards = board.cards.slice();
      const batchSize = 5;
      let cardsOk = true;
      for (let index = 0; index < cards.length; index += batchSize) {
        const batch = cards.slice(index, index + batchSize);
        const results = await Promise.all(batch.map(card => pushBoardMutation(board, 'upsert-card', card)));
        if (!results.every(Boolean)) {
          cardsOk = false;
          break;
        }
      }
      input.setNotice(cardsOk ? `Workboard “${board.name}” synced to runtime.`
        : `Workboard “${board.name}” partially synced. Some cards stayed local.`);
      return cardsOk;
    } finally {
      setSyncBusy(false);
    }
  }, [boards, input, pushBoardMutation]);

  const refreshMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    try {
      const [installedResult, marketplaceResult, localMarketplaceResult] = await Promise.all([
        apiRequest<{ skills?: unknown[] }>({ method: 'GET', path: '/api/skills', timeoutMs: 15000 }),
        apiRequest<{ skills?: unknown[] }>({ method: 'GET', path: '/api/skills/marketplace', timeoutMs: 15000 }),
        apiRequest<{ skills?: unknown[] }>({ method: 'GET', path: '/api/marketplace/skills', timeoutMs: 15000 }),
      ]);
      const installed = installedResult.ok && Array.isArray(installedResult.data?.skills)
        ? mapMarketplaceSkillsToPlugins(installedResult.data.skills).map(plugin => ({ ...plugin, status: 'installed' as const }))
        : [];
      const marketplaceSkills = marketplaceResult.ok
        && Array.isArray(marketplaceResult.data?.skills)
        && marketplaceResult.data.skills.length > 0
        ? marketplaceResult.data.skills
        : localMarketplaceResult.ok && Array.isArray(localMarketplaceResult.data?.skills)
          ? localMarketplaceResult.data.skills
          : [];
      const available = mapMarketplaceSkillsToPlugins(marketplaceSkills);
      const merged = new Map(available.map(plugin => [plugin.id, plugin]));
      installed.forEach(plugin => merged.set(plugin.id, plugin));
      if (merged.size > 0) {
        setMarketplacePlugins([...merged.values()]);
        setMarketplaceSource('api');
        return;
      }
      const fromTools = mapToolsToPlugins(input.tools);
      setMarketplacePlugins(fromTools);
      setMarketplaceSource(fromTools.length > 0 ? 'tools' : 'empty');
    } catch {
      const fromTools = mapToolsToPlugins(input.tools);
      setMarketplacePlugins(fromTools);
      setMarketplaceSource(fromTools.length > 0 ? 'tools' : 'empty');
    } finally {
      setMarketplaceLoading(false);
    }
  }, [input.tools]);

  useEffect(() => {
    void refreshMarketplace();
  }, [refreshMarketplace]);

  const refreshPluginOs = useCallback(async () => {
    setPluginOsLoading(true);
    try {
      const result = await getPluginOsSnapshot();
      if (!result.ok || result.status === 404) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(null));
        setPluginOsError(
          result.status === 404
            ? 'Plugin OS API unavailable (404); showing empty plane.'
            : (result.error || 'Plugin OS snapshot unavailable.'),
        );
        return;
      }
      const snapshot = (result.data?.snapshot || result.data) as Record<string, unknown> | null;
      setPluginOsData(mapPluginOsSnapshotToPanelData(snapshot));
      setPluginOsError(null);

      // Soft-load receipts timeline + inject prefs.
      try {
        const receipts = await getPluginOsReceipts(12);
        const entries = receipts.data?.timeline?.entries;
        if (Array.isArray(entries)) setPluginOsReceipts(entries as PluginOsReceiptEntry[]);
      } catch {
        /* soft */
      }
      try {
        const prefs = await postPluginOsAction({ action: 'inject-prefs', approved: false });
        const mode = (prefs.data?.result?.injectPrefs as { injectMode?: string } | undefined)?.injectMode;
        if (mode) setPluginOsInjectMode(mode);
      } catch {
        /* soft */
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      setPluginOsData(mapPluginOsSnapshotToPanelData(null));
      setPluginOsError(error instanceof Error ? err.message : 'Plugin OS snapshot failed.');
    } finally {
      setPluginOsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPluginOs();
  }, [refreshPluginOs]);

  const handleEnablePluginOs = useCallback(async (pluginId: string) => {
    try {
      let previewSummary = '';
      try {
        const previewResult = await postPluginOsAction({
          action: 'preview-permissions',
          pluginId,
          approved: false,
        });
        const preview = previewResult.data?.result?.permissionPreview as {
          risks?: string[];
          needsCredentials?: boolean;
          trust?: string;
          text?: string;
          permissions?: Array<{ kind?: string }>;
        } | undefined;
        if (preview) {
          const risks = Array.isArray(preview.risks) ? preview.risks.slice(0, 3) : [];
          const permCount = Array.isArray(preview.permissions) ? preview.permissions.length : 0;
          previewSummary = [
            `trust=${preview.trust || 'review'}`,
            `perms=${permCount}`,
            risks.length - risks.join('; ') : null,
            preview.needsCredentials ? 'may need credentials' : null,
          ].filter(Boolean).join(' · ');
          const riskText = risks.length - risks.join('; ') : (preview.text || 'review recommended');
          input.setNotice(
            preview.needsCredentials ? `${pluginId} may need credentials. Risks: ${riskText}. Enabling only because you clicked Enable (never auto).`
              : `Before enable — ${pluginId}: ${riskText}. Proceeding with your explicit Enable…`,
          );
          previewSummary = riskText;
        }
      } catch {
        /* soft-fail preview; still enable */
      }

      const result = await postPluginOsAction({ action: 'enable', pluginId, approved: true });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Enable failed.');
      }
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      } else {
        await refreshPluginOs();
      }
      input.setNotice(
        previewSummary ? `Enabled ${pluginId}. You approved this enable. Risks noted: ${previewSummary}`
          : `Enabled ${pluginId}. You approved this enable (never auto-enables).`,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not enable plugin.');
    }
  }, [input, refreshPluginOs]);

  const handleDisablePluginOs = useCallback(async (pluginId: string) => {
    try {
      const result = await postPluginOsAction({ action: 'disable', pluginId, approved: true });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Disable failed.');
      }
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      } else {
        await refreshPluginOs();
      }
      input.setNotice(`Disabled plugin ${pluginId}.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not disable plugin.');
    }
  }, [input, refreshPluginOs]);

  const handleInspectPluginOs = useCallback(async (pluginId: string) => {
    try {
      const result = await postPluginOsAction({ action: 'inspect', pluginId, approved: true });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Inspect failed.');
      }
      const bridged = result.data?.result?.bridged as { pluginId?: string; trust?: string; enabled?: boolean } | undefined;
      input.setNotice(
        bridged ? `Inspect ${bridged.pluginId || pluginId}: enabled=${Boolean(bridged.enabled)} trust=${bridged.trust || 'review'}`
          : `Inspected ${pluginId}.`,
      );
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not inspect plugin.');
    }
  }, [input]);

  const handleTrustPluginOs = useCallback(async (
    pluginId: string,
    trust: 'review' | 'trusted' | 'blocked' = 'trusted',
  ) => {
    try {
      const result = await postPluginOsAction({ action: 'trust', pluginId, trust, approved: true });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Trust update failed.');
      }
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      } else {
        await refreshPluginOs();
      }
      input.setNotice(`Trust for ${pluginId} set to ${trust}.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not update trust.');
    }
  }, [input, refreshPluginOs]);

  const handleRecommendPluginOs = useCallback(async (intent: string) => {
    try {
      // Prefer suggest-to-enable with Enable vs Recommend-only CTAs.
      const result = await postPluginOsAction({ action: 'suggest', intent, approved: false });
      if (!result.ok || result.data?.ok === false) {
        // Fallback to classic recommend
        const fallback = await postPluginOsAction({ action: 'recommend', intent, approved: false });
        if (!fallback.ok || fallback.data?.ok === false) {
          throw new Error(result.error || result.data?.error || 'Suggest failed.');
        }
        const rec = fallback.data?.result?.recommendations as {
          recommendations?: Array<{ pluginId?: string; score?: number }>;
          text?: string;
        } | undefined;
        const top = (rec?.recommendations || []).slice(0, 3)
          .map((item) => item.pluginId || '...')
          .join(', ');
        input.setNotice(
          top ? `Suggestions: ${top}. Never auto-enables — use Enable or Recommend only.`
            : (rec?.text || `No plugin matches for "${intent}".`),
        );
        return;
      }
      const suggest = (result.data?.result?.suggest || result.data?.result) as PluginOsSuggestResult;
      setPluginOsSuggest(suggest);
      const primary = suggest?.primary;
      input.setNotice(
        primary?.pluginId ? `${primary.pluginId} can help. Choose Enable or Recommend only — never auto-enables.`
          : (suggest?.message || `No enableable plugin for "${intent}".`),
      );
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not suggest plugins.');
    }
  }, [input]);

  const handleSuggestActionPluginOs = useCallback(async (actionId: string, pluginId?: string) => {
    if (actionId === 'dismiss') {
      setPluginOsSuggest(null);
      input.setNotice('Suggestion dismissed.');
      return;
    }
    if (actionId === 'recommend_only') {
      input.setNotice(
        pluginId ? `Recommend only: keep ${pluginId} as a suggestion. Not enabled.`
          : 'Recommend only — nothing enabled.',
      );
      setPluginOsSuggest(null);
      return;
    }
    if (actionId === 'enable' && pluginId) {
      await handleEnablePluginOs(pluginId);
      setPluginOsSuggest(null);
    }
  }, [input, handleEnablePluginOs]);

  const handleCatalogApplyPluginOs = useCallback(async () => {
    try {
      const result = await postPluginOsAction({ action: 'catalog-apply', approved: true });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Catalog apply failed.');
      }
      const catalog = result.data?.result?.catalog as { enabled?: string[] } | undefined;
      const enabled = Array.isArray(catalog?.enabled) ? catalog!.enabled! : [];
      input.setNotice(
        enabled.length ? `Bootstrap catalog enabled ${enabled.length} plugin(s): ${enabled.slice(0, 6).join(', ')}`
          : String(result.data?.result?.notice || 'Bootstrap catalog applied (no new enables).'),
      );
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      } else {
        await refreshPluginOs();
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not apply bootstrap catalog.');
    }
  }, [input, refreshPluginOs]);

  const handleOnboardingPluginOs = useCallback(async (profile = 'recommended') => {
    try {
      const result = await postPluginOsAction({
        action: 'onboarding-apply',
        profile,
        approved: true,
      });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Onboarding apply failed.');
      }
      const onboard = result.data?.result?.onboarding as { enabled?: string[]; profile?: string } | undefined;
      const enabled = Array.isArray(onboard?.enabled) ? onboard!.enabled! : [];
      input.setNotice(
        `Onboarding ${onboard?.profile || profile}: enabled ${enabled.length} plugin(s)`
          + (enabled.length ? ` (${enabled.slice(0, 5).join(', ')})` : ''),
      );
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      } else {
        await refreshPluginOs();
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not apply Plugin OS onboarding.');
    }
  }, [input, refreshPluginOs]);

  const handleUndoOnboardingPluginOs = useCallback(async () => {
    try {
      const result = await postPluginOsAction({
        action: 'onboarding-undo',
        approved: true,
      });
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Onboarding undo failed.');
      }
      const onboard = result.data?.result?.onboarding as {
        disabled?: string[];
        profile?: string | null;
      } | undefined;
      const disabled = Array.isArray(onboard?.disabled) ? onboard!.disabled! : [];
      input.setNotice(
        disabled.length
          ? `Undid onboarding${onboard?.profile ? ` (${onboard.profile})` : ''}: disabled ${disabled.length} plugin(s)`
            + ` (${disabled.slice(0, 5).join(', ')}). Packages kept.`
          : String(result.data?.result?.notice || 'Onboarding undo: nothing to disable.'),
      );
      if (result.data?.snapshot) {
        setPluginOsData(mapPluginOsSnapshotToPanelData(result.data.snapshot as Record<string, unknown>));
      } else {
        await refreshPluginOs();
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not undo Plugin OS onboarding.');
    }
  }, [input, refreshPluginOs]);

  const commitBoards = useCallback((next: WorkboardBoard[]) => {
    setBoards(persistWorkboards(next));
  }, []);

  const handleBoardSelect = useCallback((_boardId: string) => {
    // Selection is local to the panel store; reserved for future sync.
  }, []);

  const handleCardCreate = useCallback((boardId: string, card: Omit<WorkboardCard, 'id' | 'createdAt'>) => {
    const next = createCard(boards, boardId, card);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    const created = board?.cards[board.cards.length - 1];
    if (board && created) {
      void pushBoardMutation(board, 'upsert-card', created).then(ok => {
        if (!ok) input.setNotice('Card saved locally. Runtime workboard sync unavailable.');
      });
    }
  }, [boards, commitBoards, input, pushBoardMutation]);

  const handleCardUpdate = useCallback((boardId: string, card: WorkboardCard) => {
    const updated = { ...card, updatedAt: new Date().toISOString() };
    const next = upsertCard(boards, boardId, updated);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) {
      void pushBoardMutation(board, 'upsert-card', updated).then(ok => {
        if (!ok) input.setNotice('Card updated locally. Runtime workboard sync unavailable.');
      });
    }
  }, [boards, commitBoards, input, pushBoardMutation]);

  const handleCardDelete = useCallback((boardId: string, cardId: string) => {
    const board = boards.find(item => item.id === boardId);
    const card = board?.cards.find(item => item.id === cardId) || null;
    commitBoards(deleteCard(boards, boardId, cardId));
    if (board) {
      void pushBoardMutation(board, 'delete-card', card).then(ok => {
        if (!ok) input.setNotice('Card deleted locally. Runtime workboard sync unavailable.');
      });
    }
  }, [boards, commitBoards, input, pushBoardMutation]);

  const handleColumnCreate = useCallback((boardId: string, name: string) => {
    const next = createColumn(boards, boardId, name);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) void pushBoardMutation(board, 'sync-board');
  }, [boards, commitBoards, pushBoardMutation]);

  const handleColumnUpdate = useCallback((boardId: string, columnId: string, name: string) => {
    const next = renameColumn(boards, boardId, columnId, name);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) void pushBoardMutation(board, 'sync-board');
  }, [boards, commitBoards, pushBoardMutation]);

  const handleColumnDelete = useCallback((boardId: string, columnId: string) => {
    const next = deleteColumn(boards, boardId, columnId);
    commitBoards(next);
    const board = next.find(item => item.id === boardId);
    if (board) void pushBoardMutation(board, 'sync-board');
  }, [boards, commitBoards, pushBoardMutation]);

  const handleOpenCardInChat = useCallback((boardId: string, cardId: string) => {
    const board = displayBoards.find(item => item.id === boardId);
    const card = board?.cards.find(item => item.id === cardId);
    if (!board || !card) return;
    const context = buildCardChatContext(board, card);
    const current = input.getComposerInput();
    input.setInput(current ? `${current}\n\n${context}` : context);
    input.setActivePanel('chat');
    input.setNotice(`Loaded workboard card “${card.title}” into the composer.`);
  }, [displayBoards, input]);

  const handleInstallPlugin = useCallback(async (pluginId: string) => {
    const plugin = marketplacePlugins.find(item => item.id === pluginId);
    try {
      let result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
        method: 'POST',
        path: '/api/skills/marketplace/install',
        body: {
          name: plugin?.name || pluginId,
          description: plugin?.description || 'Skill installed by Zavorth Desktop.',
          version: plugin?.version || '1.0.0',
          skillMdContent: plugin?.skillMdContent || `# ${plugin?.name || pluginId}\n\n${plugin?.description || ''}`,
          sourceUrl: plugin?.sourceUrl,
        },
        timeoutMs: 60000,
      });
      if (!result.ok || result.data?.ok === false) {
        result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
          method: 'POST',
          path: '/api/marketplace/skills',
          body: { action: 'install', source: plugin?.sourceUrl || pluginId },
          timeoutMs: 60000,
        });
      }
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || result.data?.message || 'Install failed.');
      }
      input.setNotice(result.data?.message || `Installed ${plugin?.name || pluginId}.`);
      await refreshMarketplace();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not install skill.');
    }
  }, [input, marketplacePlugins, refreshMarketplace]);

  const handleUninstallPlugin = useCallback(async (pluginId: string) => {
    try {
      let result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
        method: 'DELETE',
        path: `/api/skills/${encodeURIComponent(pluginId)}`,
        body: undefined,
        timeoutMs: 30000,
      });
      if (!result.ok || result.data?.ok === false) {
        result = await apiRequest<{ ok?: boolean; message?: string; error?: string }>({
          method: 'POST',
          path: '/api/marketplace/skills',
          body: { action: 'uninstall', skillId: pluginId },
          timeoutMs: 30000,
        });
      }
      if (!result.ok || result.data?.ok === false) {
        throw new Error(result.error || result.data?.error || 'Uninstall failed.');
      }
      input.setNotice(result.data?.message || `Uninstalled ${pluginId}.`);
      await refreshMarketplace();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      input.setNotice(error instanceof Error ? err.message : 'Could not uninstall skill.');
    }
  }, [input, refreshMarketplace]);

  const handleUpdatePlugin = useCallback(async (pluginId: string) => {
    await handleInstallPlugin(pluginId);
  }, [handleInstallPlugin]);

  const handleAttachFile = useCallback((relativePath: string) => {
    const ref = `@file:"${relativePath}"`;
    const current = input.getComposerInput();
    input.setInput(current ? `${current} ${ref}` : ref);
    input.setActivePanel('chat');
    input.setNotice(`Attached ${relativePath} to the composer.`);
  }, [input]);

  return {
    boards: displayBoards,
    localBoards: boards,
    runtimeWorkboard,
    workboardSync,
    workboardSyncBusy: syncBusy,
    marketplacePlugins,
    marketplaceLoading,
    marketplaceSource,
    refreshMarketplace,
    pluginOsData,
    pluginOsLoading,
    pluginOsError,
    pluginOsLabels,
    refreshPluginOs,
    handleEnablePluginOs,
    handleDisablePluginOs,
    handleInspectPluginOs,
    handleTrustPluginOs,
    handleRecommendPluginOs,
    handleCatalogApplyPluginOs,
    handleOnboardingPluginOs,
    handleUndoOnboardingPluginOs,
    handleSuggestActionPluginOs,
    pluginOsSuggest,
    pluginOsReceipts,
    pluginOsInjectMode,
    handleBoardSelect,
    handleCardCreate,
    handleCardUpdate,
    handleCardDelete,
    handleColumnCreate,
    handleColumnUpdate,
    handleColumnDelete,
    handleOpenCardInChat,
    handleSyncBoard,
    handleInstallPlugin,
    handleUninstallPlugin,
    handleUpdatePlugin,
    handleAttachFile,
  };
}
