import type { ExecutionRequest } from '../../contracts/ExecutionContract.js';
import type { SandboxLanguage, SandboxSecurityLevel } from './ISandboxRuntime.js';

const TEST_COMMAND_PATTERNS = [
  /\bnpm\s+test\b/i,
  /\bpnpm\s+test\b/i,
  /\byarn\s+test\b/i,
  /\bpytest\b/i,
  /\bgo\s+test\b/i,
  /\bcargo\s+test\b/i,
  /\bvitest\b/i,
  /\bjest\b/i,
];

const CODE_CAPABLE_EXECUTION_PATTERNS = [
  /\bnode(?:\.exe)...\b/i,
  /\bnpm(?:\.cmd)...\b/i,
  /\bnpx(?:\.cmd)...\b/i,
  /\bpnpm(?:\.cmd)...\b/i,
  /\byarn(?:\.cmd)...\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
  /\btsc(?:\.cmd)...\b/i,
  /\bpython(?:3)...(?:\.exe)...\b/i,
  /\bpy(?:\.exe)...\b/i,
  /\bpytest\b/i,
  /\bpip(?:3)...\b/i,
];

const JAVASCRIPT_COMMAND_PATTERNS = [
  /\bnpm\b/i,
  /\bpnpm\b/i,
  /\byarn\b/i,
  /\bnode\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
];

const PYTHON_COMMAND_PATTERNS = [
  /\bpython(?:3)...\b/i,
  /\bpytest\b/i,
  /\bpip(?:3)...\b/i,
];

/**
 * Padroes de code que indicam risk medio (container/gVisor).
 * Operactions de rede, installation de pacotes, manipulaction de sistema.
 */
const SENSITIVE_CODE_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[sqf]+\b/i,
  /\bformat\s+[a-z]:\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\binvoke-webrequest\b/i,
  /\bnpm\s+install\b/i,
  /\bpnpm\s+install\b/i,
  /\bpip\s+install\b/i,
  /\bapt(-get)...\s+install\b/i,
  /\bdocker\b/i,
];

/**
 * Code patterns that indicate CRITICAL risk (microvm/Firecracker).
 * access a kernel, manipulaction de processs, rede raw, exploit-like.
 */
const HIGH_RISK_CODE_PATTERNS = [
  // access direct a dispositivos e kernel
  /\/dev\/(mem|kmem|sda|vda|null|zero|random)/i,
  /\bmodprobe\b/i,
  /\binsmod\b/i,
  /\brmmod\b/i,
  /\bmount\b/i,
  /\bumount\b/i,
  /\bchroot\b/i,
  /\bnsenter\b/i,
  /\bunshare\b/i,

  // Rede raw e sniffing
  /\btcpdump\b/i,
  /\bnmap\b/i,
  /\bnetcat\b/i,
  /\bnc\s+-/i,
  /\bsocat\b/i,
  /\biptables\b/i,
  /\bip6tables\b/i,

  // Privilege escalation
  /\bsudo\b/i,
  /\bsu\s+-/i,
  /\bchmod\s+[0-7]*s/i,
  /\bsetuid\b/i,
  /\bsetgid\b/i,
  /\bcapsh\b/i,

  // Compilation and injection (potential exploit)
  /\bgcc\b/i,
  /\bg\+\+\b/i,
  /\bmake\b/i,
  /\bld\b/i,
  /\bas\b\s/i,

  // CryptoMining indicators
  /\bxmrig\b/i,
  /\bcpuminer\b/i,
  /stratum\+tcp/i,

  // Execution of unknown binaries
  /\bchmod\s+\+x\b/i,
  /\.\/[a-z]/i,

  // Fork bombs e denial of service
  /:\(\)\s*\{/,
  /\bfork\b/i,
  /\bwhile\s+true\b/i,
  /\bfor\s*\(\s*;\s*;\s*\)/,

  // Python-specific high-risk
  /\bos\.system\b/,
  /\bsubprocess\.Popen\b/,
  /\bctypes\b/,
  /\b__import__\b/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bimport\s+socket\b/,
  /\bimport\s+paramiko\b/,

  // JS-specific high-risk
  /\bchild_process\b/,
  /\brequire\(\s*['"]fs['"]\s*\)/,
  /\bprocess\.env\b/,
  /\bprocess\.exit\b/,

  // Anti-obfuscation and evasion patterns
  /\\[xX][0-9a-fA-F]{2}/, // Hex escape sequences
  /\\u[0-9a-fA-F]{4}/, // Unicode escape sequences
  /\bBuffer\.from\b.*\bbase64\b/i, // JS base64 decode
  /\bb64decode\b/i, // Python base64 decode
  /\bgetattr\b/i, // Python getattr reflection
  /\bglobals\s*\(\)/i, // Python globals() reflection
  /\blocals\s*\(\)/i, // Python locals() reflection
  /\b(eval|exec|require)\s*\(\s*[^)]*['"]\s*\+\s*['"]/i, // String concatenation inside eval/exec/require
  /\batob\s*\(/i, // JS base64 decode (atob)
  /\bbtoa\s*\(/i, // JS base64 encode (btoa)
  /\bString\.fromCharCode\s*\(/i, // Dynamic string construction from char codes
  /\bprocess\.binding\s*\(/i, // Node.js internal C++ binding access
  /\bimport\.meta\b/i, // ESM import.meta (potential URL/resolve bypass)
];

export type CodeSandboxPolicy = {
  securityLevel: SandboxSecurityLevel;
  reason: string;
};

export class SandboxPolicyService {
  private canUseLocalJail(): boolean {
    return process.env.ZAVORTH_ALLOW_LOCAL_JAIL_SANDBOX === 'true';
  }

  /**
   * Resolve a sandbox policy with 3 security levels:
   *
   *   1. local-jail   - Experimentos leves, code trusted, without rede
   *   2. container    - code sensitive rodando em Docker + gVisor
   *   3. microvm      - High-risk or untrusted code in a Firecracker MicroVM
   *
   * O parametro preferredLevel pode forcar qualquer nivel, mas nunca rebaixa
   * security when code is detected as dangerous.
   */
  public resolveCodeExecutionPolicy(
    language: SandboxLanguage,
    code: string,
    preferredLevel: 'auto' | 'local-jail' | 'wasm' | 'container' | 'microvm' = 'auto',
    options: { allowTrustedLocalJail?: boolean } = {},
  ): CodeSandboxPolicy {
    // If the user explicitly requested microvm, always respect it
    if (preferredLevel === 'microvm') {
      return {
        securityLevel: 'microvm',
        reason: 'MicroVM Firecracker solicitada explicitmente',
      };
    }

    // High-risk code detection -> ALWAYS goes to microvm
    // Even if the user requested container or local-jail.
    const highRiskMatch = HIGH_RISK_CODE_PATTERNS.find((pattern) => pattern.test(code));
    if (highRiskMatch) {
      return {
        securityLevel: 'microvm',
        reason: `code com default de alto risk detectado (${highRiskMatch.source}). Isolamento maximo via MicroVM.`,
      };
    }

    // If the user explicitly requested container
    if (preferredLevel === 'container') {
      return {
        securityLevel: 'container',
        reason: 'container explicitly requested',
      };
    }

    if (language === 'wasm') {
      return {
        securityLevel: 'wasm',
        reason: preferredLevel === 'wasm'
          ? 'Wasm module explicitly requested'
          : 'Literal and controlled WebAssembly module',
      };
    }

    // Shell scripts always go to container at minimum
    if (language === 'shell') {
      return {
        securityLevel: 'container',
        reason: 'Shell scripts require strong sandbox by default',
      };
    }

    // Sensitive code detection -> container (gVisor)
    if (SENSITIVE_CODE_PATTERNS.some((pattern) => pattern.test(code))) {
      return {
        securityLevel: 'container',
        reason: 'Code with sensitive or network commands',
      };
    }

    // Regex is only a scheduling heuristic, never a security barrier.
    // If the code was not recognized as dangerous, it still remains in
    // container by default. local-jail requires explicit operational opt-in.
    if (preferredLevel === 'local-jail' && (this.canUseLocalJail() || options.allowTrustedLocalJail === true)) {
      return {
        securityLevel: 'local-jail',
        reason: options.allowTrustedLocalJail === true ? 'local jail approved by a governed low-risk envelope'
          : 'local-jail explicitly requested and enabled by trusted local policy',
      };
    }

    return {
      securityLevel: 'container',
      reason: 'dynamic code without known risk still requires a container; pattern checks are not a security boundary',
    };
  }

  /**
   * Determina se uma ExecutionRequest requer container ou MicroVM.
   */
  public requiresContainerForExecution(request: ExecutionRequest): boolean {
    if (request.metadata?.sandboxRequired === true) {
      return true;
    }

    if (request.metadata?.untrustedContent === true) {
      return true;
    }

    if (request.executor !== 'local' && request.executor !== 'local_executor') {
      return false;
    }

    return request.instructions.some((instruction) => !this.isStrictlySafeCommand(instruction));
  }

  private isStrictlySafeCommand(command: string): boolean {
    const normalized = String(command || '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return false;
    }

    // Only these exact commands (without additional dangerous arguments or injection)
    const SAFE_EXACT_COMMANDS = [
      /^pwd$/i,
      /^whoami$/i,
      /^hostname$/i,
      /^git status$/i,
      /^git diff$/i,
      /^git diff --stat$/i,
      /^node -v$/i,
      /^node --version$/i,
      /^npm -v$/i,
      /^npm --version$/i,
      /^pnpm -v$/i,
      /^pnpm --version$/i,
      /^yarn -v$/i,
      /^yarn --version$/i,
      /^python -v$/i,
      /^python --version$/i,
      /^python3 --version$/i,
      /^py -V$/i,
      /^py --version$/i,
    ];

    if (SAFE_EXACT_COMMANDS.some((regex) => regex.test(normalized))) {
      return true;
    }

    // Permite ls/dir/cd/where/which only com argumentos simples e seguros
    if (/^(ls|dir|cd|where|which)(?:\s+[^;&|><`$]+)...$/i.test(normalized)) {
      if (/[$-]/.test(normalized) && !/^ls\s+-[a-zA-Z]+$/i.test(normalized) && !/^dir\s+\/[a-zA-Z]+$/i.test(normalized)) {
        if (!/^(ls\s+-[a-zA-Z]+|dir\s+\/[a-zA-Z]+|cd\s+[a-zA-Z0-9_\-./\\]+)$/i.test(normalized)) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Determines whether an ExecutionRequest needs the MAXIMUM isolation level (MicroVM).
   * Returns true for untrusted content or autonomous God-Mode tasks.
   */
  public requiresMicrovmForExecution(request: ExecutionRequest): boolean {
    // Content explicitly marked as untrusted
    if (request.metadata?.untrustedContent === true) {
      return true;
    }

    // Tasks originating from external users (Discord, Telegram)
    if (request.metadata?.sourceChannel === 'discord' || request.metadata?.sourceChannel === 'telegram') {
      return true;
    }

    // God-Mode autonomous execution (without human supervision)
    if (request.metadata?.godModeAutonomous === true) {
      return true;
    }

    // Check for high-risk patterns in command content
    return request.instructions.some((instruction) =>
      HIGH_RISK_CODE_PATTERNS.some((pattern) => pattern.test(instruction)),
    );
  }

  /**
   * Infere a linguagem de sandbox a partir do comando.
   */
  public inferExecutionSandboxLanguage(command: string): SandboxLanguage {
    if (JAVASCRIPT_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return 'javascript';
    }

    if (PYTHON_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return 'python';
    }

    return 'shell';
  }
}
