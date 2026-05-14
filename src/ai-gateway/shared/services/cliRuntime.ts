import {
  CLI_TOOLS,
  getLookupEnv,
  getRuntimeMode,
  resolveToolEnvCommand,
  resolveToolCommands,
} from "./cli-runtime/cliRuntimeTools.ts";
import {
  checkRunnable,
  locateCommandCandidate,
} from "./cli-runtime/cliRuntimeDiscovery.ts";

export {
  ensureCliConfigWriteAllowed,
  getCliConfigHome,
  getCliConfigPaths,
  getCliPrimaryConfigPath,
  getOpenCodeConfigPath,
  isCliConfigWriteAllowed,
  resolveOpencodeConfigDir,
  resolveOpencodeConfigPath,
} from "./cli-runtime/cliRuntimeConfig.ts";

export { CLI_TOOL_IDS } from "./cli-runtime/cliRuntimeTools.ts";

export const getCliRuntimeStatus = async (toolId: string) => {
  const tool = CLI_TOOLS[toolId];
  const runtimeMode = getRuntimeMode();
  if (!tool) {
    return {
      installed: false,
      runnable: false,
      command: null,
      commandPath: null,
      reason: "unknown_tool",
      runtimeMode,
      requiresBinary: false,
    };
  }

  const env = getLookupEnv();
  const commands = resolveToolCommands(toolId);
  const requiresBinary = tool.requiresBinary !== false;

  if (!requiresBinary && commands.length === 0) {
    return {
      installed: true,
      runnable: true,
      command: null,
      commandPath: null,
      reason: "not_required",
      runtimeMode,
      requiresBinary,
    };
  }

  const envCommand = resolveToolEnvCommand(toolId);
  const hasEnvOverride = !!envCommand;
  const located = await locateCommandCandidate(commands, env, hasEnvOverride ? undefined : toolId);
  const command = located.command;

  if (!located.installed) {
    return {
      installed: false,
      runnable: false,
      command,
      commandPath: null,
      reason: located.reason || "not_found",
      runtimeMode,
      requiresBinary,
    };
  }

  if (located.reason === "not_executable") {
    return {
      installed: true,
      runnable: false,
      command,
      commandPath: located.commandPath,
      reason: "not_executable",
      runtimeMode,
      requiresBinary,
    };
  }

  const healthcheck = await checkRunnable(
    located.commandPath,
    env,
    Number(tool.healthcheckTimeoutMs || 4000)
  );
  return {
    installed: true,
    runnable: healthcheck.runnable,
    command,
    commandPath: located.commandPath,
    reason: healthcheck.reason,
    runtimeMode,
    requiresBinary,
  };
};
