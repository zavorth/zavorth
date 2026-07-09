import type { NodeMeshActivitySnapshot, NodeMeshNodeKind } from '../contracts/NodeMeshContract.js';
import type { ZavorthNodeMeshService } from '../services/ZavorthNodeMeshService.js';
import type { NodeCapabilityService } from '../services/NodeCapabilityService.js';
import type { NodeDeviceProfileService } from '../services/NodeDeviceProfileService.js';
import type { NodeInvokeService } from '../services/NodeInvokeService.js';
import type { NodePairingService } from '../services/NodePairingService.js';
import { formatAdditionalCount, formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import { logger } from '../logger.js';

function formatNodeStatus(status: string | null | undefined): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) {
    return 'not provided';
  }
  return normalized;
}

function normalizeNodeActionHint(actionHint: string | null | undefined): string | null {
  const normalized = String(actionHint || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('nodeinvoke ')) {
    return `zavorth nodes invoke ${normalized.slice('nodeinvoke '.length)}`.trim();
  }
  if (normalized.startsWith('nodepair ')) {
    return `zavorth nodes pair ${normalized.slice('nodepair '.length)}`.trim();
  }
  if (normalized.startsWith('/nodes ')) {
    return `zavorth nodes ${normalized.slice('/nodes '.length)}`.trim();
  }

  return normalized;
}

function formatNodeActionPath(actionHint: string | null | undefined): string | null {
  const normalized = normalizeNodeActionHint(actionHint);
  if (!normalized) {
    return null;
  }

  if (/regenerate-pairing-draft/i.test(normalized)) {
    return 'gere um novo codigo de pareamento pelo Node Mesh.';
  }

  return compactNodeLine(normalized, 110);
}

function compactNodeLine(value: string | null | undefined, maxLength = 150): string {
  const sanitized = sanitizeHumanCliText(value || '')
    .replace(/^Node Mesh expoe (\d+) nodes registrados no control plane\.?$/i, 'Node Mesh acompanha $1 nodes no controle interno.')
    .replace(/^Regenerar pairing\b/gi, 'Gerar novo pareamento')
    .replace(/\bHeadless Worker\b/g, 'Worker sem tela')
    .replace(/\bdraft de pairing\b/gi, 'codigo de pareamento')
    .replace(/\bpairing draft\b/gi, 'codigo de pareamento')
    .replace(/\bpairing\b/gi, 'pareamento')
    .replace(/\s+Use doctor\/recover\b.*$/i, '')
    .replace(/\bnode\.maintenance\b/gi, 'manutencao de node')
    .replace(/\bcontrol plane\b/gi, 'controle interno')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sanitized || sanitized.length <= maxLength) {
    return sanitized;
  }

  const sentenceMatch = sanitized.match(/^(.+?[.!?])\s+/);
  const firstSentence = sentenceMatch?.[1]?.trim();
  if (firstSentence && firstSentence.length >= 32 && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  return `${sanitized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatNodeKindLabel(kind: NodeMeshNodeKind | string | null | undefined): string {
  const normalized = String(kind || '').trim().toLowerCase();
  if (normalized === 'headless') {
    return 'sem tela';
  }
  if (normalized === 'desktop') {
    return 'desktop';
  }
  if (normalized === 'mobile') {
    return 'mobile';
  }
  if (normalized === 'browser') {
    return 'navegador';
  }
  return normalized || 'tipo not provided';
}

function formatNodeStatusHuman(status: string | null | undefined): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'online') {
    return 'online';
  }
  if (normalized === 'offline') {
    return 'desconectado';
  }
  if (normalized === 'blocked') {
    return 'blocked';
  }
  if (normalized === 'revoked') {
    return 'revogado';
  }
  return formatNodeStatus(status);
}

type NodeMeshSnapshotRenderOptions = {
  focusExplicit?: boolean;
};

function pickHighlightedNodes(
  entries: ReturnType<ZavorthNodeMeshService['buildSnapshot']>['entries'],
  limit = 3,
): ReturnType<ZavorthNodeMeshService['buildSnapshot']>['entries'] {
  const selected: ReturnType<ZavorthNodeMeshService['buildSnapshot']>['entries'] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = [
      entry.label,
      entry.kind,
      formatNodeStatus(entry.status),
      formatCliValue(entry.trustLabel),
    ].join('|').toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selected.push(entry);
    if (selected.length >= limit) {
      break;
    }
  }
  return selected;
}

function formatNodeCompactSummary(
  entry: ReturnType<ZavorthNodeMeshService['buildSnapshot']>['entries'][number],
): string {
  const pending = entry.pendingInvocations || 0;
  const claimed = entry.claimedInvocations || 0;
  return `- ${entry.label} [${formatNodeKindLabel(entry.kind)}] ${formatNodeStatusHuman(entry.status)} / ${formatCliValue(entry.trustLabel)} | queue ${formatCount(pending, 'pending', 'pendings')}${claimed > 0 ? ` + ${formatCount(claimed, 'processing', 'processing')}` : ''}`;
}

function formatNodeMeshSnapshot(
  snapshot: ReturnType<ZavorthNodeMeshService['buildSnapshot']>,
  options: NodeMeshSnapshotRenderOptions = {},
): string {
  const focusExplicit = options.focusExplicit === true;
  const selected = focusExplicit || snapshot.entries.length <= 1
    ? snapshot.selected
    : null;
  const highlighted = !selected ? pickHighlightedNodes(snapshot.entries, 3) : [];
  const summaryLine = snapshot.summary.total > 0
    ? `${formatCount(snapshot.summary.paired, 'pareado', 'pareados')}, ${formatCount(snapshot.summary.online, 'online', 'online')}, ${formatCount(snapshot.summary.queued, 'item na fila', 'itens na fila')}.`
    : 'Nenhum node registrado now.';
  const panels: CliVisualPanel[] = [
    {
      title: 'Agora',
      lines: [
        `- nodes: ${formatCount(snapshot.summary.total, 'total', 'total')} | ${formatCount(snapshot.summary.online, 'online', 'online')} | ${formatCount(snapshot.summary.paired, 'pareado', 'pareados')}`,
        `- queue: ${formatCount(snapshot.summary.queued, 'item', 'itens')}`,
        `- resumo: ${summaryLine}`,
      ],
      tone: snapshot.summary.online > 0 ? 'info' : 'muted',
    },
  ];

  if (selected) {
    panels.push({
      title: 'Node em foco',
      lines: [
        `- ${selected.label} (${formatNodeKindLabel(selected.kind)})`,
        `- status: ${formatCliValue(selected.trustLabel)} / ${formatNodeStatusHuman(selected.status)}`,
        `- capabilities: ${selected.capabilityIds.join(', ') || 'none declared'}`,
        `- queue: ${formatCount(selected.pendingInvocations || 0, 'pending', 'pendings')} | ${formatCount(selected.claimedInvocations || 0, 'processing', 'processing')}`,
        selected.recentInvocation
          ? `- ultima invocacao: ${selected.recentInvocation.capabilityId} (${formatNodeStatus(selected.recentInvocation.status)})`
          : '- ultima invocacao: none registered',
        `- next step: ${formatCliValue(selected.nextAction || selected.operatorSummary, 'follow the next heartbeat')}`,
      ],
      tone: 'info',
    });
  } else if (highlighted.length > 0) {
    panels.push({
      title: 'Nodes em foco',
      lines: [
        ...highlighted.map((entry) => formatNodeCompactSummary(entry)),
        snapshot.entries.length > highlighted.length
          ? `- ${formatAdditionalCount(snapshot.entries.length - highlighted.length, 'outro node', 'outros nodes')} na malha`
          : null,
      ].filter(Boolean) as string[],
      tone: 'info',
    });
  }

  if (snapshot.suggestedActions.length > 0) {
    const suggested = snapshot.suggestedActions[0];
    panels.push({
      title: 'Faca agora',
      lines: [
        `- ${compactNodeLine(suggested.label, 90)}`,
        `- motivo: ${compactNodeLine(suggested.reason)}`,
        suggested.actionHint ? `- caminho: ${formatNodeActionPath(suggested.actionHint)}` : null,
      ].filter(Boolean) as string[],
      tone: 'brand',
    });
  }

  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: snapshot.summary.online > 0 ? 'info' : 'muted',
    title: 'Node Mesh do Zavorth',
    summary: compactNodeLine(snapshot.narrative.headline),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

function formatNodeMeshActivity(
  activity: NodeMeshActivitySnapshot | null,
  mode: 'queue' | 'history',
  label: string | null = null,
): string {
  const title = mode === 'queue' ? 'Fila do Node Mesh' : 'Historico do Node Mesh';
  if (!activity?.nodeId) {
    return `${title}\n\nNenhum node selecionado para consultar ${mode === 'queue' ? 'a fila' : 'o historico'}.`;
  }

  const items = mode === 'queue' ? activity.activeInvocations : activity.recentInvocations;
  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: mode === 'queue' ? 'warning' : 'info',
    title,
    summary: sanitizeHumanCliText(activity.narrative.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: [
          `- node: ${label || activity.nodeId}`,
          mode === 'queue'
            ? `- queue: ${formatCount(activity.summary.pending, 'pending', 'pendings')} | ${formatCount(activity.summary.claimed, 'processing', 'processing')}`
            : `- historico: ${formatCount(activity.summary.recent, 'recente', 'recentes')} | ${formatCount(activity.summary.completedRecently, 'concluida recentemente', 'concluidas recentemente')}`,
          `- resumo: ${sanitizeHumanCliText(activity.narrative.operatorSummary)}`,
        ],
        tone: mode === 'queue' ? 'warning' : 'info',
      },
      {
        title: 'Invocacoes em foco',
        lines: items.length > 0
          ? items.map((entry) =>
            `- ${entry.capabilityId} (${formatNodeStatus(entry.status)})${entry.resultSummary ? ` :: ${entry.resultSummary}` : ''}`)
          : [mode === 'queue'
            ? '- no pending or processing invocation right now'
            : '- no recent invocation recorded for this node'],
        tone: 'neutral',
      },
      {
        title: 'Faca agora',
        lines: [
          mode === 'queue'
            ? `- zavorth nodes history ${activity.nodeId}`
            : `- zavorth nodes ${activity.nodeId}`,
        ],
        tone: 'brand',
      },
    ],
  });
}

function formatNodeProfiles(profiles: ReturnType<NodeDeviceProfileService['listProfiles']>): string {
  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: 'info',
    title: 'Perfis do Node Mesh',
    summary: 'Escolha o perfil pelo tipo de companion que voce quer colocar na malha.',
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Catalogo',
        lines: profiles.map((profile) =>
          `- ${profile.label} [${profile.id}] :: ${profile.summary} | kind ${profile.kind} | transport ${profile.transport} | capabilities ${profile.defaultCapabilityIds.join(', ') || 'none'} | next step zavorth nodes pair ${profile.kind}`),
        tone: 'info',
      },
    ],
  });
}

function formatNodeCapabilities(capabilities: ReturnType<NodeCapabilityService['listCatalog']>): string {
  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: 'info',
    title: 'Capabilities do Node Mesh',
    summary: 'Catalogo visivel para companions e hosts pareados.',
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Catalogo',
        lines: capabilities.map((capability) =>
          `- ${capability.label} [${capability.id}] :: ${capability.summary} | category ${capability.category} | risk ${capability.risky ? 'high' : 'low'} | next step ${capability.actionHint || 'review before enabling on the host'}`),
        tone: 'info',
      },
    ],
  });
}

function formatNodePairingDraft(draft: ReturnType<NodePairingService['createPairingDraft']>): string {
  const bootstrapCommand = draft.bootstrap?.command
    || `npm run nodes:host -- --base-url <zavorthControl-url> --node-id ${draft.entry.id} --pairing-code ${draft.pairingCode} --capabilities ${draft.entry.capabilityIds.join(',') || 'system.run'}`;
  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: 'success',
    title: 'Node ready para pareamento',
    summary: `${draft.entry.label} ja pode entrar na malha com este draft inicial.`,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: [
          `- perfil: ${draft.profile?.label || draft.entry.profileId || draft.entry.kind}`,
          `- node: ${draft.entry.label} [${draft.entry.id}]`,
          `- pairing code: ${draft.pairingCode}`,
          `- transporte: ${draft.entry.transport}`,
          `- capabilities base: ${draft.entry.capabilityIds.join(', ') || 'sem capabilities declaradas'}`,
        ],
        tone: 'success',
      },
      {
        title: 'No companion',
        lines: [
          '- use o pairing code no host ou sidecar que vai se conectar ao Zavorth',
          '- depois confirme o heartbeat com zavorth nodes list',
          `- se precisar refazer: zavorth nodes pair ${draft.profile?.kind || draft.entry.kind} ${draft.entry.label}`,
        ],
        tone: 'info',
      },
      {
        title: 'Bootstrap sugerido',
        lines: [
          `- ${bootstrapCommand}`,
          draft.bootstrap?.fallbackCommand ? `- fallback: ${draft.bootstrap.fallbackCommand}` : null,
        ].filter(Boolean) as string[],
        tone: 'brand',
      },
    ],
  });
}

function formatNodeInvokeResult(result: ReturnType<NodeInvokeService['invoke']>): string {
  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: result.ok ? 'success' : 'danger',
    title: result.ok ? 'Invocation Sent To Node Mesh' : 'Could Not Send Invocation To Node Mesh',
    summary: result.reason,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: [
          `- node: ${formatCliValue(result.nodeId)}`,
          `- capability: ${result.capabilityId}`,
          `- status: ${formatNodeStatus(result.status)}`,
          result.invocationId ? `- invocation: ${result.invocationId}` : null,
        ].filter(Boolean) as string[],
        tone: result.ok ? 'success' : 'danger',
      },
      {
        title: 'Faca agora',
        lines: [
          result.nodeId ? `- zavorth nodes queue ${result.nodeId}` : null,
          result.nodeId ? `- zavorth nodes history ${result.nodeId}` : null,
        ].filter(Boolean) as string[],
        tone: 'brand',
      },
    ],
  });
}

function resolveNodeIntent(rawArgs: string): {
  mode: 'snapshot' | 'profiles' | 'capabilities' | 'queue' | 'history' | 'doctor';
  selectedNodeId: string | null;
} {
  const normalized = String(rawArgs || '').trim();
  const lower = normalized.toLowerCase();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const head = String(tokens[0] || '').trim().toLowerCase();
  const tail = tokens.slice(1).join(' ').trim() || null;
  if (lower === 'list' || lower === 'all' || lower === 'nodes') {
    return { mode: 'snapshot', selectedNodeId: null };
  }
  if (lower === 'profiles' || lower === 'profile' || lower === 'perfis') {
    return { mode: 'profiles', selectedNodeId: null };
  }
  if (lower === 'capabilities' || lower === 'caps' || lower === 'capabilidades') {
    return { mode: 'capabilities', selectedNodeId: null };
  }
  if (head === 'queue' || head === 'fila' || head === 'pending') {
    return { mode: 'queue', selectedNodeId: tail };
  }
  if (head === 'history' || head === 'historico' || head === 'recent') {
    return { mode: 'history', selectedNodeId: tail };
  }
  if (lower === 'doctor' || lower === 'smoke') {
    return { mode: 'doctor', selectedNodeId: null };
  }
  return {
    mode: 'snapshot',
    selectedNodeId: normalized || null,
  };
}

function parseCliNodePairArgs(rawArgs: string): {
  profileId: string;
  kind: NodeMeshNodeKind | null;
  label: string | null;
} {
  const tokens = String(rawArgs || '').trim().split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  const aliasMap: Record<string, { profileId: string; kind: NodeMeshNodeKind }> = {
    headless: { profileId: 'headless-worker', kind: 'headless' },
    desktop: { profileId: 'desktop-companion', kind: 'desktop' },
    mobile: { profileId: 'mobile-companion', kind: 'mobile' },
    browser: { profileId: 'browser-companion', kind: 'browser' },
  };
  const matched = aliasMap[first];
  if (matched) {
    return {
      profileId: matched.profileId,
      kind: matched.kind,
      label: tokens.slice(1).join(' ').trim() || null,
    };
  }

  return {
    profileId: 'headless-worker',
    kind: 'headless',
    label: String(rawArgs || '').trim() || null,
  };
}

function parseCliNodeInvokeArgs(args: string): {
  nodeId: string;
  capabilityId: string;
  action: string;
  payload: Record<string, unknown> | null;
} | null {
  const trimmed = String(args || '').trim();
  if (!trimmed) {
    return null;
  }
  const segments = trimmed.split(/\s+/);
  if (segments.length < 2) {
    return null;
  }
  const [nodeId, capabilityId, actionCandidate, ...rest] = segments;
  const payload = parseCliNodeInvokePayload(rest.join(' '));
  if (rest.length > 0 && payload === null) {
    return null;
  }
  return {
    nodeId,
    capabilityId,
    action: String(actionCandidate || 'invoke').trim() || 'invoke',
    payload,
  };
}

function parseCliNodeInvokePayload(rawPayload: string): Record<string, unknown> | null {
  const trimmed = String(rawPayload || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch (err: any) { const error = err; const e = err; logger.warn("[auto-fix] Empty catch block", err); }

  const keyValueEntries = trimmed
    .split(/\s+/)
    .map((entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) {
        return null;
      }
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      return key ? [key, value] as const : null;
    });

  if (keyValueEntries.every(Boolean)) {
    return Object.fromEntries(keyValueEntries as Array<readonly [string, string]>);
  }

  return null;
}

export {
  formatNodeCapabilities,
  formatNodeInvokeResult,
  formatNodeMeshActivity,
  formatNodeMeshSnapshot,
  formatNodePairingDraft,
  formatNodeProfiles,
  parseCliNodeInvokeArgs,
  parseCliNodeInvokePayload,
  parseCliNodePairArgs,
  resolveNodeIntent,
};
