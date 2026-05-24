export type EffectResourceKind =
  | 'workspace'
  | 'filesystem'
  | 'network'
  | 'secret'
  | 'process'
  | 'memory'
  | 'provider'
  | 'channel'
  | 'time'
  | 'unknown';

export type EffectSensitivity =
  | 'public'
  | 'internal'
  | 'sensitive'
  | 'secret'
  | 'unknown';

export type ResourceRef = {
  kind: EffectResourceKind;
  uri: string;
  sensitivity?: EffectSensitivity;
  metadata?: Record<string, unknown>;
};

export function createResourceRef(input: {
  kind: EffectResourceKind;
  uri: string;
  sensitivity?: EffectSensitivity;
  metadata?: Record<string, unknown>;
}): ResourceRef {
  return {
    kind: input.kind,
    uri: String(input.uri || '').trim(),
    ...(input.sensitivity ? { sensitivity: input.sensitivity } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function sameResourceRef(left: ResourceRef, right: ResourceRef): boolean {
  return left.kind === right.kind && normalizeResourceUri(left.uri) === normalizeResourceUri(right.uri);
}

export function normalizeResourceUri(uri: string): string {
  return String(uri || '').trim().replace(/\\/g, '/');
}
