import type {
  ZavorthCapabilityOsManifest,
  ZavorthCapabilityOsRouteDecision,
  ZavorthCapabilityOsSnapshot,
} from '../services/ZavorthCapabilityOsService.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';

function compact(value: string | null | undefined, maxLength = 96): string {
  const normalized = sanitizeHumanCliText(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'nao informado';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function joinList(values: Array<string | null | undefined>, fallback = 'nenhum'): string {
  const filtered = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return filtered.length > 0 ? filtered.join(' -> ') : fallback;
}

function toneForRisk(risk: string | null | undefined): CliVisualPanel['tone'] {
  if (risk === 'high') {
    return 'warning';
  }
  if (risk === 'medium') {
    return 'info';
  }
  return 'neutral';
}

function formatManifestLine(manifest: ZavorthCapabilityOsManifest): string {
  const executor = manifest.executorPreference || 'conversa';
  const command = manifest.command ? ` | ${manifest.command}` : '';
  const approval = manifest.permissions.requiresApproval ? 'aprova' : 'livre';
  return `- ${manifest.label}: ${manifest.type}/${executor}${command} | risco ${manifest.risk.level} | ${approval}`;
}

export function formatCapabilityOsSnapshot(snapshot: ZavorthCapabilityOsSnapshot): string {
  const highlighted = [...snapshot.manifests]
    .sort((left, right) => {
      const riskWeight = (value: ZavorthCapabilityOsManifest) =>
        value.risk.level === 'high' ? 3 : value.risk.level === 'medium' ? 2 : 1;
      return riskWeight(right) - riskWeight(left)
        || Number(right.routing.confidence || 0) - Number(left.routing.confidence || 0)
        || left.label.localeCompare(right.label);
    })
    .slice(0, 6);

  const routeExamples = snapshot.examples.slice(0, 4).map((example) => {
    const selected = example.selected?.label || 'Conversa supervisionada';
    const fallback = joinList(example.fallbackChain);
    return `- ${compact(example.input, 48)} -> ${selected} | fallback ${fallback}`;
  });

  const panels: CliVisualPanel[] = [
    {
      title: 'Agora',
      tone: snapshot.summary.highRisk > 0 ? 'warning' : 'success',
      lines: [
        `- ${formatCount(snapshot.summary.total, 'capability', 'capabilities')} registradas`,
        `- comandos: ${snapshot.summary.commands} | rotas implicitas: ${snapshot.summary.implicitRoutes}`,
        `- aprovacao: ${snapshot.summary.approvalRequired} | risco alto: ${snapshot.summary.highRisk}`,
        `- plugins: ${snapshot.summary.plugin} | MCP allowlist: ${snapshot.summary.mcpAllowlisted}`,
      ],
    },
    {
      title: 'Tipos',
      tone: 'info',
      lines: [
        `- executores: ${snapshot.summary.byType.executor}`,
        `- workflows: ${snapshot.summary.byType.workflow}`,
        `- pesquisa: ${snapshot.summary.byType.research}`,
        `- automacao: ${snapshot.summary.byType.automation}`,
        `- integracoes: ${snapshot.summary.byType.integration}`,
      ],
    },
    {
      title: 'Rotas em foco',
      tone: highlighted.some((manifest) => manifest.risk.level === 'high') ? 'warning' : 'neutral',
      lines: highlighted.map((manifest) => formatManifestLine(manifest)),
    },
    {
      title: 'MCP local',
      tone: snapshot.mcpHost.serverAllowlist.length > 0 ? 'info' : 'neutral',
      lines: [
        `- modo: ${snapshot.mcpHost.mode}`,
        `- escopo: ${snapshot.mcpHost.folderScope} | secrets: ${snapshot.mcpHost.secrets}`,
        `- servidores: ${joinList(snapshot.mcpHost.serverAllowlist, 'nenhum allowlisted')}`,
      ],
    },
    {
      title: 'Exemplos de decisao',
      tone: 'brand',
      lines: routeExamples.length > 0
        ? routeExamples
        : ['- zavorth capabilities route "corrija um bug no projeto"'],
    },
    {
      title: 'Faca agora',
      tone: 'brand',
      lines: [
        '- zavorth capabilities list --json',
        '- zavorth capabilities route "pesquise noticias de IA na web"',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Capabilities',
    eyebrowTone: snapshot.summary.highRisk > 0 ? 'warning' : 'success',
    title: 'Capability OS do Zavorth',
    summary: formatCliValue(snapshot.narrative.headline, 'Registry de capabilities pronto para roteamento.'),
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}

export function formatCapabilityOsRouteDecision(decision: ZavorthCapabilityOsRouteDecision): string {
  const selected = decision.selected;
  const fallback = joinList(decision.fallbackChain);
  const panels: CliVisualPanel[] = [
    {
      title: 'Escolha',
      tone: toneForRisk(decision.decision.riskLevel),
      lines: [
        `- entrada: ${compact(decision.input, 80)}`,
        `- rota: ${selected?.label || 'Conversa supervisionada'}`,
        `- intent: ${decision.decision.intent}`,
        `- executor: ${decision.decision.executorPreference || 'conversa'}`,
      ],
    },
    {
      title: 'Porque',
      tone: 'info',
      lines: [
        `- ${compact(decision.decision.reason, 120)}`,
        `- confianca: ${decision.decision.confidence}`,
        `- risco: ${decision.decision.riskLevel}`,
        `- aprovacao: ${decision.decision.requiresApproval ? 'necessaria' : 'nao necessaria'}`,
      ],
    },
    {
      title: 'Fallback',
      tone: 'brand',
      lines: [
        `- cadeia: ${fallback}`,
        `- artefatos: ${joinList(selected?.artifacts.kinds || [], 'relatorio')}`,
        `- ledger: ${decision.ledger.recorded ? decision.ledger.entryId : decision.ledger.reason}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Router',
    eyebrowTone: toneForRisk(decision.decision.riskLevel),
    title: 'Decisao de capability',
    summary: selected
      ? `Escolhi ${selected.label} porque ${compact(decision.decision.reason, 80)}`
      : 'Mantive em conversa supervisionada porque nenhuma capability passou do limiar.',
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
