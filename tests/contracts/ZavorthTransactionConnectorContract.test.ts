import {
  buildZavorthTransactionConnectorContractSnapshot,
  ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION,
  type ZavorthTransactionTypedConnectorDefinition,
} from '../../src/contracts/ZavorthTransactionConnectorContract.js';

describe('ZavorthTransactionConnectorContract', () => {
  const connectors: ZavorthTransactionTypedConnectorDefinition[] = [
    {
      id: 'zavorth.connector.exchange.typed',
      kind: 'exchange',
      displayName: 'Exchange',
      trusted: true,
      enabled: true,
      supportedModes: ['dry-run', 'paper'],
      supportsLive: false,
      rawSecretsAccepted: false,
      credentialMode: 'future-vault-ref',
      requiresApprovalFor: ['trade-order'],
      notes: [],
    },
  ];

  it('publishes the Connector registry typed connector contract', () => {
    const snapshot = buildZavorthTransactionConnectorContractSnapshot(connectors);

    expect(snapshot.version).toBe(ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION);
    expect(snapshot.supportedModes).toEqual(['dry-run', 'sandbox', 'paper']);
    expect(snapshot.connectors[0]).toEqual(expect.objectContaining({
      id: 'zavorth.connector.exchange.typed',
      supportsLive: false,
      rawSecretsAccepted: false,
    }));
  });

  it('documents that connectors stay simulation-only', () => {
    const snapshot = buildZavorthTransactionConnectorContractSnapshot(connectors);

    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        'Connector registry connectors can validate and simulate payloads, but cannot execute live effects.',
        'All connector run results report externalSideEffects=false.',
        'supportsLive remains false for every Connector registry connector.',
      ]),
    );
  });
});
