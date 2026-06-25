const ZAVORTH_LEGACY_PROXY_COMPAT = {
  dataDirName: "ZavorthGateway",
  sourceHeader: "x-zavorth-gateway-source",
  sourceHeaderValue: "zavorth-gateway",
  env: {
    apiKey: ["ZavorthGateway_API_KEY"],
    baseUrl: ["ZavorthGateway_BASE_URL", "BASE_URL"],
  },
};

module.exports = {
  ZAVORTH_LEGACY_PROXY_COMPAT,
};
