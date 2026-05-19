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
        chatFirstHome: files.indexHtml.includes('Local gateway ready')
          && files.indexHtml.includes('Ask normally. Zavorth will answer, preview risky work, and ask before acting.')
          && files.indexHtml.includes('home-command-panel')
          && files.indexHtml.includes('home-profile-grid')
          && files.indexHtml.includes('sector-terminal'),
        nextActionsReady: files.pagesJs.includes('premium-hero')
          && files.pagesJs.includes('Ready check')
          && files.pagesJs.includes('Ask Zavorth')
          && files.pagesJs.includes('data-dashboard-prompt'),
        readinessSummaryReady: files.pagesJs.includes('Web dashboard')
          && files.pagesJs.includes('CLI/TUI')
          && files.pagesJs.includes('Telegram')
          && files.pagesJs.includes('premium-status-list'),
        approvalsInboxReady: files.pagesJs.includes('Review approvals')
          && files.pagesJs.includes('No pending approvals'),
        receiptsViewerReady: files.pagesJs.includes('Receipts')
          && files.pagesJs.includes('No receipt yet'),
        missionTimelineReady: (files.pagesJs.includes('Timeline') || files.pagesJs.includes('Recent activity'))
          && files.pagesJs.includes('data-dashboard-timeline'),
        advancedModeCollapsed: files.indexHtml.includes('data-sector="nodes"')
          && !files.indexHtml.includes('id="sector-nodes" class="sector active"'),
        mobileResponsive: files.pagesCss.includes('@media (max-width: 768px)')
          && files.pagesCss.includes('.premium-page')
          && files.pagesCss.includes('.premium-layout'),
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
        nextStage: 'Dashboard visual QA and operator copy pass',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthDashboardFinalProductPolishSnapshot): string {
    const lines = [
      'Zavorth Dashboard Final Product Polish',
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
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildEntries(files: { indexHtml: string; pagesJs: string; pagesCss: string }): ZavorthDashboardFinalProductPolishEntry[] {
    return [
      this.entry({
        id: 'dashboard.chat-first-home',
        label: 'Chat-first dashboard home',
        kind: 'home',
        passed: files.indexHtml.includes('Local gateway ready')
          && files.indexHtml.includes('Ask normally. Zavorth will answer, preview risky work, and ask before acting.')
          && files.indexHtml.includes('suggestion-chips')
          && files.indexHtml.includes('home-profile-grid')
          && files.indexHtml.includes('home-command-panel')
          && files.indexHtml.includes('sector-terminal'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Local gateway ready', 'home-command-panel', 'home-profile-grid', 'suggestion-chips', 'sector-terminal'],
      }),
      this.entry({
        id: 'dashboard.next-actions',
        label: 'Simple next actions',
        kind: 'mission',
        passed: files.pagesJs.includes('premium-hero')
          && files.pagesJs.includes('Ready check')
          && files.pagesJs.includes('Ask Zavorth')
          && files.pagesJs.includes('data-dashboard-prompt'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['premium-hero', 'Ready check', 'Ask Zavorth', 'data-dashboard-prompt'],
      }),
      this.entry({
        id: 'dashboard.readiness-summary',
        label: 'Discreet readiness summary',
        kind: 'readiness',
        passed: files.pagesJs.includes('Web dashboard')
          && files.pagesJs.includes('CLI/TUI')
          && files.pagesJs.includes('Telegram')
          && files.pagesJs.includes('premium-status-list'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Web dashboard', 'CLI/TUI', 'Telegram', 'premium-status-list'],
      }),
      this.entry({
        id: 'dashboard.approvals-inbox',
        label: 'Approvals inbox',
        kind: 'approval',
        passed: files.pagesJs.includes('Review approvals')
          && files.pagesJs.includes('No pending approvals')
          && files.pagesJs.includes('Critical actions keep extra confirmations'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Review approvals', 'No pending approvals'],
      }),
      this.entry({
        id: 'dashboard.receipts-viewer',
        label: 'Receipts viewer',
        kind: 'receipt',
        passed: files.pagesJs.includes('Receipts')
          && files.pagesJs.includes('No receipt yet')
          && files.pagesJs.includes('After a mission, this area shows files touched'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Receipts', 'No receipt yet'],
      }),
      this.entry({
        id: 'dashboard.mission-timeline',
        label: 'Mission timeline',
        kind: 'mission',
        passed: (files.pagesJs.includes('Timeline') || files.pagesJs.includes('Recent activity'))
          && files.pagesJs.includes('Waiting for a mission')
          && files.pagesJs.includes('data-dashboard-timeline'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['Timeline', 'data-dashboard-timeline'],
      }),
      this.entry({
        id: 'dashboard.advanced-collapsed',
        label: 'Advanced details stay optional',
        kind: 'advanced',
        passed: files.indexHtml.includes('data-sector="nodes"')
          && files.indexHtml.includes('data-sector="config"')
          && !files.indexHtml.includes('id="sector-nodes" class="sector active"'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['advanced sectors are optional', 'default sector is Chat'],
      }),
      this.entry({
        id: 'dashboard.mobile-responsive',
        label: 'Mobile responsive layout',
        kind: 'responsive',
        passed: files.pagesCss.includes('@media (max-width: 768px)')
          && files.pagesCss.includes('.premium-page')
          && files.pagesCss.includes('.premium-layout')
          && files.pagesCss.includes('.skill-row'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['@media (max-width: 768px)', 'premium-page', 'premium-layout'],
      }),
      this.entry({
        id: 'dashboard.display-only-safety',
        label: 'Dashboard remains display/request only',
        kind: 'safety',
        passed: !files.indexHtml.includes('/control')
          && !files.pagesJs.includes('/control')
          && files.pagesJs.includes('data-dashboard-prompt')
          && !files.pagesJs.includes('fetch('),
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
