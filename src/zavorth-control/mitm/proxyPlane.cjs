const path = require("path");
const os = require("os");
const fs = require("fs");
const { ZAVORTH_LEGACY_PROXY_COMPAT } = require("./compat/legacyProxyCompat.cjs");

const ZAVORTH_PROXY_PLANE = {
  productName: "Zavorth",
  dataDirName: "Zavorth",
  compatibilityDataDirName: ZAVORTH_LEGACY_PROXY_COMPAT.dataDirName,
  defaultGatewayBaseUrl: "http://localhost:20128",
  sourceHeader: "x-zavorth-source",
  sourceHeaderValue: "zavorth",
  compatibilitySourceHeader: ZAVORTH_LEGACY_PROXY_COMPAT.sourceHeader,
  compatibilitySourceHeaderValue: ZAVORTH_LEGACY_PROXY_COMPAT.sourceHeaderValue,
  env: {
    apiKey: [
      "ZAVORTH_MITM_API_KEY",
      "ZAVORTH_GATEWAY_API_KEY",
      ...ZAVORTH_LEGACY_PROXY_COMPAT.env.apiKey,
    ],
    baseUrl: [
      "ZAVORTH_MITM_BASE_URL",
      "ZAVORTH_GATEWAY_BASE_URL",
      ...ZAVORTH_LEGACY_PROXY_COMPAT.env.baseUrl,
    ],
  },
};

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getPlatformConfigDir(dirName) {
  const homeDir = os.homedir();
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    return path.join(appData, dirName);
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return path.join(path.resolve(xdgConfigHome), dirName);
  }

  return path.join(homeDir, `.${dirName}`);
}

function getMitmDataDir() {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);

  const canonicalDir = getPlatformConfigDir(ZAVORTH_PROXY_PLANE.dataDirName);
  const legacyDir = getPlatformConfigDir(ZAVORTH_PROXY_PLANE.compatibilityDataDirName);
  if (fs.existsSync(legacyDir) && !fs.existsSync(canonicalDir)) {
    return legacyDir;
  }

  return canonicalDir;
}

function getMitmRouterBaseUrl() {
  return (firstEnv(ZAVORTH_PROXY_PLANE.env.baseUrl) || ZAVORTH_PROXY_PLANE.defaultGatewayBaseUrl)
    .trim()
    .replace(/\/+$/, "");
}

function getMitmApiKey() {
  return firstEnv(ZAVORTH_PROXY_PLANE.env.apiKey) || "";
}

function headerHasValue(headerValue, expectedValue) {
  if (Array.isArray(headerValue)) {
    return headerValue.includes(expectedValue);
  }
  return headerValue === expectedValue;
}

function shouldBypassGatewayLoop(headers) {
  return (
    headerHasValue(headers[ZAVORTH_PROXY_PLANE.sourceHeader], ZAVORTH_PROXY_PLANE.sourceHeaderValue) ||
    headerHasValue(
      headers[ZAVORTH_PROXY_PLANE.compatibilitySourceHeader],
      ZAVORTH_PROXY_PLANE.compatibilitySourceHeaderValue
    )
  );
}

module.exports = {
  ZAVORTH_PROXY_PLANE,
  getMitmApiKey,
  getMitmDataDir,
  getMitmRouterBaseUrl,
  shouldBypassGatewayLoop,
};
