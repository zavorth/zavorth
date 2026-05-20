import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npmCli = process.env.npm_execpath;
const npmCommand = npmCli && existsSync(npmCli) ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const npmArgs = npmCli && existsSync(npmCli) ? [npmCli] : [];
const jestCli = resolve(root, "node_modules", "jest", "bin", "jest.js");
const tsxCli = resolve(root, "node_modules", "tsx", "dist", "cli.cjs");

const requiredSecurityTests = [
  "tests/security/SupplyChainGuard.test.ts",
  "tests/security/AgentSecurityInventory.test.ts",
  "tests/security/SecurityProfile.test.ts",
  "tests/security/SecurityPolicyBroker.test.ts",
  "tests/security/SecurityOperationalPreset.test.ts",
  "tests/security/OperationalSecurityDoctor.test.ts",
  "tests/security/ContinuousSecurityMonitor.test.ts",
  "tests/services/HighRiskConfirmationService.test.ts",
  "tests/services/SecureStorageService.test.ts",
  "tests/services/WebAppSecurityService.test.ts",
  "tests/ai-gateway/api/AuthBoundary.security.test.ts",
  "tests/ai-gateway/control/ControlWebSocketTicketWiring.test.ts",
  "tests/tools/RemoteShellTool.test.ts",
  "tests/tools/ToolRegistrySecurityCatalog.test.ts",
  "tests/execution/LocalExecutor.test.ts",
  "tests/execution/ToolExecutor.security-policy.test.ts",
  "tests/services/sandbox/SandboxPolicyService.test.ts",
  "tests/mcp/AutomaticBrowserTool.test.ts",
  "tests/security/TrustPlaneTextSanitizer.test.ts",
  "tests/security/UntrustedContent.test.ts",
  "tests/security/LlmEgressGuard.test.ts",
  "tests/security/ToolOutputTrust.test.ts",
  "tests/security/PromptInjectionHardening.test.ts",
  "tests/services/llm/LlmRuntimeService.test.ts",
  "tests/context-engine/ContextEngine.test.ts",
  "tests/context-engine/EpisodicMemoryBridge.security.test.ts",
  "tests/runtime/agent/SkillSnapshotAssembler.test.ts",
  "tests/privacy/PrivacyRedactor.test.ts",
  "tests/privacy/LoggerPrivacy.test.ts",
  "tests/runtime/agent/AgentRunEvidenceStore.privacy.test.ts",
  "tests/agents/ZavorthBridgeExtension.test.ts",
  "tests/services/ZavorthBridgePublicTunnelService.test.ts",
];

const auditWorkspaces = [
  { label: "zavorth", cwd: root, required: true },
  { label: "zavorth-agent", cwd: resolve(root, "agent"), required: true },
  { label: "docs-client", cwd: resolve(root, "..", "docs-client"), required: false },
];

function run(label, command, args, options = {}) {
  console.log(`\n[security-ci] ${label}`);
  const useWindowsCmdShim = process.platform === "win32"
    && npmArgs.length === 0
    && command === npmCommand;
  const spawnCommand = useWindowsCmdShim ? process.env.ComSpec || "cmd.exe" : command;
  const spawnArgs = useWindowsCmdShim ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd ?? root,
    env: {
      ...process.env,
      CI_SECURITY: "1",
      NODE_ENV: process.env.NODE_ENV ?? "test",
    },
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[security-ci] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[security-ci] ${label} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function assertRequiredSecurityTests() {
  const missing = requiredSecurityTests.filter((testPath) => !existsSync(resolve(root, testPath)));
  if (missing.length > 0) {
    console.error("[security-ci] Missing required security regression tests:");
    for (const testPath of missing) {
      console.error(`- ${testPath}`);
    }
    process.exit(1);
  }
}

function runDependencyAudits() {
  for (const workspace of auditWorkspaces) {
    const packageJson = resolve(workspace.cwd, "package.json");
    const lockfile = resolve(workspace.cwd, "package-lock.json");
    if (!existsSync(packageJson) || !existsSync(lockfile)) {
      const message = `[security-ci] ${workspace.label}: package.json/package-lock.json not found`;
      if (workspace.required) {
        console.error(message);
        process.exit(1);
      }
      console.log(`${message}; skipping optional sibling workspace.`);
      continue;
    }

    run(`${workspace.label} npm audit`, npmCommand, [...npmArgs, "audit", "--audit-level=moderate"], {
      cwd: workspace.cwd,
    });
  }
}

assertRequiredSecurityTests();
run("secret guard", npmCommand, [...npmArgs, "run", "security:secrets", "--silent"]);
run("supply-chain guard", npmCommand, [...npmArgs, "run", "security:supply-chain", "--silent"]);
runDependencyAudits();
run("continuous security monitor", process.execPath, [
  tsxCli,
  "scripts/security-continuous.ts",
  "--strict",
  "--require-baseline",
]);
run("runtime typecheck", npmCommand, [...npmArgs, "run", "runtime:check", "--silent"]);
run("focused security regression suite", process.execPath, [
  jestCli,
  ...requiredSecurityTests,
  "--runInBand",
]);

console.log("\n[security-ci] All security gates passed.");
