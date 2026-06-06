#!/usr/bin/env node

import fs from 'node:fs';

const requiredFiles = [
  'src/services/ZavorthRuntimeReadinessService.ts',
  'src/services/ZavorthRuntimeReadinessUxService.ts',
  'src/services/ZavorthRuntimeGuidedFixesService.ts',
  'src/services/ZavorthReadyToGoService.ts',
  'src/services/ZavorthStayOnlineService.ts',
  'src/services/ZavorthProviderLiveProofStoreService.ts',
  'scripts/zavorth-runtime-readiness.ts',
  'scripts/zavorth-runtime-guided-fixes.ts',
  'scripts/zavorth-ready-to-go.ts',
  'scripts/zavorth-stay-online.ts',
  'tests/services/ZavorthRuntimeReadinessService.test.ts',
  'tests/services/ZavorthRuntimeReadinessUxService.test.ts',
  'tests/services/ZavorthRuntimeGuidedFixesService.test.ts',
  'tests/services/ZavorthReadyToGoService.test.ts',
  'tests/services/ZavorthStayOnlineService.test.ts',
  'tests/services/ZavorthProviderLiveProofStoreService.test.ts',
];

const requiredMarkers = {
  'src/services/ZavorthRuntimeReadinessService.ts': [
    'zavorth-runtime-readiness/1',
    'natural-first-runtime',
    'provider-mesh',
    'zavorthControl',
    'telegram',
    'approvals',
    'transaction-plane',
    'skill-imports',
    'memory-continuity',
    'noLiveTransactionExecution',
    'importedSkillsDoNotBypassReview',
  ],
  'scripts/zavorth-runtime-readiness.ts': [
    'ZavorthRuntimeReadinessService',
    'ZavorthRuntimeReadinessUxService',
    '--require-pass',
    '--json',
    '--technical',
  ],
  'src/services/ZavorthRuntimeReadinessUxService.ts': [
    'zavorth-runtime-readiness-ux/1',
    'runtime-readiness-operator-ux',
    'zavorthControlProjection',
    'telegramProjection',
    'showTechnicalDetailsByDefault',
    'executionAuthority: false',
  ],
  'src/services/ZavorthRuntimeGuidedFixesService.ts': [
    'zavorth-runtime-guided-fixes/1',
    'runtime-guided-fixes',
    'provider-live-proof',
    'executionAuthority: false',
    'noHiddenProviderProbe',
  ],
  'src/services/ZavorthProviderLiveProofStoreService.ts': [
    'zavorth-provider-live-proof-store/1',
    'provider-live-proof.json',
    'readFreshHealthMap',
    'writeFromMatrixSnapshot',
    'evidenceHash',
  ],
  'src/services/ZavorthReadyToGoService.ts': [
    'zavorth-ready-to-go/1',
    'Zavorth Ready To Go',
    'providerProbeIsExplicitOperatorAction',
    'noPromptExecution',
    'noLiveTransactionExecution',
  ],
  'src/services/ZavorthStayOnlineService.ts': [
    'zavorth-stay-online/1',
    'Zavorth Stay Online',
    'selfHealIsCommandProposalOnly',
    'noApprovalBypass',
    'buildNotification',
  ],
  'scripts/zavorth-stay-online.ts': [
    'ZavorthStayOnlineService',
    '--watch',
    '--notify-telegram',
    '--max-checks',
    'TELEGRAM_ALLOWED_USER_IDS',
  ],
  'src/zavorth-cli.ts': [
    'runReadyToGo',
    'runStayOnline',
    "command === 'ready'",
    "command === 'stay-online'",
    "command === 'readiness'",
    'runRuntimeReadiness',
    'runRuntimeGuidedFixes',
    'runRuntimeReadinessFixProvider',
    "action === 'fix'",
    'ZavorthRuntimeReadinessUxService',
    '--technical',
  ],
  'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts': [
    "pathname === '/api/runtime/ready-to-go'",
    "pathname === '/api/runtime/stay-online'",
    "pathname === '/api/runtime/readiness'",
    "pathname === '/api/runtime/readiness/fixes'",
    'runtimeReadinessUx',
    'runtimeGuidedFixes',
    'stayOnline',
    'ZavorthRuntimeReadinessUxService',
  ],
  'assets/zavorth-control/scripts/pages.js': [
    'Ready check',
    'Run Zavorth Ready To Go',
    'Stay Online status',
    'Ask Zavorth',
    'Provider',
  ],
  'src/telegram/TelegramCommandRoutingService.ts': [
    '/ready',
    '/stayonline',
    '/readiness',
    '/fixes',
    'handleReadiness',
    'handleReadinessFixes',
    'handleReadyToGo',
    'handleStayOnline',
  ],
  'src/telegram/controllers/TelegramOpsController.ts': [
    'handleReadiness',
    'handleReadinessFixes',
    'handleReadyToGo',
    'handleStayOnline',
    'ZavorthRuntimeReadinessUxService',
    'ZavorthRuntimeGuidedFixesService',
    'ZavorthReadyToGoService',
    'ZavorthStayOnlineService',
  ],
  'package.json': [
    'zavorth:ready-to-go',
    'zavorth:stay-online',
    'zavorth:runtime-readiness',
    'zavorth:runtime-guided-fixes',
    'zavorth:runtime-readiness:check',
  ],
};

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`missing required file: ${file}`);
  }
}

for (const [file, markers] of Object.entries(requiredMarkers)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const marker of markers) {
    if (!content.includes(marker)) {
      throw new Error(`${file} missing marker: ${marker}`);
    }
  }
}

console.log('[zavorth-runtime-readiness-check] ok');
