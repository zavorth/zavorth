import {
  NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION,
  decideNaturalFirstRuntimeEntrypoint,
} from '../../src/contracts/NaturalFirstAgentRuntimeContract.js';

describe('NaturalFirstAgentRuntimeContract', () => {
  it('routes free text through ZavorthAgentGateway', () => {
    expect(decideNaturalFirstRuntimeEntrypoint('oi')).toEqual(expect.objectContaining({
      version: NATURAL_FIRST_AGENT_RUNTIME_CONTRACT_VERSION,
      inputKind: 'free-text',
      entrypoint: 'zavorth-agent-gateway',
      gatewayRequired: true,
      commandShortcutAllowed: false,
    }));
  });

  it('keeps slash commands on command-router shortcuts', () => {
    expect(decideNaturalFirstRuntimeEntrypoint('/status')).toEqual(expect.objectContaining({
      inputKind: 'slash-command',
      entrypoint: 'command-router-shortcut',
      gatewayRequired: false,
      commandShortcutAllowed: true,
    }));
  });

  it('keeps explicit operator commands on command-router shortcuts', () => {
    expect(decideNaturalFirstRuntimeEntrypoint('npm run test')).toEqual(expect.objectContaining({
      inputKind: 'operator-command',
      entrypoint: 'command-router-shortcut',
      gatewayRequired: false,
      commandShortcutAllowed: true,
    }));
  });

  it('documents the non-bypass guardrails', () => {
    expect(decideNaturalFirstRuntimeEntrypoint('me explica esse projeto').guardrails).toEqual(expect.arrayContaining([
      expect.stringContaining('ZavorthAgentGateway'),
      expect.stringContaining('tool policy'),
      expect.stringContaining('LLM usage'),
    ]));
  });
});
