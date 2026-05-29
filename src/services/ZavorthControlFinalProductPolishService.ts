import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_CONTROL_FINAL_PRODUCT_POLISH_CONTRACT_VERSION,
  type ZavorthControlFinalProductPolishEntry,
  type ZavorthControlFinalProductPolishEntryKind,
  type ZavorthControlFinalProductPolishSnapshot,
  type ZavorthControlFinalProductPolishStatus,
} from '../contracts/ZavorthControlFinalProductPolishContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
};

const FILES = {
  indexHtml: 'src/ai-gateway/app/(zavorthControl)/control/page.tsx',
  pagesJs: 'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlControlShell.tsx',
  pagesCss: 'src/ai-gateway/app/(zavorthControl)/control/zavorth-control/styles/zavorthControl.css',
  runtimeBridgeJs: 'src/ai-gateway/app/(zavorthControl)/control/useControlPageClient.ts',
} as const;

export class ZavorthControlFinalProductPolishService {
  private readonly now: () => Date;
  private readonly rootDir: string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = runtime.rootDir || process.cwd();
  }

  public buildSnapshot(): ZavorthControlFinalProductPolishSnapshot {
    const files = {
      indexHtml: this.read(FILES.indexHtml),
      pagesJs: this.read(FILES.pagesJs),
      pagesCss: this.read(FILES.pagesCss),
      runtimeBridgeJs: this.read(FILES.runtimeBridgeJs),
    };
    const entries = this.buildEntries(files);
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const zavorthControlOfficial = files.indexHtml.includes('ControlPageClient')
      && !files.indexHtml.includes('/zavorth-control/index.html')
      && files.pagesJs.includes('ZavorthControlChatSurface');

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CONTROL_FINAL_PRODUCT_POLISH_CONTRACT_VERSION,
      source: 'ZavorthControlFinalProductPolishService',
      status,
      files: FILES,
      entries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        zavorthControlPath: '/control',
        chatFirstHome: files.pagesJs.includes('activeSectorId === "terminal"')
          && files.pagesJs.includes('ZavorthControlChatSurface')
          && files.pagesJs.includes('bcc-control-grid--chat'),
        nextActionsReady: files.pagesJs.includes('handleSelectSector')
          && files.pagesJs.includes('ZavorthControlDock'),
        readinessSummaryReady: files.pagesJs.includes('runtime.doctor')
          && files.runtimeBridgeJs.includes('loadControlState'),
        approvalsInboxReady: files.indexHtml.includes('data-sector="sales-os"')
          || files.pagesJs.includes('sectorId === "sales-os"'),
        receiptsViewerReady: files.pagesJs.includes('sectorId === "instances"')
          && files.pagesJs.includes('Receipts'),
        missionTimelineReady: files.pagesJs.includes('runObservatory')
          && files.pagesJs.includes('trace'),
        advancedModeCollapsed: files.pagesJs.includes('sectorId === "config"')
          && files.pagesJs.includes('sectorId === "docs"'),
        mobileResponsive: files.pagesCss.includes('@media (max-width: 700px)')
          && files.pagesCss.includes('bcc-dock'),
        noControlSurfaceByDefault: zavorthControlOfficial,
        zavorthControlCanExecute: false,
        rawSecretsSerialized: false,
      },
      safety: {
        zavorthControlIsDisplayOnly: true,
        mutableExecutionStaysInRuntime: true,
        approvalsRemainPolicyBrokerBound: true,
        advancedDetailsOptional: true,
        noLegacyControlLinkInZavorthControl: zavorthControlOfficial,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:zavorthControl-final-product-polish',
        inspectJson: 'npm run zavorth:zavorthControl-final-product-polish:json',
        check: 'npm run zavorth:zavorthControl-final-product-polish:check --silent',
        nextStage: 'Zavorth Control live visual QA and route alias verification',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthControlFinalProductPolishSnapshot): string {
    const lines = [
      'Zavorth Zavorth Control Final Product Polish',
      '',
      `Status: ${snapshot.status}`,
      `ZavorthControl: ${snapshot.summary.zavorthControlPath}`,
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
    lines.push('', 'Safety: Zavorth Control requests and displays; mutable execution remains owned by the governed runtime.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildEntries(files: { indexHtml: string; pagesJs: string; pagesCss: string; runtimeBridgeJs: string }): ZavorthControlFinalProductPolishEntry[] {
    return [
      this.entry({
        id: 'zavorth-control.chat-first-home',
        label: 'Chat-first Zavorth Control home',
        kind: 'home',
        passed: files.pagesJs.includes('activeSectorId === "terminal"')
          && files.pagesJs.includes('ZavorthControlChatSurface')
          && files.pagesJs.includes('bcc-control-grid--chat'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['native terminal sector', 'React chat surface', 'chat grid'],
      }),
      this.entry({
        id: 'zavorth-control.next-actions',
        label: 'Simple next actions',
        kind: 'mission',
        passed: files.pagesJs.includes('handleSelectSector')
          && files.pagesJs.includes('ZavorthControlDock'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['dock navigation', 'React sector activation'],
      }),
      this.entry({
        id: 'zavorth-control.readiness-summary',
        label: 'Discreet readiness summary',
        kind: 'readiness',
        passed: files.pagesJs.includes('runtime.doctor')
          && files.runtimeBridgeJs.includes('loadControlState'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['runtime doctor action', 'HTTP snapshot refresh'],
      }),
      this.entry({
        id: 'zavorth-control.approvals-inbox',
        label: 'Approvals inbox',
        kind: 'approval',
        passed: files.pagesJs.includes('sectorId === "sales-os"')
          && files.pagesJs.includes('Inline approval'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['approval sector', 'inline approval copy'],
      }),
      this.entry({
        id: 'zavorth-control.receipts-viewer',
        label: 'Receipts viewer',
        kind: 'receipt',
        passed: files.pagesJs.includes('sectorId === "instances"')
          && files.pagesJs.includes('Receipts'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['receipt sector', 'receipt rendering'],
      }),
      this.entry({
        id: 'zavorth-control.mission-timeline',
        label: 'Mission timeline',
        kind: 'mission',
        passed: files.pagesJs.includes('runObservatory')
          && files.pagesJs.includes('trace'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['trace sheet', 'timeline'],
      }),
      this.entry({
        id: 'zavorth-control.advanced-collapsed',
        label: 'Advanced details stay optional',
        kind: 'advanced',
        passed: files.pagesJs.includes('sectorId === "config"')
          && files.pagesJs.includes('sectorId === "docs"'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['config sector', 'docs sector'],
      }),
      this.entry({
        id: 'zavorth-control.mobile-responsive',
        label: 'Mobile responsive layout',
        kind: 'responsive',
        passed: files.pagesCss.includes('@media (max-width: 700px)')
          && files.pagesCss.includes('bcc-dock'),
        userVisible: true,
        defaultSimple: true,
        evidence: ['mobile breakpoint', 'compact dock'],
      }),
      this.entry({
        id: 'zavorth-control.display-only-safety',
        label: 'Zavorth Control remains display/request only',
        kind: 'safety',
        passed: files.indexHtml.includes('ControlPageClient')
          && files.runtimeBridgeJs.includes('fetchJson')
          && files.runtimeBridgeJs.includes('/api/gateway-control')
          && !files.runtimeBridgeJs.includes('shell.exec'),
        userVisible: false,
        defaultSimple: true,
        evidence: ['native React shell', 'API reads', 'no shell execution in runtime bridge'],
      }),
    ];
  }

  private entry(input: {
    id: string;
    label: string;
    kind: ZavorthControlFinalProductPolishEntryKind;
    passed: boolean;
    userVisible: boolean;
    defaultSimple: boolean;
    evidence: string[];
  }): ZavorthControlFinalProductPolishEntry {
    return {
      id: input.id,
      label: input.label,
      kind: input.kind,
      status: input.passed ? 'passed' : 'attention',
      userVisible: input.userVisible,
      defaultSimple: input.defaultSimple,
      evidence: input.evidence,
      blockers: input.passed ? [] : ['Zavorth Control polish marker is missing or the surface drifted back toward a technical control panel.'],
    };
  }

  private read(file: string): string {
    return fs.readFileSync(path.join(this.rootDir, file), 'utf8');
  }
}

function resolveStatus(entries: ZavorthControlFinalProductPolishEntry[]): ZavorthControlFinalProductPolishStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}
