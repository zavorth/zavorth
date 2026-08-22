type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function array<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function byId(entries: AnyRecord[]): AnyRecord[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const id = String(entry.id || entry.permission_id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function getProviderRows(state: AnyRecord): AnyRecord[] {
  return byId([
    ...array(record(record(record(state.runtimeApiV1).contracts).providers).providers),
    ...array(record(record(state.agentRuntime).providerCockpit).providers),
  ].map((entry) => record(entry)));
}

export function getChannelRows(state: AnyRecord): AnyRecord[] {
  return byId([
    ...array(record(record(record(state.runtimeApiV1).contracts).channels).channels),
    ...array(record(record(state.agentRuntime).channelCockpit).channels),
  ].map((entry) => record(entry)));
}

export function getApprovals(state: AnyRecord): AnyRecord[] {
  return byId([
    ...array(record(record(record(state.runtimeApiV1).contracts).approvals).data),
    ...array(record(state.approvalPlane).pending),
  ].map((entry) => record(entry)));
}

export function getReceiptCards(state: AnyRecord): AnyRecord[] {
  return byId([
    ...array(record(record(record(state.runtimeApiV1).contracts).receipts).cards),
    ...array(record(record(state.agentRuntime).visualReceipts).cards),
  ].map((entry) => record(entry)));
}

export function getMissionRows(state: AnyRecord): AnyRecord[] {
  const canonical = state?.runtimeApiV1?.contracts?.missions?.data;
  return byId([
    ...array(canonical),
    ...array(record(state.activeMissionUx).missions),
    ...array(record(state.agentRuntime).tasks),
  ].map((entry) => record(entry)));
}
