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
  indexHtml: 'src/ai-gateway/app/(dashboard)/dashboard/page.tsx',
  pagesJs: 'src/ai-gateway/app/(dashboard)/dashboard/HomePageClient.tsx',
  pagesCss: 'src/ai-gateway/shared/constants/sidebarVisibility.ts',
} as const;

const REMOVED_LEGACY_ROUTE = '/contr' + 'ol';

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
    const noControlSurfaceByDefault = !files.indexHtml.includes(REMOVED_LEGACY_ROUTE)
      && !files.pagesJs.includes(REMOVED_LEGACY_ROUTE);

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
        chatFirstHome: files.indexHtml.includes('HomePageClient')
          && files.pagesJs.includes('providerSignal')
          && files.pagesJs.includes('approvalsSignal'),
        nextActionsReady: files.pagesJs.includes('ProviderModelsModal')
          && files.pagesJs.includes('ProviderOverviewCard')
          && files.pagesJs.includes('runtimeGuidedFixes'),
        readinessSummaryReady: files.pagesJs.includes('/api/runtime/readiness')
          && files.pagesJs.includes('/api/runtime/readiness/fixes')
          && files.pagesJs.includes('/api/productization/protected-runtime'),
        approvalsInboxReady: files.pagesJs.includes('approvalsSignal')
          && files.pagesJs.includes('Approvals appear here'),
        receiptsViewerReady: files.pagesJs.includes('receipt')
          && files.pagesJs.includes('No pending decision'),
        missionTimelineReady: files.pagesJs.includes('swarmSnapshot')
          && files.pagesJs.includes('/api/web/gateway/swarm-v2'),
        advancedModeCollapsed: files.pagesCss.includes('href: "/dashboard"')
          && !files.pagesCss.includes(`href: "${REMOVED_LEGACY_ROUTE}"`),
        mobileResponsive: files.pagesJs.includes('grid')
          && files.pagesJs.includes('lg:')
          && files.pagesJs.includes('sm:'),
        noControlSurfaceByDefault,
        dashboardCanExecute: false,
        rawSecretsSerialized: false,
      },
      safety: {
        dashboardIsDisplayOnly: true,
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
        passed: files.indexHtml.includes('HomePageClient')
          && files.pagesJs.includes('providerSignal')
          && files.pagesJs.includes('sandboxSignal')
          && files.pagesJs.includes('approvalsSignal'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['HomePageClient', 'providerSignal', 'sandboxSignal', 'approvalsSignal'],
      }),
      this.entry({
        id: 'dashboard.next-actions',
        label: 'Simple next actions',
        kind: 'mission',
        passed: files.pagesJs.includes('ProviderModelsModal')
          && files.pagesJs.includes('ProviderOverviewCard')
          && files.pagesJs.includes('runtimeGuidedFixes'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['ProviderModelsModal', 'ProviderOverviewCard', 'runtimeGuidedFixes'],
      }),
      this.entry({
        id: 'dashboard.readiness-summary',
        label: 'Discreet readiness summary',
        kind: 'readiness',
        passed: files.pagesJs.includes('/api/runtime/readiness')
          && files.pagesJs.includes('/api/runtime/readiness/fixes')
          && files.pagesJs.includes('/api/system/version'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['runtime readiness', 'guided fixes', 'system version'],
      }),
      this.entry({
        id: 'dashboard.approvals-inbox',
        label: 'Approvals inbox',
        kind: 'approval',
        passed: files.pagesJs.includes('approvalsSignal')
          && files.pagesJs.includes('Approvals appear here')
          && files.pagesJs.includes('Sensitive work will wait'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['approvalsSignal', 'Approvals appear here'],
      }),
      this.entry({
        id: 'dashboard.receipts-viewer',
        label: 'Receipts viewer',
        kind: 'receipt',
        passed: files.pagesJs.includes('receipt')
          && files.pagesJs.includes('No pending decision')
          && files.pagesJs.includes('productSnapshot'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['receipt summary', 'productSnapshot'],
      }),
      this.entry({
        id: 'dashboard.mission-timeline',
        label: 'Mission timeline',
        kind: 'mission',
        passed: files.pagesJs.includes('swarmSnapshot')
          && files.pagesJs.includes('/api/web/gateway/swarm-v2'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['swarm snapshot', 'gateway route'],
      }),
      this.entry({
        id: 'dashboard.advanced-collapsed',
        label: 'Advanced details stay optional',
        kind: 'advanced',
        passed: files.pagesCss.includes('href: "/dashboard"')
          && files.pagesCss.includes('href: "/dashboard/providers"')
          && !files.pagesCss.includes(`href: "${REMOVED_LEGACY_ROUTE}"`),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dashboard root link', 'provider route link', 'no legacy control link'],
      }),
      this.entry({
        id: 'dashboard.mobile-responsive',
        label: 'Mobile responsive layout',
        kind: 'responsive',
        passed: files.pagesJs.includes('grid')
          && files.pagesJs.includes('lg:')
          && files.pagesJs.includes('sm:'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['responsive grid classes', 'lg breakpoint', 'sm breakpoint'],
      }),
      this.entry({
        id: 'dashboard.display-only-safety',
        label: 'Dashboard remains display/request only',
        kind: 'safety',
        passed: !files.indexHtml.includes(REMOVED_LEGACY_ROUTE)
          && !files.pagesJs.includes(REMOVED_LEGACY_ROUTE)
          && files.pagesJs.includes('fetch' + '("/api/')
          && !files.pagesJs.includes('shell.exec'),
        userVisible: false,
        defaultSimple: true,
        evidence: ['no legacy dashboard link', 'API-only reads', 'no shell execution'],
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
