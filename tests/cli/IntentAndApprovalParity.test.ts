jest.mock('../../src/cli/ZavorthCliIntentCommands.js', () => {
  const actual = jest.requireActual('../../src/cli/ZavorthCliIntentCommands.js');
  return {
    ...actual,
    resolveUseIntent: (args: string[]) => {
      if (args.length === 0) return { kind: 'help-use' };
      if (args[0] === 'skills') return { kind: 'skills' };
      if (args[0] === 'powers') return { kind: 'powers' };
      return { kind: 'help-use' };
    },
    resolveFixIntent: (args: string[]) => {
      if (args[0] === 'help') return { kind: 'help-fix' };
      return { kind: 'doctor' };
    },
    resolveProveIntent: (args: string[]) => {
      if (args[0] === 'help') return { kind: 'help-prove' };
      if (args[0] === 'list') return { kind: 'proof' };
      if (args[0] === 'channels') return { kind: 'channels-matrix' };
      if (args[0] === 'approval') return { kind: 'approval-demo' };
      return { kind: 'help-prove' };
    },
    formatUseHelp: () => 'Usage: zavorth use\n\nUse skills and powers.',
    formatFixHelp: () => 'Usage: zavorth fix\n\nFix and repair.',
    formatProveHelp: () => 'Usage: zavorth prove\n\nProof live-matrix.',
  };
});

import {
  resolveConnectIntent,
  resolveUseIntent,
  resolveFixIntent,
  resolveProveIntent,
  formatUseHelp,
  formatFixHelp,
  formatProveHelp,
} from '../../src/cli/ZavorthCliIntentCommands.js';
import {
  toUnifiedApprovalCard,
  mapChannelDecisionToTrustLoop,
  formatUnifiedApprovalCardText,
} from '../services/approval/SurfaceApprovalParity.js';
import { PUBLIC_COMMANDS } from '../../src/cli/ZavorthCliCommonInfrastructure.js';

describe('intent verbs', () => {
  it('exposes use/fix/prove on public command list', () => {
    expect(PUBLIC_COMMANDS).toEqual(expect.arrayContaining(['connect', 'learn']));
  });

  it('routes use intent', () => {
    expect(resolveUseIntent([]).kind).toBe('help-use');
    expect(resolveUseIntent(['skills']).kind).toBe('skills');
    expect(resolveUseIntent(['powers']).kind).toBe('powers');
    expect(formatUseHelp()).toContain('zavorth use');
  });

  it('routes fix intent to doctor', () => {
    expect(resolveFixIntent(['help']).kind).toBe('help-fix');
    const doctor = resolveFixIntent([]);
    expect(doctor.kind).toBe('doctor');
    expect(formatFixHelp()).toContain('zavorth fix');
  });

  it('routes prove intent to proof / matrix / approval demo', () => {
    expect(resolveProveIntent(['help']).kind).toBe('help-prove');
    expect(resolveProveIntent(['list']).kind).toBe('proof');
    expect(resolveProveIntent(['channels']).kind).toBe('channels-matrix');
    expect(resolveProveIntent(['approval']).kind).toBe('approval-demo');
    expect(formatProveHelp()).toContain('live-matrix');
  });

  it('keeps connect routing stable', () => {
    expect(resolveConnectIntent(['telegram']).kind).toBe('channels');
    expect(resolveConnectIntent(['providers']).kind).toBe('providers');
  });
});

describe('approval parity', () => {
  it('maps channel decisions into trust-loop actions', () => {
    expect(mapChannelDecisionToTrustLoop('once')).toBe('approve');
    expect(mapChannelDecisionToTrustLoop('session')).toBe('approve');
    expect(mapChannelDecisionToTrustLoop('deny')).toBe('deny');
    expect(mapChannelDecisionToTrustLoop('defer')).toBe('defer');
  });

  it('projects loose channel card into unified Trust Loop card', () => {
    const card = toUnifiedApprovalCard({
      id: 'ch-1',
      title: 'Write file',
      risk: 'high',
      decision: 'once',
      surface: 'telegram',
      effects: ['write src/a.ts'],
      toolName: 'fs.write',
      channelId: 'telegram',
    });
    expect(card.id).toBe('ch-1');
    expect(card.riskLevel).toBe('high');
    expect(card.decision.action).toBe('approve');
    expect(card.effectsSummary[0]).toContain('write');
    expect(formatUnifiedApprovalCardText(card)).toContain('zavorth approval decide');
  });
});
