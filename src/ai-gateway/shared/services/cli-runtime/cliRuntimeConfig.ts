import os from "os";
import path from "path";
import {
  DANGEROUS_PATH_CHARS,
  isPathWithin,
} from "./cliRuntimePathSecurity.ts";
import {
  CLI_TOOLS,
  parseBoolean,
} from "./cliRuntimeTools.ts";

export const isCliConfigWriteAllowed = () =>
  parseBoolean(process.env.CLI_ALLOW_CONFIG_WRITES, true);

export const ensureCliConfigWriteAllowed = () => {
  if (isCliConfigWriteAllowed()) return null;
  return "CLI config writes are disabled (CLI_ALLOW_CONFIG_WRITES=false)";
};

export const getCliConfigHome = () => {
  const override = String(process.env.CLI_CONFIG_HOME || "").trim();
  if (!override) return os.homedir();

  if (!path.isAbsolute(override)) return os.homedir();
  if (DANGEROUS_PATH_CHARS.some((c) => override.includes(c))) return os.homedir();
  if (path.normalize(override).includes("..")) return os.homedir();

  const home = os.homedir();
  const normalized = path.normalize(override);
  if (!isPathWithin(normalized, home)) {
    return home;
  }

  return normalized;
};

export const resolveOpencodeConfigDir = (
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir()
) => {
  const isWin = platform === "win32";
  if (isWin) {
    const appData = String(env.APPDATA || "").trim();
    return appData || path.join(homeDir, "AppData", "Roaming");
  }

  const xdgConfigHome = String(env.XDG_CONFIG_HOME || "").trim();
  return xdgConfigHome || path.join(homeDir, ".config");
};

export const resolveOpencodeConfigPath = (
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir()
) => path.join(resolveOpencodeConfigDir(platform, env, homeDir), "opencode", "opencode.json");

export const getOpenCodeConfigPath = () => resolveOpencodeConfigPath();

export const getCliConfigPaths = (toolId: string) => {
  const tool = CLI_TOOLS[toolId];
  if (!tool) return null;

  if (toolId === "opencode") {
    return {
      config: getOpenCodeConfigPath(),
    };
  }

  const home = getCliConfigHome();
  return Object.fromEntries(
    Object.entries(tool.paths).map(([key, relativePath]) => [
      key,
      path.join(home, relativePath as string),
    ])
  );
};

export const getCliPrimaryConfigPath = (toolId: string) => {
  const paths = getCliConfigPaths(toolId);
  if (!paths) return null;
  const firstKey = Object.keys(paths)[0];
  return firstKey ? paths[firstKey] : null;
};
