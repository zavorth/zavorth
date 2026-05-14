import type {
  SourceProviderCredentialRoute,
  SourceProviderCredentialRouteKind,
  SourceProviderRuntimeId,
} from '../contracts/SourceProviderMeshExpansionContract.js';

export type SourceProviderCredentialRouteInput = {
  providerId: SourceProviderRuntimeId;
  routeKind: SourceProviderCredentialRouteKind;
  requiredEnv?: string[];
  optionalEnv?: string[];
  ownerApprovalRequired?: boolean;
  reason?: string;
  env?: Record<string, string | undefined>;
};

export class SourceProviderCredentialRouteService {
  public buildRoute(input: SourceProviderCredentialRouteInput): SourceProviderCredentialRoute {
    const env = input.env || process.env;
    const requiredEnv = normalizeList(input.requiredEnv);
    const optionalEnv = normalizeList(input.optionalEnv);
    const secretEnv = normalizeList([...requiredEnv, ...optionalEnv].filter((name) =>
      /API_KEY|TOKEN|SECRET|KEY|CREDENTIALS/i.test(name),
    ));
    const presentEnv = [...requiredEnv, ...optionalEnv].filter((name) =>
      Boolean(String(env[name] || '').trim()),
    );
    const missingEnv = requiredEnv.filter((name) => !presentEnv.includes(name));

    return {
      providerId: input.providerId,
      routeKind: input.routeKind,
      status: missingEnv.length === 0
        ? (requiredEnv.length === 0 ? 'optional' : 'configured')
        : 'missing',
      requiredEnv,
      optionalEnv,
      secretEnv,
      presentEnv,
      missingEnv,
      secretValuesSerialized: false,
      ownerApprovalRequired: input.ownerApprovalRequired === true,
      reason: input.reason || defaultReason(input.providerId, input.routeKind),
    };
  }
}

function defaultReason(
  providerId: SourceProviderRuntimeId,
  routeKind: SourceProviderCredentialRouteKind,
): string {
  return `${providerId} uses ${routeKind} credentials through explicit Zavorth Provider Mesh routing.`;
}

function normalizeList(values?: string[]): string[] {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}
