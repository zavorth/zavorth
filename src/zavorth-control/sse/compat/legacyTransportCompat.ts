export const ZAVORTH_LEGACY_TRANSPORT_COMPAT = {
  sessionHeaders: {
    legacy: "X-ZavorthGateway-Session-Id",
  },
  cacheBypassHeaders: {
    legacy: "X-ZavorthGateway-No-Cache",
  },
  requestFlags: {
    legacySkipContextRelay: "_ZavorthGatewaySkipContextRelay",
    legacyInternalRequest: "_ZavorthGatewayInternalRequest",
  },
} as const;
