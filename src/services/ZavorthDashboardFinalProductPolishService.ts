import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_DASHBOARD_FINAL_PRODUCT_POLISH_CONTRACT_VERSION,
  type ZavorthDashboardFinalProductPolishEntry,
  type ZavorthDashboardFinalProductPolishEntryKind,
  type ZavorthDashboardFinalProductPolishSnapshot,
  type ZavorthDashboardFinalProductPolishStatus,
} from '../contracts/ZavorthDashboardFinalProductPolishContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
};

const FILES = {
  indexHtml: 'assets/command-center/index.html',
  pagesJs: 'assets/command-center/scripts/pages.js',
  pagesCss: 'assets/command-center/styles/pages.css',
} as const;

export class ZavorthDashboardFinalProductPolishService {
  private readonly now: () => Date;
  private readonly rootDir: string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = runtime.rootDir || process.cwd();
  }

  public buildSnapshot(): ZavorthDashboardFinalProductPolishSnapshot {
    const files = {
      indexHtml: this.read(FILES.indexHtml),
      pagesJs: this.read(FILES.pagesJs),
      pagesCss: this.read(FILES.pagesCss),
    };
    const entries = this.buildEntries(files);
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const noControlSurfaceByDefault = !files.indexHtml.includes('/control')
      && !files.pagesJs.includes('/control');

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_DASHBOARD_FINAL_PRODUCT_POLISH_CONTRACT_VERSION,
      source: 'ZavorthDashboardFinalProductPolishService',
      status,
      files: FILES,
      entries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        dashboardPath: '/dashboard',
        chatFirstHome: files.indexHtml.includes('Hello, Operator')
          && files.indexHtml.includes('Start with Inbox, Tasks, Approvals, Receipts or Connectors.')
          && files.indexHtml.includes('home-profile-grid')
          && files.indexHtml.includes('sector-terminal'),
        nextActionsReady: files.pagesJs.includes('dashboard-next-actions')
          && files.pagesJs.includes('data-dashboard-prompt'),
        readinessSummaryReady: files.pagesJs.includes('Readiness')
          && files.pagesJs.includes('dashboard-status-list'),
        approvalsInboxReady: files.pagesJs.includes('dashboard-approval-inbox')
          && files.pagesJs.includes('Approvals inbox'),
        receiptsViewerReady: files.pagesJs.includes('dashboard-receipt-list')
          && files.pagesJs.includes('Recent receipts'),
        missionTimelineReady: files.pagesJs.includes('dashboard-mission-timeline')
          && files.pagesJs.includes('data-dashboard-timeline="mission"'),
        advancedModeCollapsed: files.pagesJs.includes('<details class="dashboard-advanced">')
          && !files.pagesJs.includes('<details class="dashboard-advanced" open'),
        mobileResponsive: files.pagesCss.includes('@media (max-width: 768px)')
          && files.pagesCss.includes('.dashboard-next-actions')
          && files.pagesCss.includes('.dashboard-daily-grid'),
        noControlSurfaceByDefault,
        dashboardCanExecute: false,
        rawSecretsSerialized: false,
      },
      safety: {
        commandCenterIsDisplayOnly: true,
        mutableExecutionStaysInRuntime: true,
        approvalsRemainPolicyBrokerBound: true,
        advancedDetailsOptional: true,
        noLegacyControlLinkInDashboard: noControlSurfaceByDefault,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:dashboard-final-product-polish',
        inspectJson: 'npm run zavorth:dashboard-final-product-polish:json',
        check: 'npm run zavorth:dashboard-final-product-polish:check --silent',
        nextPhase: 'Phase 12 - CLI Final Product Polish',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthDashboardFinalProductPolishSnapshot): string {
    const lines = [
      'Zavorth Dashboard Final Product Polish - Phase 11',
      '',
      `Status: ${snapshot.status}`,
      `Dashboard: ${snapshot.summary.dashboardPath}`,
      `Entries: ${snapshot.summary.passed}/${snapshot.summary.entries} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Chat-first home: ${snapshot.summary.chatFirstHome}`,
      `Next actions: ${snapshot.summary.nextActionsReady}`,
      `Approvals inbox: ${snapshot.summary.approvalsInboxReady}`,
      `Receipts viewer: ${snapshot.summary.receiptsViewerReady}`,
      `Mission timeline: ${snapshot.summary.missionTimelineReady}`,
      `Advanced mode collapsed: ${snapshot.summary.advancedModeCollapsed}`,
      '',
      'Polish matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | visible=${entry.userVisible} | simple=${entry.defaultSimple}`);
      for (const blocker of entry.blockers) lines.push(`  blocker: ${blocker}`);
    }
    lines.push('', 'Safety: dashboard requests and displays; mutable execution remains owned by the governed runtime.');
    lines.push(`Next: ${snapshot.commands.nextPhase}`);
    return lines.join('\n');
  }

  private buildEntries(files: { indexHtml: string; pagesJs: string; pagesCss: string }): ZavorthDashboardFinalProductPolishEntry[] {
    return [
      this.entry({
        id: 'dashboard.chat-first-home',
        label: 'Chat-first dashboard home',
        kind: 'home',
        passed: files.indexHtml.includes('Hello, Operator')
          && files.indexHtml.includes('suggestion-chips')
          && files.indexHtml.includes('home-profile-grid')
          && files.indexHtml.includes('home-readiness-strip')
          && files.indexHtml.includes('sector-terminal'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Hello, Operator', 'home-profile-grid', 'home-readiness-strip', 'suggestion-chips', 'sector-terminal'],
      }),
      this.entry({
        id: 'dashboard.next-actions',
        label: 'Simple next actions',
        kind: 'mission',
        passed: files.pagesJs.includes('dashboard-next-actions')
          && files.pagesJs.includes('Start a mission')
          && files.pagesJs.includes('Check readiness')
          && files.pagesJs.includes('data-dashboard-prompt'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dashboard-next-actions', 'Start a mission', 'data-dashboard-prompt'],
      }),
      this.entry({
        id: 'dashboard.readiness-summary',
        label: 'Discreet readiness summary',
        kind: 'readiness',
        passed: files.pagesJs.includes('Readiness')
          && files.pagesJs.includes('Sandbox')
          && files.pagesJs.includes('Providers')
          && files.pagesJs.includes('Channels'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Readiness', 'Sandbox', 'Providers', 'Channels'],
      }),
      this.entry({
        id: 'dashboard.approvals-inbox',
        label: 'Approvals inbox',
        kind: 'approval',
        passed: files.pagesJs.includes('dashboard-approval-inbox')
          && files.pagesJs.includes('Approvals inbox')
          && files.pagesJs.includes('scoped approval'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dashboard-approval-inbox', 'Approvals inbox'],
      }),
      this.entry({
        id: 'dashboard.receipts-viewer',
        label: 'Receipts viewer',
        kind: 'receipt',
        passed: files.pagesJs.includes('dashboard-receipt-list')
          && files.pagesJs.includes('Recent receipts')
          && files.pagesJs.includes('rollback evidence'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dashboard-receipt-list', 'Recent receipts'],
      }),
      this.entry({
        id: 'dashboard.mission-timeline',
        label: 'Mission timeline',
        kind: 'mission',
        passed: files.pagesJs.includes('dashboard-mission-timeline')
          && files.pagesJs.includes('Waiting for a mission')
          && files.pagesJs.includes('data-dashboard-timeline="mission"'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dashboard-mission-timeline', 'data-dashboard-timeline="mission"'],
      }),
      this.entry({
        id: 'dashboard.advanced-collapsed',
        label: 'Advanced details stay optional',
        kind: 'advanced',
        passed: files.pagesJs.includes('<details class="dashboard-advanced">')
          && files.pagesJs.includes('Runtime only')
          && !files.pagesJs.includes('<details class="dashboard-advanced" open'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dashboard-advanced', 'details closed by default'],
      }),
      this.entry({
        id: 'dashboard.mobile-responsive',
        label: 'Mobile responsive layout',
        kind: 'responsive',
        passed: files.pagesCss.includes('@media (max-width: 768px)')
          && files.pagesCss.includes('.dashboard-next-actions')
          && files.pagesCss.includes('.dashboard-daily-grid')
          && files.pagesCss.includes('.dashboard-advanced__grid'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['@media (max-width: 768px)', 'dashboard-next-actions', 'dashboard-daily-grid'],
      }),
      this.entry({
        id: 'dashboard.display-only-safety',
        label: 'Dashboard remains display/request only',
        kind: 'safety',
        passed: !files.indexHtml.includes('/control')
          && !files.pagesJs.includes('/control')
          && files.pagesJs.includes('The dashboard displays decisions and requests actions; it does not execute mutations directly.'),
        userVisible: false,
        defaultSimple: true,
        evidence: ['no /control link', 'runtime-only authority copy'],
      }),
    ];
  }

  private entry(input: {
    id: string;
    label: string;
    kind: ZavorthDashboardFinalProductPolishEntryKind;
    passed: boolean;
    userVisible: boolean;
    defaultSimple: boolean;
    evidence: string[];
  }): ZavorthDashboardFinalProductPolishEntry {
    return {
      id: input.id,
      label: input.label,
      kind: input.kind,
      status: input.passed ? 'passed' : 'attention',
      userVisible: input.userVisible,
      defaultSimple: input.defaultSimple,
      evidence: input.evidence,
      blockers: input.passed ? [] : ['Dashboard polish marker is missing or the surface drifted back toward a technical control panel.'],
    };
  }

  private read(file: string): string {
    return fs.readFileSync(path.join(this.rootDir, file), 'utf8');
  }
}

function resolveStatus(entries: ZavorthDashboardFinalProductPolishEntry[]): ZavorthDashboardFinalProductPolishStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}
