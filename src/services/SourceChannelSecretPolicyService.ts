import type {
  ChannelRuntimeId,
  ChannelSecretPolicyReceipt,
} from '../contracts/SourceChannelMeshExpansionContract.js';

export type ChannelSecretPolicyInput = {
  channelId: ChannelRuntimeId;
  requiredSecretRefs?: string[];
  optionalSecretRefs?: string[];
  allowlistRefs?: string[];
  env?: Record<string, string | undefined>;
};

export class SourceChannelSecretPolicyService {
  public buildReceipt(input: ChannelSecretPolicyInput): ChannelSecretPolicyReceipt {
    const env = input.env || process.env;
    const requiredSecretRefs = normalizeList(input.requiredSecretRefs);
    const optionalSecretRefs = normalizeList(input.optionalSecretRefs);
    const allowlistRefs = normalizeList(input.allowlistRefs);
    const missingRequiredSecretRefs = requiredSecretRefs.filter((name) => !hasValue(env, name));
    const missingAllowlistRefs = allowlistRefs.filter((name) => !hasValue(env, name));

    return {
      channelId: input.channelId,
      status: missingRequiredSecretRefs.length === 0 && missingAllowlistRefs.length === 0 ? 'passed' : 'failed',
      requiredSecretRefs,
      optionalSecretRefs,
      allowlistRefs,
      rawSecretValuesAccepted: false,
      missingRequiredSecretRefs,
      missingAllowlistRefs,
      secretValuesSerialized: false,
    };
  }
}

function hasValue(env: Record<string, string | undefined>, name: string): boolean {
  return Boolean(String(env[name] || '').trim());
}

function normalizeList(values?: string[]): string[] {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}
