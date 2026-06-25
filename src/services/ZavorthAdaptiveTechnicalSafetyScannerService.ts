import type {
  ZavorthAdaptiveLearningLaneId,
  ZavorthAdaptiveLearningSensitivity,
  ZavorthAdaptiveTechnicalScan,
} from '../contracts/native/ZavorthAdaptiveLearningOsContract.js';
import type { ZavorthLearningMemoryRisk } from '../contracts/ZavorthMemoryLearningLoopContract.js';

const SECRET_PATTERNS: RegExp[] = [
  /\b(token|secret|password|api[_ -]?key|private[_ -]?key|credential)\s*[:=]\s*\S+/i,
  /\b(?:sk-|hf_|AIza|xoxb-|ghp_)[A-Za-z0-9_-]{6,}\b/,
];

const SECRET_REDACTION_PATTERNS: RegExp[] = [
  /\b(token|secret|password|api[_ -]?key|private[_ -]?key|credential)\s*[:=]\s*\S+/gi,
  /\b(?:sk-|hf_|AIza|xoxb-|ghp_)[A-Za-z0-9_-]{6,}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|system|developer)\s+instructions?\b/i,
  /\b(reveal|print|dump|exfiltrate|send)\s+(secrets?|developer\s+message|system\s+prompt|hidden\s+instructions?|files?)\b/i,
  /\b(dev(eloper)?\s+message|system\s+prompt|hidden\s+prompt)\b.*\b(reveal|print|show|dump)\b/i,
  /\b(ignore|ignorem|ignorar|desconsidere|esque[cç]a)\b.*\b(instru[cç][oõ]es|mensagem\s+do\s+desenvolvedor|sistema)\b/i,
  /\b(ignora|omite|salta|olvida)\b.*\b(instrucciones|mensaje\s+del\s+desarrollador|sistema)\b/i,
  /\b(ignorer|oublier|contourner)\b.*\b(instructions|message\s+developpeur|systeme)\b/i,
  /\b(ignoriere|vergiss|umgehe)\b.*\b(anweisungen|entwicklernachricht|system)\b/i,
];

const SENSITIVE_USER_MODEL_PATTERNS: RegExp[] = [
  /\b(depressed|depression|trauma|traumatized|psychological|psychiatric|fragile|vulnerable)\b/i,
  /\b(anxiety|anxious|bipolar|adhd|autism|ptsd|suicid|mental\s+health)\b/i,
  /\b(diagnos(?:is|e)|personality\s+disorder|clinical)\b/i,
  /\b(deprimido|depressao|depressivo|ansiedade|ansioso|traumatizado|psicologico|psiquiatrico|fragil|vulneravel|suicida|saude\s+mental)\b/i,
  /\b(deprimido|depresion|depresivo|ansiedad|ansioso|traumatizado|psicologico|psiquiatrico|fragil|vulnerable|suicida|salud\s+mental)\b/i,
  /\b(depression|anxiete|anxieux|traumatise|psychologique|psychiatrique|fragile|vulnerable|suicidaire|sante\s+mentale)\b/i,
  /\b(depressiv|depression|angst|traumatisiert|psychologisch|psychiatrisch|suizid|psychische\s+gesundheit)\b/i,
  /\b(depresso|depressione|ansia|ansioso|traumatizzato|psicologico|psichiatrico|suicida|salute\s+mentale)\b/i,
  /(?:抑郁|焦虑|创伤|心理|脆弱|自杀)/u,
  /(?:депресс|тревож|психолог|психиатр|уязвим|суицид)/iu,
  /(?:ซึมเศร้า|วิตกกังวล|เปราะบาง|สุขภาพจิต|ฆ่าตัวตาย)/u,
];

const SECURITY_POLICY_PATTERNS: RegExp[] = [
  /\b(disable|bypass|skip|ignore)\s+(approval|policy|sandbox|security)\b/i,
  /\b(always\s+allow|allowlist|denylist|secretref|permission\s+policy)\b/i,
  /\b(desativar|desative|desabilitar|burlar|ignorar|pular|permitir\s+sempre|sempre\s+permitir)\b.*\b(aprovacao|politica|seguranca|sandbox|shell|comando|permissao)\b/i,
  /\b(desactivar|desactiva|deshabilitar|omitir|saltar|ignorar|permitir\s+siempre|siempre\s+permitir)\b.*\b(aprobacion|politica|seguridad|sandbox|shell|comando|permiso)\b/i,
  /\b(desactiver|ignorer|contourner|autoriser\s+toujours)\b.*\b(approbation|politique|securite|sandbox|shell|commande|permission)\b/i,
  /\b(deaktivieren|umgehen|ignorieren|immer\s+erlauben)\b.*\b(genehmigung|richtlinie|sicherheit|sandbox|shell|befehl|berechtigung)\b/i,
  /(?:禁用|关闭|绕过|忽略).*(?:审批|批准|安全|策略|沙盒|shell|命令)/u,
  /(?:отключить|обойти|игнорировать).*(?:одобр|политик|безопасн|sandbox|shell|команд)/iu,
  /(?:ปิด|ข้าม|เลี่ยง).*(?:อนุมัติ|นโยบาย|ความปลอดภัย|sandbox|shell|คำสั่ง)/u,
];

export class ZavorthAdaptiveTechnicalSafetyScannerService {
  public scan(value: unknown): ZavorthAdaptiveTechnicalScan {
    const text = this.clean(value);
    const normalized = this.normalizeForPolicy(text);
    const findings: string[] = [];
    const evidence: string[] = [];

    if (this.containsSecret(text)) {
      findings.push('secret-like-value');
      evidence.push('technical:secret-pattern');
    }
    if (this.hasPromptInjection(text, normalized)) {
      findings.push('prompt-injection');
      evidence.push('technical:prompt-injection-pattern');
    }
    if (this.touchesSecurityPolicy(text, normalized)) {
      findings.push('security-policy-change');
      evidence.push('technical:security-policy-pattern');
    }
    if (this.hasSensitiveUserState(text, normalized)) {
      findings.push('sensitive-user-state');
      evidence.push('technical:sensitive-user-state-pattern');
    }

    const blocked = findings.some((finding) => finding === 'secret-like-value'
      || finding === 'prompt-injection'
      || finding === 'security-policy-change');
    const sensitivity: ZavorthAdaptiveLearningSensitivity = blocked
      ? 'blocked'
      : findings.includes('sensitive-user-state')
        ? 'sensitive'
        : 'normal';
    const lane: ZavorthAdaptiveLearningLaneId = sensitivity === 'normal' ? 'green' : 'red';
    const risk: ZavorthLearningMemoryRisk = sensitivity === 'normal'
      ? 'low'
      : sensitivity === 'sensitive'
        ? 'medium'
        : 'high';

    return {
      scanned: true,
      normalized,
      redactedText: this.redact(text),
      findings,
      evidence,
      blocked,
      lane,
      sensitivity,
      risk,
      containsSecret: findings.includes('secret-like-value'),
      promptInjection: findings.includes('prompt-injection'),
      policyChange: findings.includes('security-policy-change'),
    };
  }

  public redact(value: unknown, maxChars = 1200): string {
    const text = this.clean(value, maxChars);
    return SECRET_REDACTION_PATTERNS.reduce((current, pattern) => {
      if (pattern.source.includes('@')) {
        return current.replace(pattern, '[REDACTED_EMAIL]');
      }
      if (pattern.source.includes('sk-') || pattern.source.includes('ghp_')) {
        return current.replace(pattern, '[REDACTED_SECRET]');
      }
      return current.replace(pattern, '$1=[REDACTED]');
    }, text);
  }

  public normalizeForPolicy(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private containsSecret(text: string): boolean {
    return SECRET_PATTERNS.some((pattern) => pattern.test(text));
  }

  private hasPromptInjection(text: string, normalized: string): boolean {
    return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(normalized));
  }

  private hasSensitiveUserState(text: string, normalized: string): boolean {
    return SENSITIVE_USER_MODEL_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(normalized));
  }

  private touchesSecurityPolicy(text: string, normalized: string): boolean {
    return SECURITY_POLICY_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(normalized));
  }

  private clean(value: unknown, maxChars = 1200): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
  }
}
