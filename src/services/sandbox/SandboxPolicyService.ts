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
  /\bnode(?:\.exe)?\b/i,
  /\bnpm(?:\.cmd)?\b/i,
  /\bnpx(?:\.cmd)?\b/i,
  /\bpnpm(?:\.cmd)?\b/i,
  /\byarn(?:\.cmd)?\b/i,
  /\bjest\b/i,
  /\bvitest\b/i,
  /\btsc(?:\.cmd)?\b/i,
  /\bpython(?:3)?(?:\.exe)?\b/i,
  /\bpy(?:\.exe)?\b/i,
  /\bpytest\b/i,
  /\bpip(?:3)?\b/i,
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
  /\bpython(?:3)?\b/i,
  /\bpytest\b/i,
  /\bpip(?:3)?\b/i,
];

/**
 * Padroes de codigo que indicam risco medio (container/gVisor).
 * Operacoes de rede, instalacao de pacotes, manipulacao de sistema.
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
  /\bapt(-get)?\s+install\b/i,
  /\bdocker\b/i,
];

/**
 * Padroes de codigo que indicam risco CRITICO (microvm/Firecracker).
 * Acesso a kernel, manipulacao de processos, rede raw, exploit-like.
 */
const HIGH_RISK_CODE_PATTERNS = [
  // Acesso direto a dispositivos e kernel
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

  // Escalacao de privilegios
  /\bsudo\b/i,
  /\bsu\s+-/i,
  /\bchmod\s+[0-7]*s/i,
  /\bsetuid\b/i,
  /\bsetgid\b/i,
  /\bcapsh\b/i,

  // Compilacao e injecao (potencial exploit)
  /\bgcc\b/i,
  /\bg\+\+\b/i,
  /\bmake\b/i,
  /\bld\b/i,
  /\bas\b\s/i,

  // CryptoMining indicators
  /\bxmrig\b/i,
  /\bcpuminer\b/i,
  /stratum\+tcp/i,

  // Execucao de binarios desconhecidos
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
   * Resolve a politica de sandbox com 3 niveis de seguranca:
   *
   *   1. local-jail   - Experimentos leves, codigo confiavel, sem rede
   *   2. container    - Codigo sensivel rodando em Docker + gVisor
   *   3. microvm      - Codigo de alto risco ou nao-confiavel em Firecracker MicroVM
   *
   * O parametro preferredLevel pode forcar qualquer nivel, mas nunca rebaixa
   * a segurança se o codigo for detectado como perigoso.
   */
  public resolveCodeExecutionPolicy(
    language: SandboxLanguage,
    code: string,
    preferredLevel: 'auto' | 'local-jail' | 'wasm' | 'container' | 'microvm' = 'auto',
    options: { allowTrustedLocalJail?: boolean } = {},
  ): CodeSandboxPolicy {
    // Se o usuario pediu explicitamente microvm, sempre respeita
    if (preferredLevel === 'microvm') {
      return {
        securityLevel: 'microvm',
        reason: 'MicroVM Firecracker solicitada explicitamente',
      };
    }

    // Deteccao de codigo de alto risco -> SEMPRE vai para microvm
    // Mesmo que o usuario tenha pedido container ou local-jail.
    const highRiskMatch = HIGH_RISK_CODE_PATTERNS.find((pattern) => pattern.test(code));
    if (highRiskMatch) {
      return {
        securityLevel: 'microvm',
        reason: `codigo com padrao de alto risco detectado (${highRiskMatch.source}). Isolamento maximo via MicroVM.`,
      };
    }

    // Se o usuario pediu container explicitamente
    if (preferredLevel === 'container') {
      return {
        securityLevel: 'container',
        reason: 'container solicitado explicitamente',
      };
    }

    if (language === 'wasm') {
      return {
        securityLevel: 'wasm',
        reason: preferredLevel === 'wasm'
          ? 'modulo Wasm solicitado explicitamente'
          : 'modulo WebAssembly literal e controlado',
      };
    }

    // Shell scripts sempre vao para container no minimo
    if (language === 'shell') {
      return {
        securityLevel: 'container',
        reason: 'scripts shell exigem sandbox forte por padrao',
      };
    }

    // Deteccao de codigo sensivel -> container (gVisor)
    if (SENSITIVE_CODE_PATTERNS.some((pattern) => pattern.test(code))) {
      return {
        securityLevel: 'container',
        reason: 'codigo com comandos sensiveis ou de rede',
      };
    }

    // Regex e apenas heuristica de escalonamento, nunca barreira de seguranca.
    // Se o codigo nao foi reconhecido como perigoso, ainda assim permanece em
    // container por padrao. local-jail exige opt-in operacional explicito.
    if (preferredLevel === 'local-jail' && (this.canUseLocalJail() || options.allowTrustedLocalJail === true)) {
      return {
        securityLevel: 'local-jail',
        reason: options.allowTrustedLocalJail === true
          ? 'local-jail autorizado por envelope governado de baixo risco'
          : 'local-jail solicitado explicitamente e habilitado por politica local confiavel',
      };
    }

    return {
      securityLevel: 'container',
      reason: 'codigo dinamico sem risco conhecido ainda exige container; regex e heuristica, nao fronteira de seguranca',
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

    // Apenas estes comandos exatos (sem argumentos adicionais perigosos ou injeção)
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

    // Permite ls/dir/cd/where/which apenas com argumentos simples e seguros
    if (/^(ls|dir|cd|where|which)(?:\s+[^;&|><`$]+)?$/i.test(normalized)) {
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
   * Determina se uma ExecutionRequest precisa do nivel MAXIMO de isolamento (MicroVM).
   * Retorna true para conteudo nao-confiavel ou tarefas autonomas do God-Mode.
   */
  public requiresMicrovmForExecution(request: ExecutionRequest): boolean {
    // Conteudo explicitamente marcado como nao-confiavel
    if (request.metadata?.untrustedContent === true) {
      return true;
    }

    // Tarefas originadas de usuarios externos (Discord, Telegram)
    if (request.metadata?.sourceChannel === 'discord' || request.metadata?.sourceChannel === 'telegram') {
      return true;
    }

    // God-Mode autonomous execution (sem supervisao humana)
    if (request.metadata?.godModeAutonomous === true) {
      return true;
    }

    // Verificar padroes de alto risco no conteudo dos comandos
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
