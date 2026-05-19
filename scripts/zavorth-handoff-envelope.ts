import { ZavorthHandoffEnvelopeService } from '../src/services/ZavorthHandoffEnvelopeService.js';

const json = process.argv.includes('--json');

const service = new ZavorthHandoffEnvelopeService();
const snapshot = service.buildEnvelope({
  sessionId: 'demo-session',
  workspace: process.cwd(),
  operator: 'local-operator',
  activeMandate: 'Continue the Mnemos memory upgrade in governed preview mode.',
  architectureDecisions: [
    'Use a Zavorth-native handoff envelope with nine governed sections.',
    'Do not persist HANDOFF.md without approval.',
  ],
  modifiedPaths: [
    'src/services/ZavorthHandoffEnvelopeService.ts',
    'src/contracts/ZavorthHandoffEnvelopeContract.ts',
  ],
  securityApprovals: ['No live execution approval granted.'],
  remainingTodos: ['Implement .zavorth/wiki baseline in phase 3.'],
  nextPrescribedAction: 'Review the envelope, then start phase 3 wiki baseline.',
  messages: [
    {
      role: 'user',
      content: 'Do phase 2 and keep the next phase explicit. token=demo-secret-value',
    },
    {
      role: 'tool',
      toolName: 'shell',
      status: 'error',
      content: 'A previous test timed out while checking docs/mnemos-memory-os.md',
    },
    {
      role: 'assistant',
      content: 'The handoff envelope is ready in preview.',
    },
  ],
  usableContextTokens: 60,
});

if (json) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log(snapshot.markdown);
}
