import {
  renderPremiumKeyValueTable,
  renderZavorthPremiumCliScreen,
  type ZavorthPremiumCliPanel,
} from '../premium/index.js';
import type { ZavorthCliApprovalDiffSnapshot } from './ZavorthCliApprovalDiffTypes.js';
import { TerminalDiff } from '../presentation/TerminalDiff.js';

export function renderZavorthCliApprovalDiff(snapshot: ZavorthCliApprovalDiffSnapshot): string {
  const panels: ZavorthPremiumCliPanel[] = [
    ...snapshot.cards.slice(0, 6).map((card): ZavorthPremiumCliPanel => ({
      title: `${card.title} (${card.riskLevel})`,
      accent: card.riskLevel === 'critical' || card.riskLevel === 'high' ? 'rose' : card.riskLevel === 'medium' ? 'amber' : 'emerald',
      lines: [
        ...renderPremiumKeyValueTable([
          { key: 'id', value: card.id, accent: 'cyan' },
          { key: 'status', value: `${card.status}/${card.approvalStatus}`, accent: card.approvalStatus === 'pending' ? 'amber' : 'emerald' },
          { key: 'domain', value: card.domain },
          { key: 'action', value: card.actionId },
          { key: 'expires', value: card.expiresAt },
          { key: 'external', value: card.resourceImpact.externalExposure },
          { key: 'diffs', value: `${card.diffCount}` },
        ]).split('\n'),
        '',
        card.summary,
        '',
        `approval: ${card.approvalReason}`,
        ...formatOptionalList('files', card.files),
        ...formatOptionalList('commands', card.commands),
        ...formatOptionalList('validation', card.validationPlan),
        ...formatOptionalList('rollback', card.rollbackPlan),
      ],
    })),
    ...renderDiffPanels(snapshot),
  ];

  if (panels.length === 0) {
    panels.push({
      title: snapshot.view === 'diff' ? 'Diff review' : 'Approvals',
      accent: 'emerald',
      lines: ['No pending governed plans found.'],
    });
  }

  return renderZavorthPremiumCliScreen({
    title: snapshot.view === 'diff' ? 'Diff Review' : 'Approvals',
    subtitle: snapshot.decision.message,
    mode: 'compact',
    statusRows: [
      { label: 'Pending', value: `${snapshot.summary.pending}`, status: snapshot.summary.pending > 0 ? 'waiting' : 'ready' },
      { label: 'Approved', value: `${snapshot.summary.approved}`, status: 'ready' },
      { label: 'Blocked', value: `${snapshot.summary.blocked}`, status: snapshot.summary.blocked > 0 ? 'blocked' : 'ready' },
      { label: 'Diff entries', value: `${snapshot.summary.diffEntries}`, status: snapshot.summary.diffEntries > 0 ? 'warning' : 'ready' },
    ],
    panels,
    actions: snapshot.nextActions.map((action) => ({
      label: action.label,
      command: action.command,
      detail: action.detail,
      accent: action.command.includes('--yes') ? 'amber' : 'cyan',
    })),
    notice: {
      title: 'Approval is preview-only',
      body: 'This surface can approve a mutation plan only when --yes is explicit. It never applies changes to the host by itself.',
    },
  });
}

function renderDiffPanels(snapshot: ZavorthCliApprovalDiffSnapshot): ZavorthPremiumCliPanel[] {
  if (snapshot.view !== 'diff') {
    return [];
  }
  return snapshot.diffs.slice(0, 8).map((diffEntry) => {
    let diffLines: string[] = [];
    if (diffEntry.before !== null || diffEntry.after !== null) {
      const renderedDiff = TerminalDiff.render(diffEntry.before ?? '', diffEntry.after ?? '', {
        fileName: diffEntry.path,
      });
      diffLines = renderedDiff.split('\n');
    } else {
      diffLines = ['no content changes'];
    }
    return {
      title: `Diff ${diffEntry.path}`,
      accent: diffEntry.riskLevel === 'critical' || diffEntry.riskLevel === 'high' ? 'rose' : diffEntry.riskLevel === 'medium' ? 'amber' : 'cyan',
      lines: [
        `plan: ${diffEntry.planId}`,
        `risk: ${diffEntry.riskLevel}`,
        diffEntry.summary,
        '',
        ...diffLines,
      ],
    };
  });
}

function formatOptionalList(label: string, values: string[]): string[] {
  if (values.length === 0) {
    return [];
  }
  return [
    '',
    `${label}:`,
    ...values.slice(0, 6).map((value) => `- ${value}`),
  ];
}
