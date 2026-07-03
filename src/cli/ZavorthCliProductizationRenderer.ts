import type {
  ZavorthProductizationContractSnapshot,
  ZavorthProductizationStatus,
} from '../services/ZavorthProductizationContractService.js';
import { formatCliValue } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';

const PRODUCTIZATION_CLI_COMMAND = 'zavorth productization --json';

function toneForStatus(status: ZavorthProductizationStatus): CliVisualPanel['tone'] {
  if (status === 'ready') {
    return 'success';
  }
  if (status === 'partial') {
    return 'warning';
  }
  return 'danger';
}

function mark(status: ZavorthProductizationStatus): string {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'partial') {
    return 'partial';
  }
  return 'blocked';
}

function firstLine(values: string[], fallback: string): string {
  return values.find((value) => String(value || '').trim()) || fallback;
}

export function formatZavorthProductizationContractSnapshot(
  snapshot: ZavorthProductizationContractSnapshot,
): string {
  const blocked = snapshot.blockers.slice(0, 4);
  const controlLines = snapshot.control.items.map((item) =>
    `- ${item.label}: ${mark(item.status)} | ${firstLine(item.evidence, 'sem evidencia')}`,
  );
  const onboardingLines = snapshot.onboarding.areas.map((area) =>
    `- ${area.label}: ${mark(area.status)} | ${firstLine(area.evidence, 'sem evidencia')}`,
  );
  const acceptanceLines = [
    `- usuario comum entende: ${snapshot.acceptance.commonUserUnderstands ? 'sim' : 'nao'}`,
    `- operador audita: ${snapshot.acceptance.operatorCanAudit ? 'sim' : 'nao'}`,
    `- docs/UI/runtime concordam: ${snapshot.acceptance.docsUiRuntimeAgree ? 'sim' : 'nao'}`,
  ];
  const panels: CliVisualPanel[] = [
    {
      title: '/zavorthControl',
      tone: toneForStatus(snapshot.control.status),
      lines: [
        `- rota: ${snapshot.control.route}`,
        `- modo: ${snapshot.control.productMode.label}`,
        `- itens: ready ${snapshot.control.summary.ready} | partial ${snapshot.control.summary.partial} | blocked ${snapshot.control.summary.blocked}`,
        ...controlLines,
      ],
    },
    {
      title: 'CLI e Docs',
      tone: snapshot.cli.sameContract && snapshot.docs.status !== 'blocked' ? 'success' : 'warning',
      lines: [
        `- comando: ${snapshot.cli.command || PRODUCTIZATION_CLI_COMMAND}`,
        `- renderer: ${snapshot.cli.renderer}`,
        `- mesmo contrato: ${snapshot.cli.sameContract ? 'sim' : 'nao'}`,
        `- docs: ${snapshot.docs.status} | ${snapshot.docs.paths.length} arquivo(s)`,
        `- website: ${snapshot.website.status} | promises=${snapshot.website.promisePolicy}`,
      ],
    },
    {
      title: 'Onboarding',
      tone: toneForStatus(snapshot.onboarding.status),
      lines: [
        `- rota: ${snapshot.onboarding.route}`,
        `- areas: ready ${snapshot.onboarding.summary.ready} | partial ${snapshot.onboarding.summary.partial} | blocked ${snapshot.onboarding.summary.blocked}`,
        ...onboardingLines,
      ],
    },
    {
      title: 'Aceite C9',
      tone: toneForStatus(snapshot.status),
      lines: [
        `- status: ${snapshot.status}`,
        `- run ativo: ${formatCliValue(snapshot.activeRunId, 'sem run ativo')}`,
        ...acceptanceLines,
        ...(blocked.length > 0 ? blocked.map((blocker) => `- blocker: ${blocker}`) : ['- blockers: nenhum']),
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Productization',
    eyebrowTone: snapshot.status === 'ready' ? 'success' : snapshot.status === 'partial' ? 'warning' : 'danger',
    title: 'Contrato C9 do Zavorth',
    summary: snapshot.explanation[0] || 'Produto, runtime e docs lendo a mesma verdade.',
    mode: 'compact',
    showWordmark: false,
    panels,
  });
}
