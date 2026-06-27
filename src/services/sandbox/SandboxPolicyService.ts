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
    if (preferredLevel === 'local-jail' && this.canUseLocalJail()) {
      return {
        securityLevel: 'local-jail',
        reason: 'local-jail solicitado explicitamente e habilitado por politica local confiavel',
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
    const normalized = String(command || '').trim();
    if (!normalized) {
      return false;
    }

    if (/&&|\|\||[|><`;\r\n]/.test(normalized) || /\$\(/.test(normalized)) {
      return false;
    }

    if (
      /\b(curl|wget|invoke-webrequest|npm\s+install|pnpm\s+install|yarn\s+add|pip(?:3)?\s+install|apt(?:-get)?\s+install|docker|choco|winget|scp|ssh|ftp|powershell|pwsh|reg|netsh)\b/i.test(
        normalized,
      )
    ) {
      return false;
    }

    return /^(dir\b|ls\b|pwd\b|cd\b|whoami\b|hostname\b|where\b|which\b|git\s+status\b|git\s+diff(?:\s+--stat)?\b|node\s+-v\b|npm\s+-v\b|pnpm\s+-v\b|yarn\s+-v\b|python(?:3)?\s+--version\b|py\s+-V\b)/i.test(
      normalized,
    );
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
