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
    return 'not provided';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function joinList(values: Array<string | null | undefined>, fallback = 'none'): string {
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
  const executor = manifest.executorPreference || 'conversation';
  const command = manifest.command ? ` | ${manifest.command}` : '';
  const approval = manifest.permissions.requiresApproval ? 'approval' : 'free';
  return `- ${manifest.label}: ${manifest.type}/${executor}${command} | risk ${manifest.risk.level} | ${approval}`;
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
    const selected = example.selected?.label || 'Supervised conversation';
    const fallback = joinList(example.fallbackChain);
    return `- ${compact(example.input, 48)} -> ${selected} | fallback ${fallback}`;
  });

  const panels: CliVisualPanel[] = [
    {
      title: 'Now',
      tone: snapshot.summary.highRisk > 0 ? 'warning' : 'success',
      lines: [
        `- ${formatCount(snapshot.summary.total, 'capability', 'capabilities')} registered`,
        `- commands: ${snapshot.summary.commands} | implicit routes: ${snapshot.summary.implicitRoutes}`,
        `- approval: ${snapshot.summary.approvalRequired} | high risk: ${snapshot.summary.highRisk}`,
        `- plugins: ${snapshot.summary.plugin} | MCP allowlist: ${snapshot.summary.mcpAllowlisted}`,
      ],
    },
    {
      title: 'Types',
      tone: 'info',
      lines: [
        `- executors: ${snapshot.summary.byType.executor}`,
        `- workflows: ${snapshot.summary.byType.workflow}`,
        `- research: ${snapshot.summary.byType.research}`,
        `- automation: ${snapshot.summary.byType.automation}`,
        `- integrations: ${snapshot.summary.byType.integration}`,
      ],
    },
    {
      title: 'Focused Routes',
      tone: highlighted.some((manifest) => manifest.risk.level === 'high') ? 'warning' : 'neutral',
      lines: highlighted.map((manifest) => formatManifestLine(manifest)),
    },
    {
      title: 'Local MCP',
      tone: snapshot.mcpHost.serverAllowlist.length > 0 ? 'info' : 'neutral',
      lines: [
        `- mode: ${snapshot.mcpHost.mode}`,
        `- scope: ${snapshot.mcpHost.folderScope} | secrets: ${snapshot.mcpHost.secrets}`,
        `- servers: ${joinList(snapshot.mcpHost.serverAllowlist, 'none allowlisted')}`,
      ],
    },
    {
      title: 'Decision Examples',
      tone: 'brand',
      lines: routeExamples.length > 0
        ? routeExamples
        : ['- zavorth capabilities route "fix a bug in the project"'],
    },
    {
      title: 'Do Now',
      tone: 'brand',
      lines: [
        '- zavorth capabilities list --json',
        '- zavorth capabilities route "research AI news on the web"',
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Capabilities',
    eyebrowTone: snapshot.summary.highRisk > 0 ? 'warning' : 'success',
    title: 'Zavorth Capability OS',
    summary: formatCliValue(snapshot.narrative.headline, 'Capability registry ready for routing.'),
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
      title: 'Choice',
      tone: toneForRisk(decision.decision.riskLevel),
      lines: [
        `- input: ${compact(decision.input, 80)}`,
        `- route: ${selected?.label || 'Supervised conversation'}`,
        `- intent: ${decision.decision.intent}`,
        `- executor: ${decision.decision.executorPreference || 'conversation'}`,
      ],
    },
    {
      title: 'Why',
      tone: 'info',
      lines: [
        `- ${compact(decision.decision.reason, 120)}`,
        `- confidence: ${decision.decision.confidence}`,
        `- risk: ${decision.decision.riskLevel}`,
        `- approval: ${decision.decision.requiresApproval ? 'required' : 'not required'}`,
      ],
    },
    {
      title: 'Fallback',
      tone: 'brand',
      lines: [
        `- chain: ${fallback}`,
        `- artifacts: ${joinList(selected?.artifacts.kinds || [], 'report')}`,
        `- ledger: ${decision.ledger.recorded ? decision.ledger.entryId : decision.ledger.reason}`,
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Router',
    eyebrowTone: toneForRisk(decision.decision.riskLevel),
    title: 'Capability Decision',
    summary: selected ? `Selected ${selected.label} because ${compact(decision.decision.reason, 80)}`
      : 'Kept supervised conversation because no capability passed the threshold.',
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
